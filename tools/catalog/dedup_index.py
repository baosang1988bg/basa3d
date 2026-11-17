#!/usr/bin/env python3
r"""
BaSa3D Fingerprint & Duplicate Checker (SQLite).
Indexes all files in D:\data3D (size + fast 3-point SHA-256 signature + normalized name)
AND indexes every entry inside .zip files (uncompressed size + CRC32 + normalized name)
without decompressing them.

Usage:
  python dedup_index.py build
  python dedup_index.py find-dups
  python dedup_index.py check "C:\Users\ADMIN\Downloads"
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import zipfile
import zlib
from pathlib import Path
from typing import Any

REPO_DIR = Path(__file__).resolve().parent.parent.parent
DATA_3D_DIR = Path(os.environ.get("CATALOG_DATA_DIR", r"D:\data3D")).resolve()
DB_DIR = Path(os.environ.get("CATALOG_OUT_DIR", str(REPO_DIR / ".catalog-data"))).resolve()
DB_PATH = DB_DIR / "fingerprint_index.sqlite"
CHUNK = 64 * 1024  # 64 KB sample per point


def normalize_name(name: str) -> str:
    stem = Path(name).stem.lower()
    # Strip trailing copy markers like (1), (2), - copy, _downloads
    stem = re.sub(r"\s*\((?:\d+|downloads|copy)\)\s*$", "", stem)
    stem = re.sub(r"[\s_\-+.#]+", " ", stem).strip()
    return stem


def fast_signature(fp: Path, size: int) -> str:
    """Compute a fast, collision-resistant SHA-256 over file size + head + mid + tail 64KB."""
    h = hashlib.sha256()
    h.update(str(size).encode("ascii") + b":")
    if size == 0:
        return h.hexdigest()
    with fp.open("rb") as f:
        if size <= CHUNK * 3:
            h.update(f.read())
        else:
            h.update(f.read(CHUNK))
            f.seek(size // 2 - CHUNK // 2)
            h.update(f.read(CHUNK))
            f.seek(max(0, size - CHUNK))
            h.update(f.read(CHUNK))
    return h.hexdigest()


def full_sha256(fp: Path) -> str:
    h = hashlib.sha256()
    with fp.open("rb") as f:
        for blk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(blk)
    return h.hexdigest()


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS files (
            rel_path TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            norm_name TEXT NOT NULL,
            ext TEXT NOT NULL,
            size INTEGER NOT NULL,
            mtime REAL NOT NULL,
            fast_sig TEXT NOT NULL,
            crc32 INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_files_sig ON files(size, fast_sig);
        CREATE INDEX IF NOT EXISTS idx_files_norm ON files(norm_name);

        CREATE TABLE IF NOT EXISTS zip_entries (
            archive_rel TEXT NOT NULL,
            inner_path TEXT NOT NULL,
            inner_name TEXT NOT NULL,
            norm_name TEXT NOT NULL,
            ext TEXT NOT NULL,
            size INTEGER NOT NULL,
            crc32 INTEGER NOT NULL,
            PRIMARY KEY (archive_rel, inner_path)
        );
        CREATE INDEX IF NOT EXISTS idx_zip_crc ON zip_entries(size, crc32);
        CREATE INDEX IF NOT EXISTS idx_zip_norm ON zip_entries(norm_name);
    """)
    conn.commit()


