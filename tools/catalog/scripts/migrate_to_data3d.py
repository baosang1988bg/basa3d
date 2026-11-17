#!/usr/bin/env python3
r"""
Step 1: Move 3D files (~44.4 GB) from C:\Users\ADMIN\Downloads (+ Downloads\Telegram Desktop)
        into D:\Telegram Desktop (excluding LINEAL Cosplay, LoL 28GB rar, and 0912 duplicate Keychain bundles).
Step 2: Rename D:\Telegram Desktop -> D:\data3D.
Step 3: Organize files inside D:\data3D into category subfolders matching the Catalog.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import zipfile
from pathlib import Path

DL_DIR = Path(r"C:\Users\ADMIN\Downloads")
DL_TD_DIR = DL_DIR / "Telegram Desktop"
OLD_TD_DIR = Path(r"D:\Telegram Desktop")
DATA_3D_DIR = Path(r"D:\data3D")

EXTS_3D = {".3mf", ".stl", ".obj", ".mtl", ".glb", ".gcode"}
SMALL_RARS_3D = {"62 home decor stl and 3mf files.rar", "file 3D.rar"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
NON_3D_EXTS = {".pdf", ".docx", ".txt", ".mp4", ".arj", ".svg", ".001", ".002"}

CATEGORY_TO_FOLDER = {
    "Clicker & Keychain": "Clicker & Keychain",
    "Pokemon & Anime / Figure": "Pokemon & Anime - Figure",
    "Động vật & Flexi": "Động vật & Flexi",
    "Phụ kiện, Hộp & Gridfinity": "Phụ kiện, Hộp & Gridfinity",
    "Trang trí & Lễ hội": "Trang trí & Lễ hội",
    "Bộ nhiều mảnh (Multipart)": "Bộ nhiều mảnh (Multipart)",
    "Chưa phân loại": "Chưa phân loại",
    "Tài liệu / Ảnh lẻ (Non-3D)": "_Non3D_Archive",
}

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Clicker & Keychain", [
        "clicker", "clickable", "banh-clicker", "banhclicker", "keychain",
        "keyring", "keycap", "fidget", "pocketpals", "pocket pals", "moc khoa",
        "wantedstars", "botton", "botons",
    ]),
    ("Pokemon & Anime / Figure", [
        "pokemon", "chibi", "charizard", "venusaur", "blaziken", "arceus",
        "articuno", "dragonite", "groudon", "lugia", "treecko", "scyther",
        "beedrill", "arcanine", "geodude", "slowbro", "kingler", "weezing",
        "pinsir", "bellossom", "heracross", "glalie", "infernape", "pikachu",
        "gengar", "eevee", "mewtwo", "snorlax", "my melody", "my+melody",
        "kuromi", "cinnamoroll", "sanrio", "batman", "zoro", "luffy", "naruto",
        "ratatouille", "remy", "magnus the red", "anime", "figure", "cosplay",
        "jesus", "santa",
    ]),
    ("Động vật & Flexi", [
        "flexi", "dragon", "gecko", "hamster", "cat", "dog", "dino", "turtle",
        "octopus", "shark", "frog", "bear", "rabbit", "bunny", "bird", "arara",
        "animal", "snake", "lizard", "whale", "dolphin", "fox", "wolf", "lion",
        "patchpup", "reindeer", "rena", "ptacci",
    ]),
    ("Phụ kiện, Hộp & Gridfinity", [
        "gridfinity", "rugged", "drawer", "iphone", "case", "action+cam",
        "action cam", "gopro", "battery", "dock", "tray", "holder", "stand",
        "mount", "box", "organizer", "screw", "double_stacked", "double-height",
        "snapmaker", "intake", "pod", "airpods", "cable", "clip", "dumbbell",
        "garmin", "abridor", "cesto", "caixa", "planter",
    ]),
    ("Trang trí & Lễ hội", [
        "ornament", "wreath", "holly", "christmas", "noel", "xmas", "natal",
        "natale", "snowcookie", "nutcracker", "cay thong", "tuyet", "incense",
        "vela", "candle", "decor", "vase", "lamp", "cupcake", "religiosos",
        "cristal", "zodiac", "aries", "leo", "libra", "pisces", "taurus",
        "gemini", "cancer", "virgo", "scorpio", "sagittarius", "capricorn",
        "aquarius", "skull", "cherry blossom", "flower", "zvonky", "санта",
        "новогодн", "рождествен", "ёлки",
    ]),
    ("Bộ nhiều mảnh (Multipart)", [
        "multipart", "01_head", "02_chest", "03_body", "04_waist", "05_left",
        "06_right", "07_left", "08_right", "09_left", "10_shield", "_1m8",
    ]),
]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def is_3d_zip(fp: Path) -> bool:
    name = fp.name
    if name.startswith("LINEAL Cosplay"):
        return False
    if name.startswith("Keychain Stl Bundle -20260912"):
        return False
    if name.startswith("Keychain1000-20260912"):
        return False
    if name.startswith(("Keychain Stl Bundle -20260914", "Keychain1000-20260914")):
        return True
    try:
        with zipfile.ZipFile(fp) as z:
            return any(
                n.lower().endswith((".3mf", ".stl", ".obj", ".step", ".stp", ".glb", ".gcode", ".mtl"))
                for n in z.namelist()
            )
    except Exception:
        return False


def collect_download_candidates() -> list[Path]:
    files: list[Path] = []
    for p in sorted(DL_DIR.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext in EXTS_3D or p.name in SMALL_RARS_3D:
            files.append(p)
        elif ext == ".zip" and is_3d_zip(p):
            files.append(p)
    if DL_TD_DIR.is_dir():
        for p in sorted(DL_TD_DIR.iterdir(), key=lambda x: x.name.lower()):
            if p.is_file():
                files.append(p)
    return files


def safe_move_to_dir(src: Path, dest_dir: Path) -> tuple[str, Path | None]:
    dest = dest_dir / src.name
    if dest.exists():
        if src.stat().st_size == dest.stat().st_size and sha256(src) == sha256(dest):
            return "skipped_identical", None
        # Rename with (Downloads) suffix
        stem = src.stem
        ext = src.suffix
        i = 1
        while True:
            cand = dest_dir / (f"{stem} (Downloads){'' if i == 1 else f' ({i})'}{ext}")
            if not cand.exists():
                dest = cand
                break
            i += 1
    shutil.move(str(src), str(dest))
    return "moved", dest


def classify_file(fp: Path) -> str:
    ext = fp.suffix.lower()
    if ext in IMAGE_EXTS or ext in NON_3D_EXTS:
        return "_Non3D_Archive"

    extra = ""
    if ext == ".zip":
        try:
            with zipfile.ZipFile(fp) as z:
                extra = " ".join(z.namelist()[:15])
        except Exception:
            pass

    haystack = f"{fp.name} {extra}".lower().replace("_", " ").replace("+", " ")
    if re.search(r"\b\d{2}_(head|chest|body|waist|left|right|shield)\b", fp.name.lower()):
        return "Bộ nhiều mảnh (Multipart)"
    if re.match(r"^#\d{3,4}\b", fp.name.strip()):
        return "Pokemon & Anime - Figure"

    for cat, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in haystack:
                return CATEGORY_TO_FOLDER[cat]
    return "Chưa phân loại"


def main() -> None:
    if not OLD_TD_DIR.exists():
        raise SystemExit(f"Source directory not found: {OLD_TD_DIR}")
    if DATA_3D_DIR.exists():
        raise SystemExit(f"Target directory already exists: {DATA_3D_DIR}")

    candidates = collect_download_candidates()
    total_bytes = sum(p.stat().st_size for p in candidates)
    free_bytes = shutil.disk_usage("D:\\").free
    print(f"Candidates from Downloads: {len(candidates)} files, {total_bytes / (1024**3):.2f} GB")
    print(f"Free space on D:\\: {free_bytes / (1024**3):.2f} GB")
    if total_bytes > free_bytes - 5 * (1024**3):
        raise SystemExit("Aborting: insufficient free space margin (<5GB remaining after move).")

    moved = 0
    skipped = 0
    for src in candidates:
        status, _ = safe_move_to_dir(src, OLD_TD_DIR)
        if status == "moved":
            moved += 1
        else:
            skipped += 1
    print(f"Step 1 complete: moved={moved}, skipped_identical={skipped}")

    # Clean up empty Downloads\Telegram Desktop if everything inside moved
    if DL_TD_DIR.is_dir() and not any(DL_TD_DIR.iterdir()):
        DL_TD_DIR.rmdir()

    # Step 2: Rename D:\Telegram Desktop -> D:\data3D
    OLD_TD_DIR.rename(DATA_3D_DIR)
    print(f"Step 2 complete: renamed {OLD_TD_DIR} -> {DATA_3D_DIR}")

    # Step 3: Map files into category subfolders
    folder_counts: dict[str, int] = {}
    root_files = [p for p in DATA_3D_DIR.iterdir() if p.is_file()]
    for fp in root_files:
        folder = classify_file(fp)
        dest_dir = DATA_3D_DIR / folder
        dest_dir.mkdir(exist_ok=True)
        dest = dest_dir / fp.name
        if dest.exists():
            stem, ext = fp.stem, fp.suffix
            i = 2
            while (dest_dir / f"{stem} ({i}){ext}").exists():
                i += 1
            dest = dest_dir / f"{stem} ({i}){ext}"
        fp.rename(dest)
        folder_counts[folder] = folder_counts.get(folder, 0) + 1

    print("Step 3 complete! Mapped into D:\\data3D subfolders:")
    for k in sorted(folder_counts):
        print(f"  {k}: {folder_counts[k]}")


if __name__ == "__main__":
    main()
