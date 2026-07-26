from __future__ import annotations
import hashlib
import json
import shutil
import sqlite3
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from ..database import DB, Database
from ..utils import utc_now


def _next(con: sqlite3.Connection, table: str, column: str) -> int:
    return int(con.execute(f'SELECT COALESCE(MAX("{column}"),0)+1 FROM "{table}"').fetchone()[0])


def _ensure_location(con: sqlite3.Connection, note: dict, counters: dict) -> int:
    doc=int(note.get('meps_document_id') or note.get('source_document_id') or 0)
    row=con.execute('''SELECT LocationId FROM Location WHERE DocumentId=? AND KeySymbol=? AND MepsLanguage=? AND IssueTagNumber=? LIMIT 1''',
                    (doc,note['key_symbol'],note['language_index'],int(note.get('issue_tag') or 0))).fetchone()
    if row: return int(row[0])
    location_id=counters['Location']; counters['Location']+=1
    con.execute('''INSERT INTO Location(LocationId,BookNumber,ChapterNumber,DocumentId,Track,IssueTagNumber,KeySymbol,MepsLanguage,Type,Title,Specialty,Edition)
        VALUES(?,?,?,?,NULL,?,?,?,0,?,NULL,NULL)''',(location_id,note.get('chapter_number'),note.get('chapter_number'),doc,int(note.get('issue_tag') or 0),note['key_symbol'],note['language_index'],note.get('publication_title') or ''))
    return location_id


def _integrity(db_path: Path) -> str:
    con=sqlite3.connect(db_path)
    try: return str(con.execute('PRAGMA integrity_check').fetchone()[0])
    finally: con.close()


