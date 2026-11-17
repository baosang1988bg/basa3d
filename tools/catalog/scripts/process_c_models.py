#!/usr/bin/env python3
r"""
Processes D:\3D_Tu_O_C\:
1. Deletes confirmed 100% duplicates (Keychain_Stl_Bundle_0912, OBJ_Extracted_Folders, Sonic_Guildbook (1)).
2. Extracts Keychain1000_0912, Downloads_Telegram_3D, League_of_Legends_28 (.rar/.7z/.zip), and LINEAL_Cosplay_31parts
   via C:\_3dtmp_c\work\ (recursively up to depth 4).
3. Deduplicates every extracted .3mf and .stl/.obj/.glb against D:\data3D (via fingerprint_index.sqlite + exact hash)
   AND within the new batch.
4. Outputs ONLY unique new files into a clean separate folder D:\3D_Tu_O_C_Ready\:
   - 3MF_Moi\<Category>\
   - STL_Co_Anh_Moi\<SourceSet>\<Model>\
   - STL_Khong_Anh_Moi\<SourceSet>\<Model>\
   - Non3D_Moi\
"""

from __future__ import annotations

import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, r"D:\3D_Catalog")
import build_catalog
import dedup_index

SRC_ROOT = Path(r"D:\3D_Tu_O_C")
READY_ROOT = Path(r"D:\3D_Tu_O_C_Ready")
DATA_3D = Path(r"D:\data3D")
DB_PATH = Path(r"D:\3D_Catalog\fingerprint_index.sqlite")
STAGING = Path(r"C:\_3dtmp_c")
UNRAR_EXE = Path(r"C:\Program Files\WinRAR\UnRAR.exe")
LOG_FILE = Path(r"D:\3D_Catalog\process_c_report.txt")

MESH_EXTS = {".stl", ".obj", ".mtl", ".glb", ".3ds", ".ply"}
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".jfif"}
SKIP_JUNK = {".ds_store", "thumbs.db", "desktop.ini"}
MIN_D_FREE = 5 * 1024**3


def win_long(p: Path) -> str:
    s = str(p.resolve()) if not str(p).startswith("\\\\?\\") else str(p)
    if len(s) >= 240 and not s.startswith("\\\\?\\"):
        return "\\\\?\\" + s
    return s


def sanitize_name(name: str) -> str:
    name = re.sub(r"\s+adlı dosyanın kopyası$", "", name, flags=re.IGNORECASE)
    name = re.sub(r'[<>:"/\\|?*]', "_", name).strip(" .")
    return name or "unnamed"


def content_sig(fp: Path, size: int) -> str:
    if size <= 100 * 1024 * 1024:
        return dedup_index.full_sha256(fp)
    return dedup_index.five_point_sig(fp, size)


def detect_magic(fp: Path) -> str:
    try:
        with open(win_long(fp), "rb") as f:
            head = f.read(8)
        if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
            return "zip"
        if head.startswith(b"Rar!\x1a\x07"):
            return "rar"
        if head.startswith(b"7z\xbc\xaf\x27\x1c"):
            return "7z"
    except Exception:
        pass
    return ""


def is_3mf_zip_bytes(fp: Path) -> bool:
    try:
        with zipfile.ZipFile(win_long(fp)) as z:
            return any(n.lower() == "3d/3dmodel.model" or n.lower().endswith(".model") for n in z.namelist())
    except Exception:
        return False


def safe_extract_zip(zp: Path, out_dir: Path) -> None:
    os.makedirs(win_long(out_dir), exist_ok=True)
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
    os.makedirs(win_long(out_dir), exist_ok=True)
    res = subprocess.run([str(UNRAR_EXE), "x", "-o+", "-inul", "-p-", str(rp), str(out_dir) + "\\"], capture_output=True)
    return res.returncode == 0


def safe_extract_7z(p7: Path, out_dir: Path) -> bool:
    os.makedirs(win_long(out_dir), exist_ok=True)
    res = subprocess.run(["tar", "-xf", str(p7), "-C", str(out_dir)], capture_output=True)
    return res.returncode == 0


