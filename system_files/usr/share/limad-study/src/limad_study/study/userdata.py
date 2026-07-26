from __future__ import annotations
import uuid
from ..database import DB, Database
from ..utils import utc_now


def notes(database: Database = DB, query: str = "", limit: int = 500) -> list[dict]:
    needle=f"%{query.strip()}%"
    local=database.rows('''SELECT n.id,'local' AS source,n.title,n.content,n.block_identifier,n.created_at AS created,n.modified_at AS modified,d.id AS document_id,d.title AS document_title,p.title AS publication_title,
        COALESCE((SELECT group_concat(tag_name, ' • ') FROM local_note_tags nt WHERE nt.note_id=n.id),'') AS tags
        FROM local_notes n JOIN documents d ON d.id=n.document_id JOIN publications p ON p.id=d.publication_id
        WHERE (?='' OR n.title LIKE ? OR n.content LIKE ?) ORDER BY n.modified_at DESC LIMIT ?''',(query.strip(),needle,needle,limit))
    imported=database.rows('''SELECT CAST(n.note_id AS TEXT)||':'||n.backup_id AS id,'backup' AS source,n.title,n.content,n.block_identifier,n.created,n.last_modified AS modified,
        l.document_id AS source_document_id,l.key_symbol,l.meps_language,l.title AS location_title,'' AS document_title,'' AS publication_title,
        COALESCE((SELECT group_concat(t.name, ' • ') FROM tag_map tm JOIN tags t ON t.backup_id=tm.backup_id AND t.tag_id=tm.tag_id WHERE tm.backup_id=n.backup_id AND tm.note_id=n.note_id),'') AS tags
        FROM notes n LEFT JOIN user_locations l ON l.backup_id=n.backup_id AND l.location_id=n.location_id
        WHERE (?='' OR n.title LIKE ? OR n.content LIKE ?) ORDER BY n.last_modified DESC LIMIT ?''',(query.strip(),needle,needle,limit))
    return sorted(local+imported,key=lambda x:x.get("modified") or x.get("created") or "",reverse=True)[:limit]


def create_note(document_id: int,title: str,content: str,block_identifier: int | None=None,tags: list[str] | None=None,database: Database=DB) -> dict:
    if not database.scalar("SELECT 1 FROM documents WHERE id=?",(int(document_id),)):
        raise ValueError("Dokument wurde nicht gefunden.")
    note_id=uuid.uuid4().hex
    now=utc_now()
    with database.transaction() as con:
        con.execute("INSERT INTO local_notes(id,document_id,title,content,block_identifier,created_at,modified_at) VALUES(?,?,?,?,?,?,?)",(note_id,int(document_id),title.strip(),content.strip(),block_identifier,now,now))
        _set_tags(con,note_id,tags or [])
    return database.rows("SELECT * FROM local_notes WHERE id=?",(note_id,))[0]


def _set_tags(con,note_id:str,tags:list[str]):
    con.execute("DELETE FROM local_note_tags WHERE note_id=?",(note_id,))
    for raw in tags:
        name=str(raw).strip()
        if not name: continue
        con.execute("INSERT OR IGNORE INTO local_tags(name,created_at) VALUES(?,?)",(name,utc_now()))
        con.execute("INSERT OR IGNORE INTO local_note_tags(note_id,tag_name) VALUES(?,?)",(note_id,name))


def update_note(note_id: str,title: str,content: str,tags:list[str]|None=None,database: Database=DB) -> dict:
    with database.transaction() as con:
        con.execute("UPDATE local_notes SET title=?,content=?,modified_at=? WHERE id=?",(title.strip(),content.strip(),utc_now(),note_id))
        if tags is not None: _set_tags(con,note_id,tags)
    rows=database.rows("SELECT * FROM local_notes WHERE id=?",(note_id,))
    if not rows: raise ValueError("Notiz wurde nicht gefunden.")
    return rows[0]


def delete_note(note_id: str,database: Database=DB) -> None:
    database.execute("DELETE FROM local_notes WHERE id=?",(note_id,))