def build_index(source_dir: Path = DATA_3D_DIR, db_path: Path = DB_PATH) -> dict[str, Any]:
    t0 = time.time()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    init_db(conn)

    existing = {
        row[0]: (row[1], row[2])
        for row in conn.execute("SELECT rel_path, size, mtime FROM files")
    }

    disk_files = [
        p for p in source_dir.rglob("*")
        if p.is_file() and p.name != "_README_Parts.txt"
    ]
    seen_rels: set[str] = set()
    added_or_updated = 0
    reused = 0
    zip_entries_indexed = 0

    for fp in disk_files:
        rel = fp.relative_to(source_dir).as_posix()
        seen_rels.add(rel)
        st = fp.stat()
        size = st.st_size
        mtime = round(st.st_mtime, 3)

        prev = existing.get(rel)
        if prev and prev[0] == size and abs(prev[1] - mtime) < 0.01:
            reused += 1
            continue

        sig = fast_signature(fp, size)
        ext = fp.suffix.lower()
        crc = None
        # Compute CRC32 for small/medium standalone files (< 150 MB) so we can match against ZIP inner entries!
        if ext != ".zip" and 0 < size <= 150 * 1024 * 1024:
            val = 0
            with fp.open("rb") as f:
                for blk in iter(lambda: f.read(1024 * 1024), b""):
                    val = zlib.crc32(blk, val)
            crc = val & 0xFFFFFFFF

        conn.execute(
            "REPLACE INTO files(rel_path, name, norm_name, ext, size, mtime, fast_sig, crc32) VALUES (?,?,?,?,?,?,?,?)",
            (rel, fp.name, normalize_name(fp.name), ext, size, mtime, sig, crc),
        )
        added_or_updated += 1

        if ext == ".zip" and size > 0:
            conn.execute("DELETE FROM zip_entries WHERE archive_rel = ?", (rel,))
            try:
                with zipfile.ZipFile(fp) as z:
                    rows = []
                    for info in z.infolist():
                        if info.is_dir() or "__MACOSX" in info.filename:
                            continue
                        iname = Path(info.filename).name
                        iext = Path(iname).suffix.lower()
                        rows.append((
                            rel,
                            info.filename,
                            iname,
                            normalize_name(iname),
                            iext,
                            info.file_size,
                            info.CRC & 0xFFFFFFFF,
                        ))
                    conn.executemany(
                        "REPLACE INTO zip_entries(archive_rel, inner_path, inner_name, norm_name, ext, size, crc32) VALUES (?,?,?,?,?,?,?)",
                        rows,
                    )
                    zip_entries_indexed += len(rows)
            except Exception:
                pass

    # Remove deleted files from index
    removed = 0
    for old_rel in list(existing.keys()):
        if old_rel not in seen_rels:
            conn.execute("DELETE FROM files WHERE rel_path = ?", (old_rel,))
            conn.execute("DELETE FROM zip_entries WHERE archive_rel = ?", (old_rel,))
            removed += 1

    conn.commit()
    total_files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    total_zip_entries = conn.execute("SELECT COUNT(*) FROM zip_entries").fetchone()[0]
    conn.close()
    return {
        "totalFiles": total_files,
        "totalZipEntries": total_zip_entries,
        "addedOrUpdated": added_or_updated,
        "reused": reused,
        "removed": removed,
        "elapsedSec": round(time.time() - t0, 2),
    }


def find_internal_duplicates(source_dir: Path = DATA_3D_DIR, db_path: Path = DB_PATH) -> list[dict[str, Any]]:
    conn = sqlite3.connect(str(db_path))
    groups = conn.execute("""
        SELECT size, fast_sig, GROUP_CONCAT(rel_path, '|||')
        FROM files
        WHERE size > 0
        GROUP BY size, fast_sig
        HAVING COUNT(*) > 1
        ORDER BY size DESC
    """).fetchall()
    conn.close()

    verified_groups = []
    for size, sig, paths_str in groups:
        paths = paths_str.split("|||")
        # Confirm with full SHA-256 so zero false positives
        by_sha: dict[str, list[str]] = {}
        for rel in paths:
            fp = source_dir / rel
            if fp.exists():
                sha = full_sha256(fp)
                by_sha.setdefault(sha, []).append(rel)
        for sha, same_rels in by_sha.items():
            if len(same_rels) > 1:
                verified_groups.append({
                    "size": size,
                    "sha256": sha,
                    "files": same_rels,
                    "wastedBytes": size * (len(same_rels) - 1),
                })
    return verified_groups