def extract_recursive(src_arch: Path, work_dir: Path) -> list[Path]:
    ext = src_arch.suffix.lower()
    magic = detect_magic(src_arch)
    if magic == "zip" or (ext == ".zip" and magic == ""):
        safe_extract_zip(src_arch, work_dir)
    elif magic == "rar" or ext == ".rar":
        if not safe_extract_rar(src_arch, work_dir):
            raise RuntimeError("UnRAR failed")
    elif magic == "7z" or ext == ".7z":
        if not safe_extract_7z(src_arch, work_dir):
            raise RuntimeError("tar 7z failed")
    else:
        raise RuntimeError(f"Unsupported archive format: {src_arch.name}")

    unextracted: list[Path] = []
    for _depth in range(4):
        nested: list[tuple[str, Path]] = []
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                fp = Path(root) / fn
                low = fn.lower()
                if low.endswith(".3mf"):
                    continue
                mg = detect_magic(fp)
                if mg == "zip":
                    if is_3mf_zip_bytes(fp):
                        new_fp = fp.with_suffix(".3mf")
                        if not Path(win_long(new_fp)).exists():
                            os.rename(win_long(fp), win_long(new_fp))
                    else:
                        nested.append(("zip", fp))
                elif mg == "rar" or low.endswith(".rar"):
                    nested.append(("rar", fp))
                elif mg == "7z" or low.endswith(".7z"):
                    nested.append(("7z", fp))

        if not nested:
            break
        for kind, afp in nested:
            stem = sanitize_name(re.sub(r"\.(zip|rar|7z)(\s+adlı dosyanın kopyası)?$", "", afp.name, flags=re.IGNORECASE))[:80].strip(" .") or "item"
            sub_dir = afp.parent / stem
            if sub_dir.exists() and sub_dir.is_file():
                sub_dir = afp.parent / (stem + "_ext")
            try:
                if kind == "zip":
                    safe_extract_zip(afp, sub_dir)
                    os.unlink(win_long(afp))
                elif kind == "rar":
                    if safe_extract_rar(afp, sub_dir):
                        os.unlink(win_long(afp))
                    else:
                        unextracted.append(afp)
                elif kind == "7z":
                    if safe_extract_7z(afp, sub_dir):
                        os.unlink(win_long(afp))
                    else:
                        unextracted.append(afp)
            except Exception:
                unextracted.append(afp)
    return unextracted


def unique_dest(dest_dir: Path, filename: str) -> Path:
    dest = dest_dir / filename
    if not Path(win_long(dest)).exists():
        return dest
    stem, ext = Path(filename).stem, Path(filename).suffix
    i = 2
    while Path(win_long(dest_dir / f"{stem} ({i}){ext}")).exists():
        i += 1
    return dest_dir / f"{stem} ({i}){ext}"


class DedupChecker:
    def __init__(self) -> None:
        self.conn = sqlite3.connect(str(DB_PATH))
        self.db_fast: dict[tuple[int, str], list[Path]] = {}
        for rel, sz, fsig in self.conn.execute("SELECT rel_path, size, fast_sig FROM files"):
            if sz > 0:
                self.db_fast.setdefault((sz, fsig), []).append(DATA_3D / rel)
        self.confirmed_cache: dict[Path, str] = {}
        self.new_seen: set[tuple[int, str]] = set()

    def is_duplicate(self, fp: Path, sz: int) -> bool:
        if sz == 0:
            return True
        fsig = dedup_index.fast_signature(fp, sz)
        # Check against D:\data3D via fast_sig + full confirmation
        db_matches = self.db_fast.get((sz, fsig))
        cand_full = None
        if db_matches:
            cand_full = content_sig(fp, sz)
            for existing_p in db_matches:
                if existing_p.exists():
                    ex_sig = self.confirmed_cache.get(existing_p)
                    if ex_sig is None:
                        ex_sig = content_sig(existing_p, sz)
                        self.confirmed_cache[existing_p] = ex_sig
                    if ex_sig == cand_full:
                        return True
        # Check against new files saved in this run
        if cand_full is None:
            cand_full = content_sig(fp, sz)
        if (sz, cand_full) in self.new_seen:
            return True
        self.new_seen.add((sz, cand_full))
        return False

    def close(self) -> None:
        self.conn.close()


