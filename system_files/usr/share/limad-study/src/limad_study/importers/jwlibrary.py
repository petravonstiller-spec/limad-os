from __future__ import annotations
import json
import os
import shutil
import sqlite3
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any
from ..config import PATHS
from ..database import DB, Database
from ..utils import safe_extract, safe_zip_members, sha256_file, utc_now
from ..backup.reconcile import reconcile_backup

TABLES = ["Location","Note","UserMark","BlockRange","Tag","TagMap","Bookmark","InputField","PlaylistItem","PlaylistItemLocationMap","PlaylistItemMarker"]


def _exists(con: sqlite3.Connection, table: str) -> bool:
    return con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is not None


def inspect_jwlibrary(path: Path) -> dict[str, Any]:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(path)
    with tempfile.TemporaryDirectory(prefix="limad-jwlibrary-inspect-") as tmp:
        root = Path(tmp)
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            if "userData.db" not in names or "manifest.json" not in names:
                raise ValueError("Ungültiges JWL Library-Backup.")
            safe_extract(archive, root, safe_zip_members(archive, max_files=10000, max_size=3_000_000_000))
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8-sig"))
        con = sqlite3.connect(root / "userData.db")
        try:
            integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
            counts = {table: con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] if _exists(con, table) else 0 for table in TABLES}
            user_version = con.execute("PRAGMA user_version").fetchone()[0]
        finally:
            con.close()
    return {"file": path.name,"size": path.stat().st_size,"sha256": sha256_file(path),"manifest": manifest,"counts": counts,"integrity": integrity,"user_version": user_version}


def import_jwlibrary(path: Path, database: Database = DB) -> dict[str, Any]:
    path = Path(path).resolve()
    audit = inspect_jwlibrary(path)
    backup_id = f"{audit['sha256'][:16]}-{uuid.uuid4().hex[:8]}"
    final_dir = PATHS.backups / backup_id
    with tempfile.TemporaryDirectory(prefix=f".{backup_id}-", dir=PATHS.backups) as tmp_name:
        staging = Path(tmp_name)
        with zipfile.ZipFile(path) as archive:
            safe_extract(archive, staging, safe_zip_members(archive, max_files=10000, max_size=3_000_000_000))
        shutil.copy2(path, staging / path.name)
        source = sqlite3.connect(staging / "userData.db")
        source.row_factory = sqlite3.Row
        counts = audit["counts"]
        try:
            with database.transaction() as con:
                con.execute('''INSERT INTO backup_imports(id,filename,source_path,raw_dir,manifest_json,imported_at,locations_count,notes_count,marks_count,tags_count,bookmarks_count,input_fields_count)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''', (backup_id,path.name,str(final_dir / path.name),str(final_dir),json.dumps(audit["manifest"],ensure_ascii=False),utc_now(),counts["Location"],counts["Note"],counts["UserMark"],counts["Tag"],counts["Bookmark"],counts["InputField"]))
                if _exists(source,"Location"):
                    for r in source.execute("SELECT * FROM Location"):
                        con.execute('''INSERT INTO user_locations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',(backup_id,r["LocationId"],r["BookNumber"],r["ChapterNumber"],r["DocumentId"],r["Track"],r["IssueTagNumber"],r["KeySymbol"],r["MepsLanguage"],r["Type"],r["Title"],r["Specialty"],r["Edition"],))
                if _exists(source,"Note"):
                    for r in source.execute("SELECT * FROM Note"):
                        con.execute('''INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)''',(backup_id,r["NoteId"],r["Guid"],r["UserMarkId"],r["LocationId"],r["Title"],r["Content"],r["LastModified"],r["Created"],r["BlockType"],r["BlockIdentifier"],))
                if _exists(source,"UserMark"):
                    for r in source.execute("SELECT * FROM UserMark"):
                        con.execute('''INSERT INTO user_marks VALUES(?,?,?,?,?,?,?)''',(backup_id,r["UserMarkId"],r["ColorIndex"],r["LocationId"],r["StyleIndex"],r["UserMarkGuid"],r["Version"]))
                if _exists(source,"BlockRange"):
                    for r in source.execute("SELECT * FROM BlockRange"):
                        con.execute('''INSERT INTO block_ranges VALUES(?,?,?,?,?,?,?)''',(backup_id,r["BlockRangeId"],r["BlockType"],r["Identifier"],r["StartToken"],r["EndToken"],r["UserMarkId"]))
                if _exists(source,"Tag"):
                    for r in source.execute("SELECT * FROM Tag"):
                        con.execute("INSERT INTO tags VALUES(?,?,?,?)",(backup_id,r["TagId"],r["Type"],r["Name"]))
                if _exists(source,"TagMap"):
                    for r in source.execute("SELECT * FROM TagMap"):
                        con.execute("INSERT INTO tag_map VALUES(?,?,?,?,?,?,?)",(backup_id,r["TagMapId"],r["PlaylistItemId"],r["LocationId"],r["NoteId"],r["TagId"],r["Position"]))
                if _exists(source,"Bookmark"):
                    for r in source.execute("SELECT * FROM Bookmark"):
                        con.execute("INSERT INTO bookmarks VALUES(?,?,?,?,?,?,?,?,?)",(backup_id,r["BookmarkId"],r["LocationId"],r["PublicationLocationId"],r["Slot"],r["Title"],r["Snippet"],r["BlockType"],r["BlockIdentifier"]))
                if _exists(source,"InputField"):
                    for r in source.execute("SELECT * FROM InputField"):
                        con.execute("INSERT INTO input_fields VALUES(?,?,?,?)",(backup_id,r["LocationId"],r["TextTag"],r["Value"]))
                if _exists(source,"PlaylistItem"):
                    for r in source.execute("SELECT * FROM PlaylistItem"):
                        con.execute("INSERT INTO playlist_items VALUES(?,?,?,?,?,?,?,?,?)",(backup_id,r["PlaylistItemId"],r["Label"],r["StartTrimOffsetTicks"],r["EndTrimOffsetTicks"],r["Accuracy"],r["EndAction"],r["ThumbnailFilePath"]))
                if _exists(source,"PlaylistItemLocationMap"):
                    for r in source.execute("SELECT * FROM PlaylistItemLocationMap"):
                        con.execute("INSERT INTO playlist_locations VALUES(?,?,?,?,?)",(backup_id,r["PlaylistItemId"],r["LocationId"],r["MajorMultimediaType"],r["BaseDurationTicks"]))
                if _exists(source,"PlaylistItemMarker"):
                    for r in source.execute("SELECT * FROM PlaylistItemMarker"):
                        con.execute("INSERT INTO playlist_markers VALUES(?,?,?,?,?,?,?)",(backup_id,r["PlaylistItemMarkerId"],r["PlaylistItemId"],r["Label"],r["StartTimeTicks"],r["DurationTicks"],r["EndTransitionDurationTicks"]))
        finally:
            source.close()
        if final_dir.exists():
            shutil.rmtree(final_dir)
        os.replace(staging, final_dir)
    resolution=reconcile_backup(backup_id,database)
    return {"backup_id":backup_id,"filename":path.name,"counts":counts,"integrity":audit["integrity"],"user_version":audit["user_version"],"resolution":resolution}