def five_point_sig(fp: Path, size: int) -> str:
    h = hashlib.sha256()
    h.update(str(size).encode("ascii"))
    with fp.open("rb") as f:
        for frac in (0.0, 0.25, 0.5, 0.75):
            f.seek(max(0, int(size * frac) - (CHUNK // 2 if frac > 0 else 0)))
            h.update(f.read(CHUNK))
        f.seek(max(0, size - CHUNK))
        h.update(f.read(CHUNK))
    return h.hexdigest()


def check_candidate_file(fp: Path, conn: sqlite3.Connection, source_dir: Path = DATA_3D_DIR) -> dict[str, Any]:
    st = fp.stat()
    size = st.st_size
    sig = fast_signature(fp, size)
    norm = normalize_name(fp.name)
    ext = fp.suffix.lower()

    # 1. Exact file match in D:\data3D
    exact_rows = conn.execute(
        "SELECT rel_path, name FROM files WHERE size = ? AND fast_sig = ?",
        (size, sig),
    ).fetchall()
    if exact_rows:
        use_full = size <= 200 * 1024 * 1024
        cand_sha = full_sha256(fp) if use_full else five_point_sig(fp, size)
        confirmed = []
        for rel, _ in exact_rows:
            target = source_dir / rel
            if target.exists():
                t_sig = full_sha256(target) if use_full else five_point_sig(target, size)
                if t_sig == cand_sha:
                    confirmed.append(rel)
        if confirmed:
            return {
                "file": fp.name,
                "path": str(fp),
                "size": size,
                "status": "exact_dup",
                "matches": confirmed,
            }

    # 2. Match inside an existing ZIP via CRC32 + size (for non-zip or small files <= 150MB)
    if ext != ".zip" and 0 < size <= 150 * 1024 * 1024:
        val = 0
        with fp.open("rb") as f:
            for blk in iter(lambda: f.read(1024 * 1024), b""):
                val = zlib.crc32(blk, val)
        crc = val & 0xFFFFFFFF
        zip_hits = conn.execute(
            "SELECT archive_rel, inner_path FROM zip_entries WHERE size = ? AND crc32 = ?",
            (size, crc),
        ).fetchall()
        if zip_hits:
            return {
                "file": fp.name,
                "path": str(fp),
                "size": size,
                "status": "inside_zip",
                "matches": [f"{a} -> {ip}" for a, ip in zip_hits[:5]],
            }

    # 3. Similar normalized name match
    if len(norm) >= 4:
        name_hits = [
            r[0] for r in conn.execute(
                "SELECT rel_path FROM files WHERE norm_name = ? AND ext = ?",
                (norm, ext),
            ).fetchall()
        ]
        zip_name_hits = [
            f"{r[0]} -> {r[1]}" for r in conn.execute(
                "SELECT archive_rel, inner_name FROM zip_entries WHERE norm_name = ? AND ext = ?",
                (norm, ext),
            ).fetchall()
        ]
        all_name_hits = name_hits + zip_name_hits
        if all_name_hits:
            return {
                "file": fp.name,
                "path": str(fp),
                "size": size,
                "status": "name_similar",
                "matches": all_name_hits[:5],
            }

    return {
        "file": fp.name,
        "path": str(fp),
        "size": size,
        "status": "new",
        "matches": [],
    }


def check_folder(target_dir: Path, db_path: Path = DB_PATH) -> list[dict[str, Any]]:
    if not db_path.exists():
        build_index(DATA_3D_DIR, db_path)
    conn = sqlite3.connect(str(db_path))
    results = []
    exts = {".3mf", ".stl", ".obj", ".mtl", ".glb", ".nom", ".gcode", ".zip", ".rar", ".7z"}
    for fp in sorted(target_dir.iterdir(), key=lambda x: x.name.lower()):
        if fp.is_file() and fp.suffix.lower() in exts:
            results.append(check_candidate_file(fp, conn))
    conn.close()
    return results


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build":
        info = build_index()
        print(json.dumps(info, indent=2, ensure_ascii=False))
    elif cmd == "find-dups":
        if not DB_PATH.exists():
            build_index()
        dups = find_internal_duplicates()
        wasted = sum(g["wastedBytes"] for g in dups)
        print(f"Found {len(dups)} exact duplicate groups, wasted={wasted/(1024**3):.2f} GB")
        for g in dups:
            print(f"  {g['size']/(1024**2):8.2f} MB | {g['files']}")
    elif cmd == "check":
        if len(sys.argv) < 3:
            raise SystemExit("Usage: dedup_index.py check <folder>")
        res = check_folder(Path(sys.argv[2]))
        for r in res:
            print(f"[{r['status']:12s}] {r['file']} ({r['size']/(1024**2):.2f} MB) -> {r['matches']}")
    else:
        raise SystemExit(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