def export_jwlibrary(target: Path, backup_id: str | None=None, database: Database=DB) -> dict:
    rows=database.rows('SELECT * FROM backup_imports WHERE id=?',(backup_id,)) if backup_id else database.rows('SELECT * FROM backup_imports ORDER BY imported_at DESC LIMIT 1')
    if not rows: raise ValueError('Für einen kompatiblen Export muss zuerst ein originales .jwlibrary-Backup importiert werden.')
    backup=rows[0]; source_dir=Path(backup['raw_dir'])
    if not (source_dir/'userData.db').is_file(): raise FileNotFoundError('Originale userData.db fehlt.')
    target=Path(target); target.parent.mkdir(parents=True,exist_ok=True)
    report={'notes':0,'marks':0,'bookmarks':0,'tags':0,'input_fields':0,'updated_notes':0,'updated_marks':0}
    with tempfile.TemporaryDirectory(prefix='limad-export-') as tmp:
        root=Path(tmp)
        for item in source_dir.iterdir():
            if item.is_file() and item.suffix.lower() not in {'.jwlibrary'}: shutil.copy2(item,root/item.name)
        db_path=root/'userData.db'; con=sqlite3.connect(db_path); con.row_factory=sqlite3.Row
        try:
            counters={t:_next(con,t,pk) for t,pk in [('Location','LocationId'),('Note','NoteId'),('UserMark','UserMarkId'),('BlockRange','BlockRangeId'),('Bookmark','BookmarkId'),('Tag','TagId'),('TagMap','TagMapId')]}
            local_notes=database.rows('''SELECT n.*,d.source_document_id,d.meps_document_id,d.chapter_number,p.key_symbol,p.language_index,p.issue_tag,p.title AS publication_title
                FROM local_notes n JOIN documents d ON d.id=n.document_id JOIN publications p ON p.id=d.publication_id ORDER BY n.created_at''')
            for note in local_notes:
                loc=_ensure_location(con,note,counters); guid=str(uuid.uuid5(uuid.NAMESPACE_URL,'limad-study-note:'+note['id']))
                old=con.execute('SELECT NoteId FROM Note WHERE Guid=?',(guid,)).fetchone()
                if old:
                    note_id=int(old[0]); con.execute('UPDATE Note SET LocationId=?,Title=?,Content=?,LastModified=?,BlockType=?,BlockIdentifier=? WHERE NoteId=?',(loc,note.get('title') or '',note.get('content') or '',note.get('modified_at') or note.get('created_at'),1 if note.get('block_identifier') is not None else 0,note.get('block_identifier'),note_id)); report['updated_notes']+=1
                else:
                    note_id=counters['Note']; counters['Note']+=1
                    con.execute('''INSERT INTO Note(NoteId,Guid,UserMarkId,LocationId,Title,Content,LastModified,Created,BlockType,BlockIdentifier) VALUES(?,?,NULL,?,?,?,?,?,?,?)''',(note_id,guid,loc,note.get('title') or '',note.get('content') or '',note.get('modified_at') or note.get('created_at'),note.get('created_at'),1 if note.get('block_identifier') is not None else 0,note.get('block_identifier')))
                report['notes']+=1
                for tag in database.rows('SELECT tag_name FROM local_note_tags WHERE note_id=? ORDER BY tag_name',(note['id'],)):
                    name=tag['tag_name']; row=con.execute('SELECT TagId FROM Tag WHERE Name=? AND Type=1',(name,)).fetchone()
                    if row: tag_id=int(row[0])
                    else:
                        tag_id=counters['Tag']; counters['Tag']+=1; con.execute('INSERT INTO Tag(TagId,Type,Name) VALUES(?,1,?)',(tag_id,name)); report['tags']+=1
                    if not con.execute('SELECT 1 FROM TagMap WHERE NoteId=? AND TagId=?',(note_id,tag_id)).fetchone():
                        tm=counters['TagMap']; counters['TagMap']+=1; pos=int(con.execute('SELECT COALESCE(MAX(Position),-1)+1 FROM TagMap WHERE TagId=?',(tag_id,)).fetchone()[0]); con.execute('INSERT INTO TagMap(TagMapId,PlaylistItemId,LocationId,NoteId,TagId,Position) VALUES(?,NULL,NULL,?,?,?)',(tm,note_id,tag_id,pos))
            local_marks=database.rows('''SELECT m.*,d.source_document_id,d.meps_document_id,d.chapter_number,p.key_symbol,p.language_index,p.issue_tag,p.title AS publication_title
                FROM local_marks m JOIN documents d ON d.id=m.document_id JOIN publications p ON p.id=d.publication_id ORDER BY m.created_at''')
            for mark in local_marks:
                loc=_ensure_location(con,mark,counters); guid=str(uuid.uuid5(uuid.NAMESPACE_URL,'limad-study-mark:'+mark['id']))
                old=con.execute('SELECT UserMarkId FROM UserMark WHERE UserMarkGuid=?',(guid,)).fetchone()
                if old:
                    mark_id=int(old[0]); con.execute('UPDATE UserMark SET ColorIndex=?,LocationId=?,StyleIndex=?,Version=Version+1 WHERE UserMarkId=?',(int(mark.get('color_index') or 0),loc,int(mark.get('style_index') or 0),mark_id)); con.execute('DELETE FROM BlockRange WHERE UserMarkId=?',(mark_id,)); report['updated_marks']+=1
                else:
                    mark_id=counters['UserMark']; counters['UserMark']+=1; con.execute('INSERT INTO UserMark(UserMarkId,ColorIndex,LocationId,StyleIndex,UserMarkGuid,Version) VALUES(?,?,?,?,?,1)',(mark_id,int(mark.get('color_index') or 0),loc,int(mark.get('style_index') or 0),guid))
                br=counters['BlockRange']; counters['BlockRange']+=1; con.execute('INSERT INTO BlockRange(BlockRangeId,BlockType,Identifier,StartToken,EndToken,UserMarkId) VALUES(?,?,?,?,?,?)',(br,1,int(mark.get('block_identifier') or 0),mark.get('start_token'),mark.get('end_token'),mark_id)); report['marks']+=1
            local_bookmarks=database.rows('''SELECT b.*,d.source_document_id,d.meps_document_id,d.chapter_number,p.key_symbol,p.language_index,p.issue_tag,p.title AS publication_title
                FROM local_bookmarks b JOIN documents d ON d.id=b.document_id JOIN publications p ON p.id=d.publication_id ORDER BY b.slot,b.created_at''')
            for b in local_bookmarks:
                loc=_ensure_location(con,b,counters); stable_title='[LiMaD] '+(b.get('title') or '')
                old=con.execute('SELECT BookmarkId FROM Bookmark WHERE LocationId=? AND Slot=? AND Title=?',(loc,int(b.get('slot') or 0),stable_title)).fetchone()
                if old: con.execute('UPDATE Bookmark SET Snippet=?,BlockType=?,BlockIdentifier=? WHERE BookmarkId=?',(b.get('snippet') or '',1 if b.get('block_identifier') is not None else 0,b.get('block_identifier'),old[0]))
                else:
                    bid=counters['Bookmark']; counters['Bookmark']+=1; con.execute('INSERT INTO Bookmark(BookmarkId,LocationId,PublicationLocationId,Slot,Title,Snippet,BlockType,BlockIdentifier) VALUES(?,?,?,?,?,?,?,?)',(bid,loc,loc,int(b.get('slot') or 0),stable_title,b.get('snippet') or '',1 if b.get('block_identifier') is not None else 0,b.get('block_identifier')))
                report['bookmarks']+=1
            for field in database.rows('''SELECT f.*,d.source_document_id,d.meps_document_id,d.chapter_number,p.key_symbol,p.language_index,p.issue_tag,p.title AS publication_title
                FROM local_input_fields f JOIN documents d ON d.id=f.document_id JOIN publications p ON p.id=d.publication_id'''):
                loc=_ensure_location(con,field,counters); con.execute('INSERT INTO InputField(LocationId,TextTag,Value) VALUES(?,?,?) ON CONFLICT(LocationId,TextTag) DO UPDATE SET Value=excluded.Value',(loc,field['text_tag'],field['value'])); report['input_fields']+=1
            con.commit()
        finally: con.close()
        integrity=_integrity(db_path)
        if integrity!='ok': raise ValueError(f'Exportdatenbank ist beschädigt: {integrity}')
        manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8-sig'))
        digest=hashlib.sha256(db_path.read_bytes()).hexdigest(); now=datetime.now().astimezone().strftime('%Y-%m-%dT%H:%M:%S%z')
        manifest['name']=target.name; manifest['creationDate']=now; manifest.setdefault('userDataBackup',{})['lastModifiedDate']=now; manifest['userDataBackup']['hash']=digest
        (root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
        temp=target.with_suffix(target.suffix+'.tmp')
        with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
            for item in sorted(root.iterdir()):
                if item.is_file(): archive.write(item,item.name)
        temp.replace(target)
    export_id=uuid.uuid4().hex
    full={'path':str(target),'size':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'backup_id':backup['id'],'integrity':integrity,**report}
    database.execute('''INSERT INTO backup_export_runs(id,backup_id,target_name,created_at,manifest_hash,db_integrity,notes_exported,marks_exported,bookmarks_exported,tags_exported,input_fields_exported,report_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',(export_id,backup['id'],target.name,utc_now(),digest,integrity,report['notes'],report['marks'],report['bookmarks'],report['tags'],report['input_fields'],json.dumps(full,ensure_ascii=False)))
    return full
