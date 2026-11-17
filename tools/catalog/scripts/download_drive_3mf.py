#!/usr/bin/env python3
r"""
Downloads unique .3mf files from the user's shared Google Drive folders
(Link 1: PACK CLICKER, Link 3: big pack), deduplicates against D:\data3D
by size + SHA-256/5-point signature, validates each .3mf archive, and
places unique files into matching category folders in D:\data3D\.

Respects a strict 4 GB minimum free space floor on D:\ and stops cleanly
on any rate-limit / anti-bot / CAPTCHA page.
"""

from __future__ import annotations

import html
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, r"D:\3D_Catalog")
import build_catalog
import dedup_index

DATA_3D = Path(r"D:\data3D")
TMP_DL = Path(r"C:\_3d_drive_dl")
MANIFEST_PENDING = Path(r"D:\3D_Catalog\pending_drive_3mf.json")
LOG_OUT = Path(r"D:\3D_Catalog\drive_download_report.txt")

MIN_D_FREE_BYTES = 4 * 1024**3  # Never let D:\ drop below 4 GB free

LINK1_ID = "12aIGDY2tLEGYua1hmJPCkIwKyD8CSkJD"  # PACK CLICKER
LINK3_ID = "1N36KRI-uP1ibXZlGV-tFKXezrerWCT2x"  # big pack

DRIVE_PATH_CATEGORY_HINTS = [
    ("pack clicker", "Clicker & Keychain"),
    ("/keychains", "Clicker & Keychain"),
    ("/fidget toys", "Clicker & Keychain"),
    ("/spiral fidgets", "Clicker & Keychain"),
    ("/pokemon", "Pokemon"),
    ("/cute flexi minis", "Động vật & Flexi"),
    ("/articulated", "Động vật & Flexi"),
    ("/august flexifiles", "Động vật & Flexi"),
    ("/dragon eggs", "Động vật & Flexi"),
    ("/dragons", "Động vật & Flexi"),
    ("/ducks", "Động vật & Flexi"),
    ("/labubus", "Figure"),
    ("/disney", "Figure"),
    ("/harry potter", "Figure"),
    ("/cartoons", "Figure"),
    ("/urban vibes", "Figure"),
    ("/bust files", "Figure"),
    ("/book nooks", "Trang trí & Lễ hội"),
    ("/lamps", "Trang trí & Lễ hội"),
    ("/vases", "Trang trí & Lễ hội"),
    ("/incence", "Trang trí & Lễ hội"),
    ("/wall art", "Trang trí & Lễ hội"),
    ("/head phone stands", "Phụ kiện, Hộp & Gridfinity"),
    ("/household", "Phụ kiện, Hộp & Gridfinity"),
    ("/mugs", "Phụ kiện, Hộp & Gridfinity"),
    ("/planters", "Phụ kiện, Hộp & Gridfinity"),
]


def list_drive(fid: str) -> list[tuple[str, str, bool]]:
    url = f"https://drive.google.com/embeddedfolderview?id={fid}#list"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    raw = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
    entries = []
    for m in re.finditer(r'<div class="flip-entry" id="entry-([^"]+)"', raw):
        chunk = raw[m.start():m.start() + 1500]
        tm = re.search(r'class="flip-entry-title">([^<]+)<', chunk)
        is_folder = "drive/folders/" in chunk
        if tm:
            entries.append((m.group(1), html.unescape(tm.group(1)), is_folder))
    return entries


def crawl_3mf(root_id: str, root_name: str, max_depth: int = 3) -> list[tuple[str, str, str]]:
    found: list[tuple[str, str, str]] = []
    queue = [(root_id, root_name, 0)]
    visited = {root_id}
    with ThreadPoolExecutor(max_workers=10) as ex:
        while queue:
            batch = queue[:30]
            queue = queue[30:]
            futs = [(ex.submit(list_drive, fid), path, depth) for fid, path, depth in batch]
            for fut, path, depth in futs:
                try:
                    items = fut.result()
                except Exception:
                    continue
                for cid, cname, is_dir in items:
                    if is_dir:
                        if depth < max_depth and cid not in visited and not cname.startswith("_t.me_"):
                            visited.add(cid)
                            queue.append((cid, f"{path}/{cname}", depth + 1))
                    elif cname.lower().endswith(".3mf"):
                        found.append((cid, cname, path))
    return found


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', "_", name).strip(" .")
    if not name.lower().endswith(".3mf"):
        name += ".3mf"
    return name