def add_mark(document_id:int,block_identifier:int|None,start_token:int|None,end_token:int|None,color_index:int=0,style_index:int=0,database:Database=DB)->dict:
    mark_id=uuid.uuid4().hex
    database.execute("INSERT INTO local_marks(id,document_id,block_identifier,start_token,end_token,color_index,style_index,created_at) VALUES(?,?,?,?,?,?,?,?)",(mark_id,int(document_id),block_identifier,start_token,end_token,int(color_index),int(style_index),utc_now()))
    return database.rows("SELECT * FROM local_marks WHERE id=?",(mark_id,))[0]


def delete_mark(mark_id:str,database:Database=DB)->None:
    database.execute("DELETE FROM local_marks WHERE id=?",(mark_id,))


def document_marks(document_id:int,database:Database=DB)->list[dict]:
    return database.rows("SELECT * FROM local_marks WHERE document_id=? ORDER BY created_at",(int(document_id),))


def create_bookmark(document_id:int,title:str="",snippet:str="",block_identifier:int|None=None,slot:int=0,database:Database=DB)->dict:
    if not database.scalar("SELECT 1 FROM documents WHERE id=?",(int(document_id),)): raise ValueError("Dokument wurde nicht gefunden.")
    bookmark_id=uuid.uuid4().hex; now=utc_now()
    database.execute("INSERT INTO local_bookmarks(id,document_id,block_identifier,title,snippet,slot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",(bookmark_id,int(document_id),block_identifier,title.strip(),snippet.strip(),int(slot),now,now))
    return database.rows("SELECT * FROM local_bookmarks WHERE id=?",(bookmark_id,))[0]


def delete_bookmark(bookmark_id:str,database:Database=DB)->None:
    database.execute("DELETE FROM local_bookmarks WHERE id=?",(bookmark_id,))


def bookmarks(database: Database=DB)->list[dict]:
    local=database.rows('''SELECT b.id,'local' AS source,b.title,b.snippet,b.slot,b.block_identifier,d.id AS document_id,d.title AS location_title,p.key_symbol,p.language_index AS meps_language,p.title AS publication_title
        FROM local_bookmarks b JOIN documents d ON d.id=b.document_id JOIN publications p ON p.id=d.publication_id ORDER BY b.updated_at DESC''')
    imported=database.rows('''SELECT CAST(b.bookmark_id AS TEXT)||':'||b.backup_id AS id,'backup' AS source,b.*,l.key_symbol,l.meps_language,l.document_id,l.title AS location_title,'' AS publication_title
        FROM bookmarks b LEFT JOIN user_locations l ON l.backup_id=b.backup_id AND l.location_id=b.location_id ORDER BY b.slot,b.title LIMIT 1000''')
    return local+imported


def save_position(document_id:int,scroll_ratio:float,block_identifier:int|None=None,database:Database=DB)->dict:
    ratio=max(0.0,min(1.0,float(scroll_ratio)))
    database.execute("INSERT INTO reading_positions(document_id,scroll_ratio,block_identifier,updated_at) VALUES(?,?,?,?) ON CONFLICT(document_id) DO UPDATE SET scroll_ratio=excluded.scroll_ratio,block_identifier=excluded.block_identifier,updated_at=excluded.updated_at",(int(document_id),ratio,block_identifier,utc_now()))
    return {"document_id":int(document_id),"scroll_ratio":ratio,"block_identifier":block_identifier}


def reading_position(document_id:int,database:Database=DB)->dict:
    rows=database.rows("SELECT * FROM reading_positions WHERE document_id=?",(int(document_id),))
    return rows[0] if rows else {"document_id":int(document_id),"scroll_ratio":0,"block_identifier":None}


def tags(database: Database=DB)->list[dict]:
    imported=database.rows('''SELECT t.name,t.type,COUNT(tm.tag_map_id) AS usage,'backup' AS source FROM tags t LEFT JOIN tag_map tm ON tm.backup_id=t.backup_id AND tm.tag_id=t.tag_id GROUP BY t.backup_id,t.tag_id''')
    local=database.rows('''SELECT lt.name,0 AS type,COUNT(lnt.note_id) AS usage,'local' AS source FROM local_tags lt LEFT JOIN local_note_tags lnt ON lnt.tag_name=lt.name GROUP BY lt.name''')
    return sorted(imported+local,key=lambda x:(x.get('name') or '').lower())


