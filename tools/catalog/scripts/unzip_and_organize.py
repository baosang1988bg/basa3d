#!/usr/bin/env python3
r"""
Unzip all .zip archives in D:\data3D (using C:\_3dtmp as staging so D:\ never overflows),
deduplicate exact files by size + SHA-256/5-point signature,
separate .3mf into category folders and .stl/.obj/.glb (+ previews) into D:\data3D\_STL_Library\,
and delete each .zip ONLY after error-free extraction.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

sys.path.insert(0, r"D:\3D_Catalog")
import build_catalog
import dedup_index

DATA_3D = Path(r"D:\data3D")
STL_LIB = DATA_3D / "_STL_Library"
NON_3D_DIR = DATA_3D / "_Non3D_Archive"
UNEXTRACTED_RAR_DIR = DATA_3D / "_Unextracted_RARs"
STAGING = Path(r"C:\_3dtmp")
UNRAR_EXE = Path(r"C:\Program Files\WinRAR\UnRAR.exe")
LOG_FILE = Path(r"D:\3D_Catalog\unzip_report.txt")

DISGUISED_3MF = {
    "juguete-interativo-stl3dbr.zip": "juguete-interativo-stl3dbr.3mf",
    "Porta Lacinhos Ursinho.zip": "Porta Lacinhos Ursinho.3mf",
    "siri.zip": "siri.3mf",
    "Sonic Homelander.3mf.zip": "Sonic Homelander.3mf",
}

KEEP_AS_NON3D_ZIPS = {
    "Chocolate_Chip_Cookie_Clicker.zip",
    "Flying Sea Turtle - 3758189 - part 2 of 2.zip",
    "IMAGES flexis.zip",
    "Strelizia Assembly.zip",
    "tatoos.zip",
    "Cielo_Roof_v1.82_ledcAttach_fix.zip",
    "designing_on_ipad_for_3d_printing_shapr3d_app_20260624T112527Z_3.zip",
    "designing_on_ipad_for_3d_printing_shapr3d_app_20260624T112527Z_3 (2).zip",
    "Download Files-20260721T044853Z-1-003.zip",
    "genty.zip",
    "lampa_4mm.zip",
    "McDonald s_Fries_Helmet.zip",
    "Tốt tự phong cơ khí-20260518T074744Z-3-002.zip",
    "vertical-garden-model_files.zip",
    "walking-chicken-print_files.zip",
    "Сборная_модель_карабина_M4_на_карточке.zip",
}

STL_EXTS = {".stl", ".obj", ".mtl", ".glb", ".3ds", ".ply"}
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"}
SKIP_JUNK_NAMES = {".ds_store", "thumbs.db", "desktop.ini"}
CHUNK = 64 * 1024


def win_long(p: Path) -> str:
    s = str(p.resolve()) if not str(p).startswith("\\\\?\\") else str(p)
    if len(s) >= 240 and not s.startswith("\\\\?\\"):
        return "\\\\?\\" + s
    return s


def content_sig(fp: Path, size: int) -> str:
    if size <= 100 * 1024 * 1024:
        return dedup_index.full_sha256(fp)
    return dedup_index.five_point_sig(fp, size)


def sanitize_name(name: str) -> str:
    # Remove trailing Turkish/Google copy artifacts and illegal Windows chars
    name = re.sub(r"\s+adlı dosyanın kopyası$", "", name, flags=re.IGNORECASE)
    name = re.sub(r'[<>:"/\\|?*]', "_", name).strip(" .")
    return name or "unnamed"


def is_3mf_zip_bytes(fp: Path) -> bool:
    try:
        with zipfile.ZipFile(win_long(fp)) as z:
            return any(
                n.lower() == "3d/3dmodel.model" or n.lower().endswith(".model")
                for n in z.namelist()
            )
    except Exception:
        return False


def detect_magic(fp: Path) -> str:
    try:
        with open(win_long(fp), "rb") as f:
            head = f.read(8)
        if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
            return "zip"
        if head.startswith(b"Rar!\x1a\x07"):
            return "rar"
    except Exception:
        pass
    return ""


def safe_extract_zip(zp: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    base_resolved = out_dir.resolve()
    with zipfile.ZipFile(win_long(zp)) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            raw_name = info.filename.replace("\\", "/")
            if "__MACOSX" in raw_name.split("/"):
                continue
            parts = [sanitize_name(pt) for pt in raw_name.split("/") if pt and pt not in (".", "..")]
            if not parts:
                continue
            # Keep path reasonably short on Windows without leaving trailing spaces/dots
            short_parts = [
                (pt[:70].strip(" .") if i < len(parts) - 1 else pt[:120].strip(" .")) or "item"
                for i, pt in enumerate(parts)
            ]
            dest = out_dir.joinpath(*short_parts)
            if not dest.resolve().is_relative_to(base_resolved):
                continue
            os.makedirs(win_long(dest.parent), exist_ok=True)
            with z.open(info, "r") as src, open(win_long(dest), "wb") as dst:
                shutil.copyfileobj(src, dst, 1024 * 1024)


def safe_extract_rar(rp: Path, out_dir: Path) -> bool:
    out_dir.mkdir(parents=True, exist_ok=True)
    res = subprocess.run(
        [str(UNRAR_EXE), "x", "-o+", "-inul", "-p-", str(rp), str(out_dir) + "\\"],
        capture_output=True,
    )
    return res.returncode == 0


def extract_recursive(outer_zip: Path, work_dir: Path) -> list[Path]:
    """Extract outer_zip and any nested zip/rar up to 4 levels deep. Returns unextracted RARs if any."""
    safe_extract_zip(outer_zip, work_dir)
    unextracted_rars: list[Path] = []

    for depth in range(4):
        nested_archives: list[tuple[str, Path]] = []
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                fp = Path(root) / fn
                low = fn.lower()
                # Skip real .3mf files (they are zip-based too)
                if low.endswith(".3mf"):
                    continue
                magic = detect_magic(fp)
                if magic == "zip":
                    if is_3mf_zip_bytes(fp):
                        # Disguised 3mf inside bundle! Rename to .3mf
                        new_fp = fp.with_suffix(".3mf")
                        if not Path(win_long(new_fp)).exists():
                            os.rename(win_long(fp), win_long(new_fp))
                    else:
                        nested_archives.append(("zip", fp))
                elif magic == "rar" or low.endswith(".rar"):
                    nested_archives.append(("rar", fp))

        if not nested_archives:
            break

        for kind, arch_fp in nested_archives:
            stem = sanitize_name(re.sub(r"\.(zip|rar)(\s+adlı dosyanın kopyası)?$", "", arch_fp.name, flags=re.IGNORECASE))[:80].strip(" .") or "item"
            sub_dir = arch_fp.parent / stem
            if sub_dir.exists() and sub_dir.is_file():
                sub_dir = arch_fp.parent / (stem + "_extracted")
            if kind == "zip":
                try:
                    safe_extract_zip(arch_fp, sub_dir)
                    os.unlink(win_long(arch_fp))
                except Exception:
                    unextracted_rars.append(arch_fp)
            elif kind == "rar":
                ok = safe_extract_rar(arch_fp, sub_dir)
                if ok:
                    os.unlink(win_long(arch_fp))
                else:
                    unextracted_rars.append(arch_fp)
    return unextracted_rars


def unique_dest(dest_dir: Path, filename: str) -> Path:
    dest = dest_dir / filename
    if not Path(win_long(dest)).exists():
        return dest
    stem = Path(filename).stem
    ext = Path(filename).suffix
    i = 2
    while True:
        cand = dest_dir / f"{stem} ({i}){ext}"
        if not Path(win_long(cand)).exists():
            return cand
        i += 1


def build_existing_hash_set() -> dict[tuple[int, str], Path]:
    """Index all existing non-zip 3D files in D:\\data3D to prevent duplicates."""
    seen: dict[tuple[int, str], Path] = {}
    for p in DATA_3D.rglob("*"):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext in (".3mf", ".stl", ".obj", ".glb", ".rar", ".7z"):
            sz = p.stat().st_size
            if sz > 0:
                sig = content_sig(p, sz)
                seen.setdefault((sz, sig), p)
    return seen


def clean_internal_dups_first() -> tuple[int, int]:
    """Remove exact duplicate standalone files already in D:\\data3D (keep shortest path)."""
    dedup_index.build_index(DATA_3D)
    groups = dedup_index.find_internal_duplicates(DATA_3D)
    removed = 0
    saved = 0
    for g in groups:
        # Sort shortest/cleanest path first (keep [0], delete [1:])
        files = sorted(g["files"], key=lambda s: (len(s), s.lower()))
        for rel in files[1:]:
            fp = DATA_3D / rel
            if fp.exists():
                sz = fp.stat().st_size
                fp.unlink()
                removed += 1
                saved += sz
    return removed, saved


def main() -> None:
    t0 = time.time()
    STL_LIB.mkdir(parents=True, exist_ok=True)
    NON_3D_DIR.mkdir(parents=True, exist_ok=True)
    if STAGING.exists():
        shutil.rmtree(win_long(STAGING), ignore_errors=True)
    STAGING.mkdir(parents=True, exist_ok=True)

    # Step 1: Fix 4 disguised .3mf.zip files
    renamed_3mf = 0
    for old_name, new_name in DISGUISED_3MF.items():
        for fp in DATA_3D.rglob(old_name):
            if fp.is_file():
                target = unique_dest(fp.parent, new_name)
                fp.rename(target)
                renamed_3mf += 1
    print(f"Step 1: Renamed disguised 3MF files: {renamed_3mf}")

    # Step 2: Move non-3D/video/CAD zips to _Non3D_Archive
    moved_non3d = 0
    for fp in list(DATA_3D.rglob("*.zip")):
        if fp.is_file() and fp.name in KEEP_AS_NON3D_ZIPS and "_Non3D_Archive" not in fp.parts:
            dest = unique_dest(NON_3D_DIR, fp.name)
            fp.rename(dest)
            moved_non3d += 1
    # Clean empty 11_Video_Courses_iPad_Shapr3D if empty
    vid_dir = DATA_3D / "_Bundles_Theo_Bo" / "11_Video_Courses_iPad_Shapr3D"
    if vid_dir.is_dir() and not any(vid_dir.iterdir()):
        vid_dir.rmdir()
    print(f"Step 2: Moved non-3D/video/CAD zips to _Non3D_Archive: {moved_non3d}")

    # Step 3: Remove exact duplicates already in D:\data3D
    dup_removed, dup_saved = clean_internal_dups_first()
    print(f"Step 3: Cleaned existing exact duplicates: {dup_removed} files ({dup_saved/(1024**3):.2f} GB)")

    # Step 4: Build in-memory hash table of existing files
    seen = build_existing_hash_set()
    print(f"Step 4: Indexed {len(seen)} unique existing files for dedup")

    # Gather remaining .zip files outside _Non3D_Archive, smallest first!
    zips = [
        p for p in DATA_3D.rglob("*.zip")
        if p.is_file() and "_Non3D_Archive" not in p.parts
    ]
    zips.sort(key=lambda p: p.stat().st_size)
    print(f"Step 5: Processing {len(zips)} .zip files ({sum(p.stat().st_size for p in zips)/(1024**3):.2f} GB)...")

    stats = {
        "zips_ok": 0,
        "zips_failed": 0,
        "3mf_saved": 0,
        "3mf_dedup": 0,
        "stl_saved": 0,
        "stl_dedup": 0,
        "img_saved": 0,
        "rar_preserved": 0,
        "other_moved": 0,
    }
    errors: list[str] = []

    for idx, zp in enumerate(zips, 1):
        free_d = shutil.disk_usage("D:\\").free
        if free_d < 4 * 1024**3:
            errors.append(f"STOPPED EARLY at {idx}/{len(zips)} ({zp.name}): D:\\ free space < 4 GB ({free_d/(1024**3):.2f} GB)")
            break

        work_dir = STAGING / "work"
        if work_dir.exists():
            shutil.rmtree(win_long(work_dir), ignore_errors=True)
        work_dir.mkdir(parents=True, exist_ok=True)

        try:
            unextracted_rars = extract_recursive(zp, work_dir)
        except Exception as exc:
            stats["zips_failed"] += 1
            errors.append(f"FAILED {zp.relative_to(DATA_3D)}: {exc}")
            shutil.rmtree(win_long(work_dir), ignore_errors=True)
            continue

        # Extraction succeeded! Delete outer .zip to free space on D:\ BEFORE copying extracted files back
        orig_rel = zp.relative_to(DATA_3D)
        orig_parts = orig_rel.parts
        orig_folder = orig_parts[0] if len(orig_parts) > 1 else ""
        orig_stem = sanitize_name(zp.stem)[:80]
        is_bundle = (orig_folder == "_Bundles_Theo_Bo")
        bundle_sub = orig_parts[1] if (is_bundle and len(orig_parts) > 2) else orig_stem

        # Remove outer zip now that verified extraction sits in C:\_3dtmp\work
        zp.unlink()
        stats["zips_ok"] += 1

        # Preserve any nested RARs that couldn't auto-extract
        for rfp in unextracted_rars:
            if Path(win_long(rfp)).exists():
                UNEXTRACTED_RAR_DIR.mkdir(parents=True, exist_ok=True)
                dest_rar = unique_dest(UNEXTRACTED_RAR_DIR, rfp.name)
                shutil.move(win_long(rfp), win_long(dest_rar))
                stats["rar_preserved"] += 1

        # Walk extracted files and route .3mf vs .stl/images
        extracted_files: list[Path] = []
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                extracted_files.append(Path(root) / fn)

        # Determine if this zip produced any STL/OBJ files
        for efp in extracted_files:
            fn = efp.name
            low = fn.lower()
            if low in SKIP_JUNK_NAMES:
                continue
            ext = efp.suffix.lower()
            try:
                sz = os.path.getsize(win_long(efp))
            except Exception:
                continue
            if sz == 0:
                continue

            if ext == ".3mf":
                sig = content_sig(efp, sz)
                key = (sz, sig)
                if key in seen:
                    stats["3mf_dedup"] += 1
                    continue
                # Determine category folder
                if orig_folder not in ("", "Chưa phân loại", "_ZIP_Chi_STL", "_Bundles_Theo_Bo"):
                    cat = orig_folder
                else:
                    cat = build_catalog.suggest_category(fn + " " + orig_stem)
                    if cat == "Pokemon & Anime / Figure":
                        cat = "Figure"
                cat_dir = DATA_3D / cat
                cat_dir.mkdir(parents=True, exist_ok=True)
                dest = unique_dest(cat_dir, sanitize_name(fn))
                shutil.move(win_long(efp), win_long(dest))
                seen[key] = dest
                stats["3mf_saved"] += 1

            elif ext in STL_EXTS:
                sig = content_sig(efp, sz)
                key = (sz, sig)
                if key in seen:
                    stats["stl_dedup"] += 1
                    continue
                rel_in_work = efp.relative_to(work_dir)
                parent_parts = rel_in_work.parts[:-1]
                if is_bundle:
                    sub_rel = Path(bundle_sub, *parent_parts[:3])
                else:
                    sub_rel = Path(orig_stem, *parent_parts[:2])
                dest_dir = STL_LIB / sub_rel
                os.makedirs(win_long(dest_dir), exist_ok=True)
                dest = unique_dest(dest_dir, sanitize_name(fn))
                shutil.move(win_long(efp), win_long(dest))
                seen[key] = dest
                stats["stl_saved"] += 1

            elif ext in IMG_EXTS:
                # Keep preview images alongside STL folder ONLY if an STL folder exists or was created for this zip
                rel_in_work = efp.relative_to(work_dir)
                parent_parts = rel_in_work.parts[:-1]
                sub_rel = Path(bundle_sub, *parent_parts[:3]) if is_bundle else Path(orig_stem, *parent_parts[:2])
                dest_dir = STL_LIB / sub_rel
                # Check if sibling stl exists in work_dir or dest_dir already exists
                if dest_dir.exists() or any(p.suffix.lower() in STL_EXTS for p in extracted_files):
                    os.makedirs(win_long(dest_dir), exist_ok=True)
                    dest = unique_dest(dest_dir, sanitize_name(fn))
                    shutil.move(win_long(efp), win_long(dest))
                    stats["img_saved"] += 1

            elif ext in (".mp4", ".mov", ".avi", ".pdf"):
                # Save PDFs/videos only if meaningful (skip tiny promo junk, put in _Non3D_Archive)
                dest_dir = NON_3D_DIR / ("Bundle_Docs" if ext == ".pdf" else "Bundle_Videos")
                dest_dir.mkdir(parents=True, exist_ok=True)
                sig = content_sig(efp, sz)
                if (sz, sig) not in seen:
                    dest = unique_dest(dest_dir, sanitize_name(fn))
                    shutil.move(win_long(efp), win_long(dest))
                    seen[(sz, sig)] = dest
                    stats["other_moved"] += 1

        shutil.rmtree(win_long(work_dir), ignore_errors=True)
        if idx % 50 == 0 or idx == len(zips):
            free_gb = shutil.disk_usage("D:\\").free / (1024**3)
            print(f"  Progress: {idx}/{len(zips)} | 3mf={stats['3mf_saved']}(dup:{stats['3mf_dedup']}) | stl={stats['stl_saved']}(dup:{stats['stl_dedup']}) | D:free={free_gb:.1f}GB")

    # Clean empty folders inside _ZIP_Chi_STL and _Bundles_Theo_Bo
    for clean_root in (DATA_3D / "_ZIP_Chi_STL", DATA_3D / "_Bundles_Theo_Bo"):
        if clean_root.exists():
            for d in sorted([p for p in clean_root.rglob("*") if p.is_dir()], key=lambda x: len(str(x)), reverse=True):
                if not any(d.iterdir()):
                    d.rmdir()
            if not any(clean_root.iterdir()):
                clean_root.rmdir()

    if STAGING.exists():
        shutil.rmtree(win_long(STAGING), ignore_errors=True)

    summary = [
        f"Elapsed: {time.time() - t0:.1f}s",
        f"Free D:\\: {shutil.disk_usage('D:\\').free / (1024**3):.2f} GB",
        f"Stats: {stats}",
        f"Errors ({len(errors)}):",
        *errors[:30],
    ]
    LOG_FILE.write_text("\n".join(summary), encoding="utf-8")
    print("\n".join(summary))


if __name__ == "__main__":
    main()