def pick_category(filename: str, drive_path: str) -> str:
    low_p = drive_path.lower()
    for substr, cat in DRIVE_PATH_CATEGORY_HINTS:
        if substr in low_p:
            return cat
    cat = build_catalog.suggest_category(filename + " " + drive_path)
    if cat == "Pokemon & Anime / Figure":
        return "Figure"
    return cat


def build_existing_3mf_hashes() -> set[tuple[int, str]]:
    seen: set[tuple[int, str]] = set()
    for p in DATA_3D.rglob("*.3mf"):
        if p.is_file():
            sz = p.stat().st_size
            if sz > 0:
                sig = dedup_index.full_sha256(p) if sz <= 100 * 1024 * 1024 else dedup_index.five_point_sig(p, sz)
                seen.add((sz, sig))
    return seen


def download_one(item: tuple[str, str, str]) -> tuple[str, str, str, Path | None, str | None]:
    fid, cname, dpath = item
    safe_fn = sanitize_filename(cname)
    tmp_path = TMP_DL / f"{fid}_{safe_fn}"
    urls = [
        f"https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t",
        f"https://drive.google.com/uc?export=download&confirm=t&id={fid}",
    ]
    last_err = None
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                ctype = (resp.headers.get("Content-Type") or "").lower()
                data_head = resp.read(4)
                if not data_head.startswith(b"PK") or "text/html" in ctype:
                    body_sample = (data_head + resp.read(2000)).decode("utf-8", errors="ignore").lower()
                    if "captcha" in body_sample or "unusual traffic" in body_sample or "sorry" in body_sample:
                        return fid, cname, dpath, None, "RATE_LIMIT_OR_GATE"
                    last_err = f"Not a valid 3MF/ZIP (ctype={ctype})"
                    continue
                with tmp_path.open("wb") as f:
                    f.write(data_head)
                    shutil.copyfileobj(resp, f, 256 * 1024)
            # Verify valid ZIP/3MF
            with zipfile.ZipFile(tmp_path) as z:
                _ = z.namelist()
            return fid, cname, dpath, tmp_path, None
        except urllib.error.HTTPError as he:
            last_err = f"HTTP {he.code}"
            if he.code in (403, 429):
                time.sleep(1.5)
        except Exception as exc:
            last_err = str(exc)
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
    return fid, cname, dpath, None, last_err or "Download failed"


def unique_dest(dest_dir: Path, filename: str) -> Path:
    dest = dest_dir / filename
    if not dest.exists():
        return dest
    stem = Path(filename).stem
    ext = Path(filename).suffix
    i = 2
    while (dest_dir / f"{stem} ({i}){ext}").exists():
        i += 1
    return dest_dir / f"{stem} ({i}){ext}"