def add_mark_group(document_id: int, ranges: list[dict], color_index: int = 0, style_index: int = 0, database: Database = DB) -> dict:
    if not ranges:
        raise ValueError("Mindestens ein Markierungsbereich ist erforderlich.")
    group_id = uuid.uuid4().hex
    now = utc_now()
    with database.transaction() as con:
        con.execute(
            "INSERT INTO mark_groups(id,document_id,color_index,style_index,created_at,updated_at) VALUES(?,?,?,?,?,?)",
            (group_id, int(document_id), int(color_index), int(style_index), now, now),
        )
        for position, item in enumerate(ranges):
            con.execute(
                "INSERT INTO mark_group_ranges(group_id,position,block_identifier,start_token,end_token) VALUES(?,?,?,?,?)",
                (group_id, position, int(item["block_identifier"]), item.get("start_token"), item.get("end_token")),
            )
    return {"id": group_id, "document_id": int(document_id), "color_index": int(color_index), "style_index": int(style_index), "ranges": ranges}


def update_mark(mark_id: str, color_index: int | None = None, hidden: bool | None = None, database: Database = DB) -> dict:
    if ":" in mark_id:
        user_mark, backup = mark_id.split(":", 1)
        database.execute(
            "INSERT INTO imported_mark_overrides(backup_id,user_mark_id,hidden,color_index,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(backup_id,user_mark_id) DO UPDATE SET hidden=excluded.hidden,color_index=excluded.color_index,updated_at=excluded.updated_at",
            (backup, int(user_mark), 1 if hidden else 0, color_index, utc_now()),
        )
        return {"id": mark_id, "source": "backup", "hidden": bool(hidden), "color_index": color_index}
    if database.scalar("SELECT 1 FROM mark_groups WHERE id=?", (mark_id,)):
        if color_index is not None:
            database.execute("UPDATE mark_groups SET color_index=?,updated_at=? WHERE id=?", (int(color_index), utc_now(), mark_id))
        return database.rows("SELECT * FROM mark_groups WHERE id=?", (mark_id,))[0]
    if color_index is not None:
        database.execute("UPDATE local_marks SET color_index=? WHERE id=?", (int(color_index), mark_id))
    rows = database.rows("SELECT * FROM local_marks WHERE id=?", (mark_id,))
    if not rows:
        raise ValueError("Markierung wurde nicht gefunden.")
    return rows[0]


def delete_mark_any(mark_id: str, database: Database = DB) -> None:
    if ":" in mark_id:
        update_mark(mark_id, hidden=True, database=database)
        return
    if database.scalar("SELECT 1 FROM mark_groups WHERE id=?", (mark_id,)):
        database.execute("DELETE FROM mark_groups WHERE id=?", (mark_id,))
        return
    delete_mark(mark_id, database)


def document_mark_groups(document_id: int, database: Database = DB) -> list[dict]:
    groups = database.rows("SELECT * FROM mark_groups WHERE document_id=? ORDER BY created_at", (int(document_id),))
    for group in groups:
        group["ranges"] = database.rows(
            "SELECT block_identifier,start_token,end_token,position FROM mark_group_ranges WHERE group_id=? ORDER BY position",
            (group["id"],),
        )
    return groups


def save_input_field(document_id: int, text_tag: str, value: str, database: Database = DB) -> dict:
    database.execute(
        "INSERT INTO local_input_fields(document_id,text_tag,value,updated_at) VALUES(?,?,?,?) "
        "ON CONFLICT(document_id,text_tag) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        (int(document_id), str(text_tag), str(value), utc_now()),
    )
    return {"document_id": int(document_id), "text_tag": str(text_tag), "value": str(value)}


def input_fields_for_document(document_id: int, database: Database = DB) -> list[dict]:
    return database.rows("SELECT * FROM local_input_fields WHERE document_id=? ORDER BY text_tag", (int(document_id),))
