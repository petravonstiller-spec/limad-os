from __future__ import annotations
from collections import Counter
from ..database import DB, Database
from ..utils import utc_now


def reconcile_backup(backup_id: str | None = None, database: Database = DB) -> dict:
    clauses=[]; params=[]
    if backup_id:
        clauses.append("l.backup_id=?"); params.append(backup_id)
    where=("WHERE "+" AND ".join(clauses)) if clauses else ""
    locations=database.rows(f"SELECT l.* FROM user_locations l {where} ORDER BY l.backup_id,l.location_id",tuple(params))
    counts=Counter()
    with database.transaction() as con:
        for loc in locations:
            pub=None; doc=None; reason=""
            key=(loc.get('key_symbol') or '').strip()
            lang=loc.get('meps_language')
            issue=int(loc.get('issue_tag') or 0)
            if key and lang is not None:
                rows=con.execute('''SELECT * FROM publications WHERE lower(key_symbol)=lower(?) AND language_index=?
                    ORDER BY CASE WHEN issue_tag=? THEN 0 WHEN issue_tag=0 THEN 1 ELSE 2 END,
                    CASE WHEN status='installed' THEN 0 ELSE 1 END,year DESC,installed_at DESC LIMIT 1''',(key,lang,issue)).fetchall()
                if rows: pub=dict(rows[0])
            source_doc=loc.get('document_id')
            if not pub and source_doc is not None:
                fallback=con.execute('''SELECT d.*,p.id AS matched_publication_id,p.title AS matched_publication_title FROM documents d JOIN publications p ON p.id=d.publication_id
                    WHERE (d.meps_document_id=? OR d.source_document_id=?) AND (? IS NULL OR p.language_index=?) ORDER BY CASE WHEN d.meps_document_id=? THEN 0 ELSE 1 END LIMIT 2''',(source_doc,source_doc,lang,lang,source_doc)).fetchall()
                if len(fallback)==1:
                    doc=dict(fallback[0]); pub={'id':doc['matched_publication_id'],'title':doc['matched_publication_title']}; status='resolved_document'; reason='Über eindeutige DocumentId zugeordnet'
            if not pub:
                status='missing_publication'; reason=f"Publikation {key or '?'} / Sprache {lang if lang is not None else '?'} fehlt"
            elif doc:
                status='resolved_document'
            else:
                if source_doc is not None:
                    row=con.execute('''SELECT * FROM documents WHERE publication_id=? AND (meps_document_id=? OR source_document_id=?)
                        ORDER BY CASE WHEN meps_document_id=? THEN 0 ELSE 1 END LIMIT 1''',(pub['id'],source_doc,source_doc,source_doc)).fetchone()
                    if row: doc=dict(row)
                if doc:
                    status='resolved_document'
                elif source_doc is None or int(loc.get('type') or 0) != 0:
                    status='resolved_publication'; reason='Publikationsebene oder nicht dokumentbezogene Position'
                else:
                    status='missing_document'; reason=f"Dokument {source_doc} fehlt in {pub['title']}"
            con.execute('''INSERT INTO backup_resolution(backup_id,location_id,publication_id,document_row_id,status,reason,resolved_at)
                VALUES(?,?,?,?,?,?,?) ON CONFLICT(backup_id,location_id) DO UPDATE SET publication_id=excluded.publication_id,
                document_row_id=excluded.document_row_id,status=excluded.status,reason=excluded.reason,resolved_at=excluded.resolved_at''',
                (loc['backup_id'],loc['location_id'],pub['id'] if pub else None,doc['id'] if doc else None,status,reason,utc_now()))
            counts[status]+=1
    return {'backup_id':backup_id,'locations':len(locations),'status_counts':dict(counts),'resolved':counts['resolved_document']+counts['resolved_publication'],'missing':counts['missing_publication']+counts['missing_document']}


def resolution_report(backup_id: str | None = None, database: Database = DB) -> dict:
    params=(); where=''
    if backup_id: where='WHERE r.backup_id=?'; params=(backup_id,)
    summary=database.rows(f'''SELECT r.status,COUNT(*) AS count FROM backup_resolution r {where} GROUP BY r.status ORDER BY r.status''',params)
    missing=database.rows(f'''SELECT r.backup_id,r.location_id,r.status,r.reason,l.key_symbol,l.meps_language,l.document_id,l.book_number,l.chapter_number,l.title
        FROM backup_resolution r JOIN user_locations l ON l.backup_id=r.backup_id AND l.location_id=r.location_id
        {where + (' AND' if where else 'WHERE')} r.status LIKE 'missing_%' ORDER BY l.key_symbol,l.document_id LIMIT 2000''',params)
    totals={row['status']:row['count'] for row in summary}
    return {'backup_id':backup_id,'summary':totals,'resolved':totals.get('resolved_document',0)+totals.get('resolved_publication',0),'missing':totals.get('missing_document',0)+totals.get('missing_publication',0),'missing_items':missing}