def main() -> None:
    t0 = time.time()
    if TMP_DL.exists():
        shutil.rmtree(TMP_DL, ignore_errors=True)
    TMP_DL.mkdir(parents=True, exist_ok=True)

    print("Crawling Link 1 (PACK CLICKER)...")
    l1 = crawl_3mf(LINK1_ID, "PACK CLICKER", max_depth=3)
    print(f"  Found {len(l1)} .3mf in PACK CLICKER")

    print("Crawling Link 3 (big pack)...")
    l3 = crawl_3mf(LINK3_ID, "big pack", max_depth=3)
    print(f"  Found {len(l3)} .3mf in big pack")

    # Deduplicate by Drive file ID first
    by_fid: dict[str, tuple[str, str, str]] = {}
    for item in l1 + l3:
        by_fid.setdefault(item[0], item)
    queue = list(by_fid.values())
    print(f"Unique Drive .3mf file IDs to process: {len(queue)}")

    seen_hashes = build_existing_3mf_hashes()
    # Also track existing normalized filenames in D:\data3D for fast pre-skip?
    # Better to download & hash-check exact bytes so differently named versions aren't missed,
    # while skipping exact byte duplicates immediately!
    print(f"Existing .3mf hashes indexed: {len(seen_hashes)}")

    saved = 0
    saved_bytes = 0
    dedup_skipped = 0
    failed = 0
    gate_stopped = False
    pending_items = []
    cat_counts: dict[str, int] = {}

    batch_size = 24
    for start in range(0, len(queue), batch_size):
        free_d = shutil.disk_usage("D:\\").free
        if free_d < MIN_D_FREE_BYTES:
            print(f"Stopping early: D:\\ free space ({free_d/(1024**3):.2f} GB) reached safety floor (4 GB).")
            pending_items = queue[start:]
            break

        batch = queue[start:start + batch_size]
        with ThreadPoolExecutor(max_workers=6) as ex:
            futs = [ex.submit(download_one, it) for it in batch]
            for fut in as_completed(futs):
                fid, cname, dpath, tmp_path, err = fut.result()
                if err == "RATE_LIMIT_OR_GATE":
                    gate_stopped = True
                    pending_items.append((fid, cname, dpath))
                    continue
                if err or not tmp_path or not tmp_path.exists():
                    failed += 1
                    continue

                sz = tmp_path.stat().st_size
                if sz == 0:
                    tmp_path.unlink()
                    continue

                sig = dedup_index.full_sha256(tmp_path) if sz <= 100 * 1024 * 1024 else dedup_index.five_point_sig(tmp_path, sz)
                if (sz, sig) in seen_hashes:
                    tmp_path.unlink()
                    dedup_skipped += 1
                    continue

                if shutil.disk_usage("D:\\").free - sz < MIN_D_FREE_BYTES:
                    tmp_path.unlink()
                    pending_items.append((fid, cname, dpath))
                    continue

                cat = pick_category(cname, dpath)
                dest_dir = DATA_3D / cat
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest = unique_dest(dest_dir, sanitize_filename(cname))
                shutil.move(str(tmp_path), str(dest))
                seen_hashes.add((sz, sig))
                saved += 1
                saved_bytes += sz
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

        if gate_stopped:
            print("Stopped cleanly due to Google Drive rate-limit/gate.")
            pending_items.extend(queue[start + batch_size:])
            break

        done = min(start + batch_size, len(queue))
        if done % 96 == 0 or done == len(queue):
            free_gb = shutil.disk_usage("D:\\").free / (1024**3)
            print(f"  Progress: {done}/{len(queue)} | saved={saved} ({saved_bytes/(1024**3):.2f} GB) | dup_skip={dedup_skipped} | fail={failed} | D:free={free_gb:.2f} GB")

    if pending_items:
        MANIFEST_PENDING.write_text(json.dumps(pending_items, ensure_ascii=False, indent=2), encoding="utf-8")
    elif MANIFEST_PENDING.exists():
        MANIFEST_PENDING.unlink()

    if TMP_DL.exists():
        shutil.rmtree(TMP_DL, ignore_errors=True)

    summary = [
        f"Elapsed: {time.time() - t0:.1f}s",
        f"Total Drive .3mf queued: {len(queue)}",
        f"Saved unique .3mf: {saved} ({saved_bytes / (1024**3):.2f} GB)",
        f"Duplicates skipped (SHA-256): {dedup_skipped}",
        f"Failed/skipped non-3mf: {failed}",
        f"Pending remaining (saved to pending_drive_3mf.json): {len(pending_items)}",
        f"Stopped by Drive gate/rate-limit: {gate_stopped}",
        f"Free D:\\: {shutil.disk_usage('D:\\').free / (1024**3):.2f} GB",
        f"By category: {cat_counts}",
    ]
    LOG_OUT.write_text("\n".join(summary), encoding="utf-8")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