def main() -> None:
    t0 = time.time()
    READY_ROOT.mkdir(parents=True, exist_ok=True)
    (READY_ROOT / "3MF_Moi").mkdir(exist_ok=True)
    (READY_ROOT / "STL_Co_Anh_Moi").mkdir(exist_ok=True)
    (READY_ROOT / "STL_Khong_Anh_Moi").mkdir(exist_ok=True)
    (READY_ROOT / "Non3D_Moi").mkdir(exist_ok=True)

    if STAGING.exists():
        shutil.rmtree(win_long(STAGING), ignore_errors=True)
    STAGING.mkdir(parents=True, exist_ok=True)

    # Step 1: Clean confirmed 100% duplicates from D:\3D_Tu_O_C\
    removed_dup_gb = 0.0
    for dup_dir_name in ("Keychain_Stl_Bundle_0912_12parts", "OBJ_Extracted_Folders"):
        d = SRC_ROOT / dup_dir_name
        if d.exists():
            sz = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
            shutil.rmtree(win_long(d))
            removed_dup_gb += sz / (1024**3)
            print(f"Deleted confirmed duplicate folder {dup_dir_name} ({sz/(1024**3):.2f} GB)")

    sonic1 = SRC_ROOT / "Other_3D" / "Sonic_Guildbook (1).zip"
    if sonic1.exists():
        sonic1.unlink()
    sonic0 = SRC_ROOT / "Other_3D" / "Sonic_Guildbook.zip"
    if sonic0.exists():
        shutil.move(str(sonic0), str(unique_dest(READY_ROOT / "Non3D_Moi", sonic0.name)))

    print(f"Step 1 complete: freed {removed_dup_gb:.2f} GB of exact duplicates. D:\\ free={shutil.disk_usage('D:\\\\').free/(1024**3):.2f} GB")

    checker = DedupChecker()
    stats = {
        "archives_ok": 0, "archives_failed": 0,
        "3mf_saved": 0, "3mf_dup": 0,
        "stl_co_anh_models": 0, "stl_khong_anh_models": 0,
        "mesh_files_saved": 0, "mesh_dup": 0,
        "img_saved": 0, "non3d_saved": 0, "unextracted": 0,
    }
    errors: list[str] = []

    # Gather remaining archives and standalone 3D files in D:\3D_Tu_O_C\
    sources = sorted([p for p in SRC_ROOT.rglob("*") if p.is_file()], key=lambda p: p.stat().st_size)
    print(f"Step 2: Processing {len(sources)} source files in D:\\3D_Tu_O_C\\...")

    for idx, src in enumerate(sources, 1):
        free_d = shutil.disk_usage("D:\\").free
        if free_d < MIN_D_FREE:
            errors.append(f"STOPPED EARLY at {idx}/{len(sources)}: D:\\ free < 5GB ({free_d/(1024**3):.2f} GB)")
            break

        src_set = src.relative_to(SRC_ROOT).parts[0] if len(src.relative_to(SRC_ROOT).parts) > 1 else "Misc"
        ext = src.suffix.lower()

        # Handle standalone .stl or .3mf directly
        if ext == ".3mf":
            sz = src.stat().st_size
            if checker.is_duplicate(src, sz):
                src.unlink()
                stats["3mf_dup"] += 1
            else:
                cat = build_catalog.suggest_category(src.name + " " + src_set)
                if cat == "Pokemon & Anime / Figure":
                    cat = "Figure"
                ddir = READY_ROOT / "3MF_Moi" / cat
                ddir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(unique_dest(ddir, src.name)))
                stats["3mf_saved"] += 1
            continue

        if ext in MESH_EXTS:
            sz = src.stat().st_size
            if checker.is_duplicate(src, sz):
                src.unlink()
                stats["mesh_dup"] += 1
            else:
                ddir = READY_ROOT / "STL_Khong_Anh_Moi" / src_set / sanitize_name(src.stem)
                ddir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(unique_dest(ddir, src.name)))
                stats["mesh_files_saved"] += 1
                stats["stl_khong_anh_models"] += 1
            continue

        # Extract archive into C:\_3dtmp_c\work\
        work_dir = STAGING / "work"
        if work_dir.exists():
            shutil.rmtree(win_long(work_dir), ignore_errors=True)
        work_dir.mkdir(parents=True, exist_ok=True)

        try:
            unextracted = extract_recursive(src, work_dir)
        except Exception as exc:
            stats["archives_failed"] += 1
            errors.append(f"FAILED {src.relative_to(SRC_ROOT)}: {exc}")
            shutil.rmtree(win_long(work_dir), ignore_errors=True)
            continue

        # Extraction succeeded -> delete source archive on D:\ to free space immediately
        src_stem = sanitize_name(src.stem)[:70].strip(" .")
        src.unlink()
        stats["archives_ok"] += 1

        for ufp in unextracted:
            if Path(win_long(ufp)).exists():
                udir = READY_ROOT / "_Unextracted"
                udir.mkdir(parents=True, exist_ok=True)
                shutil.move(win_long(ufp), win_long(unique_dest(udir, ufp.name)))
                stats["unextracted"] += 1

        # 1) Move all unique .3mf files first
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                fp = Path(root) / fn
                if fp.suffix.lower() == ".3mf":
                    sz = os.path.getsize(win_long(fp))
                    if checker.is_duplicate(fp, sz):
                        os.unlink(win_long(fp))
                        stats["3mf_dup"] += 1
                    else:
                        cat = build_catalog.suggest_category(fn + " " + str(fp.parent.name) + " " + src_set)
                        if cat == "Pokemon & Anime / Figure":
                            cat = "Figure"
                        ddir = READY_ROOT / "3MF_Moi" / cat
                        ddir.mkdir(parents=True, exist_ok=True)
                        shutil.move(win_long(fp), win_long(unique_dest(ddir, sanitize_name(fn))))
                        stats["3mf_saved"] += 1

        # 2) Group remaining STL/mesh files by model directory inside work_dir
        #    Note: for flat root files like Jax.jpg + jax.stl in LoL, group by stem or parent
        mesh_by_dir: dict[Path, list[Path]] = {}
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                fp = Path(root) / fn
                if fp.name.lower() in SKIP_JUNK:
                    continue
                if fp.suffix.lower() in MESH_EXTS:
                    mesh_by_dir.setdefault(fp.parent, []).append(fp)

        for mdir, mfiles in mesh_by_dir.items():
            # Deduplicate meshes in this directory
            unique_meshes: list[Path] = []
            for mf in mfiles:
                sz = os.path.getsize(win_long(mf))
                if checker.is_duplicate(mf, sz):
                    os.unlink(win_long(mf))
                    stats["mesh_dup"] += 1
                else:
                    unique_meshes.append(mf)
            if not unique_meshes:
                continue

            # Check if this model folder (or sibling/matching stem when at work_dir root) has preview images
            if mdir == work_dir:
                # Flat root in archive (like LoL): group each unique mesh by its stem so Jax.jpg pairs with jax.stl!
                root_imgs = {
                    f.stem.lower(): f for f in work_dir.iterdir()
                    if f.is_file() and f.suffix.lower() in IMG_EXTS
                }
                for mf in unique_meshes:
                    mstem = mf.stem.lower()
                    matched_img = root_imgs.get(mstem)
                    has_img = matched_img is not None
                    target_bucket = "STL_Co_Anh_Moi" if has_img else "STL_Khong_Anh_Moi"
                    dest_dir = READY_ROOT / target_bucket / src_set / sanitize_name(mf.stem)[:80]
                    os.makedirs(win_long(dest_dir), exist_ok=True)
                    shutil.move(win_long(mf), win_long(unique_dest(dest_dir, sanitize_name(mf.name))))
                    stats["mesh_files_saved"] += 1
                    if matched_img and Path(win_long(matched_img)).exists():
                        shutil.move(win_long(matched_img), win_long(unique_dest(dest_dir, sanitize_name(matched_img.name))))
                        stats["img_saved"] += 1
                    if has_img:
                        stats["stl_co_anh_models"] += 1
                    else:
                        stats["stl_khong_anh_models"] += 1
            else:
                # Nested model folder inside archive (e.g. LINEAL Cosplay/<Hero>/<Model> or Keychain1000/<Model>)
                dir_imgs = [f for f in mdir.iterdir() if f.is_file() and f.suffix.lower() in IMG_EXTS]
                # Also check 1 parent up inside work_dir (not work_dir itself) for Images/Renders folders
                if not dir_imgs and mdir.parent != work_dir:
                    for sub in mdir.parent.iterdir():
                        if sub.is_file() and sub.suffix.lower() in IMG_EXTS:
                            dir_imgs.append(sub)
                        elif sub.is_dir() and any(k in sub.name.lower() for k in ("image", "photo", "render", "pic")):
                            dir_imgs.extend([x for x in sub.rglob("*") if x.is_file() and x.suffix.lower() in IMG_EXTS][:5])

                has_img = len(dir_imgs) > 0
                target_bucket = "STL_Co_Anh_Moi" if has_img else "STL_Khong_Anh_Moi"
                rel_mdir = mdir.relative_to(work_dir)
                # Keep meaningful model folder path
                model_rel = Path(*rel_mdir.parts[:3]) if len(rel_mdir.parts) >= 2 else Path(src_stem, *rel_mdir.parts)
                dest_dir = READY_ROOT / target_bucket / src_set / model_rel
                os.makedirs(win_long(dest_dir), exist_ok=True)

                for mf in unique_meshes:
                    shutil.move(win_long(mf), win_long(unique_dest(dest_dir, sanitize_name(mf.name))))
                    stats["mesh_files_saved"] += 1
                for imf in dir_imgs:
                    if Path(win_long(imf)).exists():
                        shutil.copy2(win_long(imf), win_long(unique_dest(dest_dir, sanitize_name(imf.name))))
                        stats["img_saved"] += 1
                if has_img:
                    stats["stl_co_anh_models"] += 1
                else:
                    stats["stl_khong_anh_models"] += 1

        # 3) Save non-3D PDFs/videos from archive into Non3D_Moi (deduplicated)
        for root, _, files in os.walk(win_long(work_dir)):
            for fn in files:
                fp = Path(root) / fn
                if fp.suffix.lower() in (".pdf", ".mp4", ".mov"):
                    sz = os.path.getsize(win_long(fp))
                    if not checker.is_duplicate(fp, sz):
                        ndir = READY_ROOT / "Non3D_Moi" / src_set
                        ndir.mkdir(parents=True, exist_ok=True)
                        shutil.move(win_long(fp), win_long(unique_dest(ndir, sanitize_name(fn))))
                        stats["non3d_saved"] += 1

        shutil.rmtree(win_long(work_dir), ignore_errors=True)
        print(f"  [{idx}/{len(sources)}] {src.name} | 3mf+={stats['3mf_saved']}(dup:{stats['3mf_dup']}) | mesh+={stats['mesh_files_saved']}(dup:{stats['mesh_dup']}) | D:free={shutil.disk_usage('D:\\\\').free/(1024**3):.1f}GB")

    checker.close()
    if STAGING.exists():
        shutil.rmtree(win_long(STAGING), ignore_errors=True)

    # Remove empty dirs in D:\3D_Tu_O_C
    for d in sorted([p for p in SRC_ROOT.rglob("*") if p.is_dir()], key=lambda x: len(str(x)), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    if SRC_ROOT.exists() and not any(SRC_ROOT.iterdir()):
        SRC_ROOT.rmdir()

    lines = [
        f"Elapsed: {time.time() - t0:.1f}s",
        f"Removed pre-confirmed duplicates: {removed_dup_gb:.2f} GB",
        f"D:\\ free: {shutil.disk_usage('D:\\\\').free / (1024**3):.2f} GB",
        f"C:\\ free: {shutil.disk_usage('C:\\\\').free / (1024**3):.2f} GB",
        f"Stats: {stats}",
        f"Errors ({len(errors)}):",
        *errors[:30],
    ]
    LOG_FILE.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
