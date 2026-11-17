#!/usr/bin/env python3
r"""
BaSa3D / data3D Catalog Builder (Read-Only on D:\data3D).
Scans D:\data3D recursively (across category subfolders), extracts preview thumbnails
from .3mf and .zip files, reads 3MF metadata, and builds an offline-ready
interactive HTML gallery at D:\3D_Catalog\catalog.html.
"""

from __future__ import annotations

import datetime
import hashlib
import io
import json
import os
import re
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

import mesh_metrics_3d

REPO_DIR = Path(__file__).resolve().parent.parent.parent
SOURCE_DIR = Path(os.environ.get("CATALOG_DATA_DIR", r"D:\data3D")).resolve()
OUT_DIR = Path(os.environ.get("CATALOG_OUT_DIR", str(REPO_DIR / ".catalog-data"))).resolve()
THUMBS_DIR = OUT_DIR / "thumbs"
DATA_JS = OUT_DIR / "catalog_data.js"
DATA_JSON = OUT_DIR / "catalog_data.json"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
MODEL_3D_EXTS = {".3mf", ".stl", ".obj", ".mtl", ".glb", ".nom", ".gcode", ".zip", ".rar", ".7z"}
NON_3D_EXTS = {".pdf", ".docx", ".txt", ".mp4", ".arj", ".svg", ".001", ".002"}

FOLDER_TO_CATEGORY = {
    "_Non3D_Archive": "Tài liệu / Ảnh lẻ (Non-3D)",
}

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Clicker", [
        "clicker", "clicky", "clickey", "klicker", "clickable", "clickify",
        "banh-clicker", "banhclicker", "keycap", "clicador", "cliker",
        "push botton", "push button", "botons",
    ]),
    ("Pokemon", [
        "pokemon", "pikachu", "charizard", "venusaur", "blaziken", "arceus",
        "articuno", "dragonite", "groudon", "lugia", "treecko", "scyther",
        "beedrill", "arcanine", "geodude", "slowbro", "kingler", "weezing",
        "pinsir", "bellossom", "heracross", "glalie", "infernape", "gengar",
        "eevee", "mewtwo", "mew", "snorlax", "rayquaza", "moltres", "mudkip",
        "oshawott", "palkia", "piplup", "regirock", "registeel", "reshiram",
        "snivy", "tepig", "torchic", "turtwig", "zapdos", "zekrom", "dialga",
        "hoopa", "cosmog", "necrozma", "grookey", "scorbunny", "sobble",
        "appletun", "mr mime", "charmeleon",
    ]),
    ("Anime", [
        "anime", "zoro", "luffy", "one piece", "pirate king", "naruto",
        "my melody", "my+melody", "kuromi", "cinnamoroll", "sanrio",
        "rengozard", "katana",
    ]),
    ("Figure", [
        "figure", "figurine", "chibi", "batman", "marvel", "emma frost",
        "magnus the red", "ratatouille", "remy", "cosplay", "mario",
        "jesus", "santa", "фигурка", "санта",
    ]),
    ("Động vật & Flexi", [
        "flexi", "flexy", "articulated", "articulating", "dragon", "gecko", "hamster",
        "cat", "dog", "dino", "turtle", "octopus", "shark", "frog", "bear", "rabbit",
        "bunny", "bird", "arara", "animal", "snake", "lizard", "whale", "dolphin",
        "fox", "wolf", "lion", "patchpup", "reindeer", "rena", "ptacci", "axolotl",
        "capybara", "otter", "chameleon", "iguana", "penguin", "rhea", "platypus",
    ]),
    ("Keychain", [
        "keychain", "keyring", "llavero", "moc khoa", "pocketpal", "backpack buddy",
        "backpack buddies", "portachiavi", "wantedstars", "挂件", "挂饰",
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


def safe_id(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8", errors="ignore")).hexdigest()[:12]


def suggest_category(filename: str, extra_text: str = "") -> str:
    haystack = f"{filename} {extra_text}".lower().replace("_", " ").replace("+", " ")
    if re.search(r"\b\d{2}_(head|chest|body|waist|left|right|shield)\b", filename.lower()):
        return "Bộ nhiều mảnh (Multipart)"
    if re.match(r"^#\d{3,4}\b", filename.strip()):
        return "Pokemon"
    for cat, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in haystack:
                return cat
    return "Chưa phân loại"


def save_image_bytes(data: bytes, target_path: Path) -> bool:
    if not data or len(data) < 200:
        return False
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(data)
    return True


def pick_best_3mf_images(names: list[str]) -> tuple[str | None, str | None]:
    model_pics = sorted([
        n for n in names
        if n.startswith("Auxiliaries/Model Pictures/")
        and Path(n).suffix.lower() in IMAGE_EXTS
    ])
    aux_thumbs = sorted([
        n for n in names
        if n.startswith("Auxiliaries/.thumbnails/")
        and Path(n).suffix.lower() in IMAGE_EXTS
    ])
    plate_imgs = [
        n for n in [
            "Metadata/plate_1.png",
            "Metadata/plate_1_small.png",
            "Metadata/top_1.png",
            "Metadata/pick_1.png",
            "Metadata/plate_no_light_1.png",
        ]
        if n in names
    ]
    if not plate_imgs:
        plate_imgs = sorted([
            n for n in names
            if n.startswith("Metadata/") and Path(n).suffix.lower() in IMAGE_EXTS
        ])
    any_imgs = sorted([
        n for n in names
        if Path(n).suffix.lower() in IMAGE_EXTS and "__MACOSX" not in n
    ])

    plate_entry = plate_imgs[0] if plate_imgs else None
    if model_pics:
        primary = model_pics[0]
    elif plate_entry:
        primary = plate_entry
    elif aux_thumbs:
        primary = aux_thumbs[0]
    elif any_imgs:
        primary = any_imgs[0]
    else:
        primary = None

    if primary == plate_entry:
        plate_entry = None
    return primary, plate_entry


def parse_3mf_metadata(z: zipfile.ZipFile, names: list[str]) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    plate_count = len([
        n for n in names
        if re.match(r"^Metadata/plate_\d+\.png$", n, re.IGNORECASE)
    ])
    if plate_count:
        meta["plates"] = plate_count

    if "Metadata/project_settings.config" in names:
        try:
            raw = z.read("Metadata/project_settings.config").decode("utf-8", errors="ignore")
            cfg = json.loads(raw)
            if isinstance(cfg, dict):
                if cfg.get("printer_model"):
                    meta["printer"] = cfg["printer_model"]
                if cfg.get("filament_type"):
                    ft = cfg["filament_type"]
                    meta["filament"] = sorted(set(ft)) if isinstance(ft, list) else [str(ft)]
                if cfg.get("filament_colour"):
                    fc = cfg["filament_colour"]
                    if isinstance(fc, list):
                        meta["colors"] = [c for c in fc if isinstance(c, str) and c.startswith("#")][:8]
        except Exception:
            pass

    if "3D/3dmodel.model" in names:
        try:
            head = z.read("3D/3dmodel.model")[:6000].decode("utf-8", errors="ignore")
            for key in ("Title", "Designer", "Application"):
                m = re.search(rf'<metadata\s+name="{key}">([^<]+)</metadata>', head)
                if m and m.group(1).strip():
                    meta[key.lower()] = m.group(1).strip()
        except Exception:
            pass
    return meta


def process_3mf_zip(z: zipfile.ZipFile, item_id: str) -> tuple[str | None, str | None, dict[str, Any]]:
    names = z.namelist()
    primary_entry, plate_entry = pick_best_3mf_images(names)
    meta = parse_3mf_metadata(z, names)

    thumb_rel = None
    plate_rel = None
    if primary_entry:
        ext = Path(primary_entry).suffix.lower() or ".png"
        out_p = THUMBS_DIR / f"{item_id}_main{ext}"
        try:
            if save_image_bytes(z.read(primary_entry), out_p):
                thumb_rel = f"thumbs/{out_p.name}"
        except Exception:
            pass

    if plate_entry:
        ext = Path(plate_entry).suffix.lower() or ".png"
        out_p = THUMBS_DIR / f"{item_id}_plate{ext}"
        try:
            if save_image_bytes(z.read(plate_entry), out_p):
                plate_rel = f"thumbs/{out_p.name}"
        except Exception:
            pass

    return thumb_rel, plate_rel, meta


def pick_best_zip_image(img_names: list[str]) -> str | None:
    if not img_names:
        return None
    scored: list[tuple[int, str]] = []
    for n in img_names:
        low = n.lower()
        score = 0
        if "thumb" in low or "preview" in low or "cover" in low or "render" in low or "photo" in low:
            score -= 5
        if "qr" in low or "logo" in low or "banner" in low or "license" in low:
            score += 10
        scored.append((score, n))
    scored.sort(key=lambda x: (x[0], len(x[1])))
    return scored[0][1]


def classify_zip_contents(fp: Path, size_bytes: int) -> tuple[str, list[str], str | None]:
    if size_bytes == 0:
        return "empty_0b", [], "File 0 Byte (trống)"
    try:
        with zipfile.ZipFile(fp) as z:
            names = [n for n in z.namelist() if "__MACOSX" not in n and not n.endswith("/")]
            exts = sorted({Path(n).suffix.lower() for n in names if Path(n).suffix})
            has_3mf = ".3mf" in exts
            has_stl = ".stl" in exts
            has_obj = ".obj" in exts or ".glb" in exts
            has_nested = any(e in exts for e in (".zip", ".rar", ".7z"))
            has_img = any(e in IMAGE_EXTS for e in exts)
            is_disguised_3mf = ("3D/3dmodel.model" in names or ".model" in exts) and not has_3mf and not has_stl

            if has_nested:
                return "nested_archive", exts[:10], None
            if has_3mf and has_stl:
                return "both_3mf_stl", exts[:10], None
            if has_3mf:
                return "has_3mf", exts[:10], None
            if has_stl:
                return "stl_only", exts[:10], None
            if is_disguised_3mf:
                return "disguised_3mf", exts[:10], None
            if has_obj:
                return "obj_glb", exts[:10], None
            if has_img and not any(e in exts for e in (".step", ".stp", ".sldprt", ".shapr", ".dxf", ".ino", ".cpp", ".pdf", ".otf", ".ttf")):
                return "images_only", exts[:10], None
            return "cad_code_other", exts[:10], None
    except Exception as exc:
        return "corrupt_zip", [], str(exc)


MULTI_MODEL_PACK_DIRS = {
    "flexionr",
    "074401_pod_glass_templates",
    "backpack buddies",
    "kit varinhas magicas de natal",
    "pudding,_chocolate_strawberry,_pancake",
    "3-animals clicker",
    "halloween cookie  clicker",
    "fichas casino clicker llavero",
    "621.лампа",
    "file 3d",
    "flower clicker",
    "flower_clicker",
    "bunny+carrot klicker",
}

STL_PACK_ROOTS = {
    "lineal_cosplay_31parts",
    "09_heavy_single_bundles",
    "04_00commercial_use_7parts",
    "league_of_legends_28",
    "08_drive_download_20260702_9parts",
    "gobots-20261104t125606z-1-001",
    "06_antistress_3parts",
    "robot-20261104t124744z-1-001",
    "02_keychain_stl_bundle_12parts",
    "christmas clickers bundle",
    "bellyboos round2 upd01",
    "bellyboos rounud 1-upd01",
    "3-animals clicker",
    "flower clicker",
    "flexionr",
    "01_stl_only_heavy",
    "03_keychain1000_8parts",
    "bunny+carrot klicker",
    "flexi_guinea_pigs_cage",
    "flexi_penguin_playset",
    "pirate king card",
    "witch hat clicker",
}

TECH_LEAF_DIRS = {
    "files", "file", "stl", "stls", "stl files", "02. files", "models",
    "supported", "pre-supported", "presupported", "unsupported", "hollow",
    "hollowed", "split", "unsplit", "cut", "cuts", "uncut", "parts",
    "monocolor", "multicolor", "multiparts", "extras", "-extras",
}


def _compute_print_info_worker(task: tuple[int, str, str, dict[str, Any]]) -> tuple[int, dict[str, Any]]:
    idx, kind, rel_path, meta = task
    fp = SOURCE_DIR / rel_path
    if kind == "3mf":
        return idx, mesh_metrics_3d.extract_3mf_print_info(fp, meta)
    elif kind == "stl_bundle":
        stls = [
            f for f in fp.rglob("*")
            if f.is_file() and f.suffix.lower() == ".stl"
        ] if fp.is_dir() else []
        return idx, mesh_metrics_3d.extract_stl_bundle_print_info(stls)
    return idx, {}


def _resolve_stl_bundle_root(p_dir: Path, stl_lib_dir: Path) -> Path:
    rel_parts = p_dir.relative_to(stl_lib_dir).parts
    if not rel_parts:
        return p_dir
    top = rel_parts[0]
    # Single-model folders: always collapse to _STL_Co_Anh/<TopModel>
    if top.lower() not in STL_PACK_ROOTS:
        return stl_lib_dir / top
    # Pack folders: keep individual character/model subfolder, stripping only trailing technical dirs
    cur = p_dir
    while len(cur.relative_to(stl_lib_dir).parts) > 2:
        low = cur.name.lower().strip()
        if low in TECH_LEAF_DIRS or low.startswith("stls") or low.endswith(" stl"):
            cur = cur.parent
        else:
            break
    # If pack had an extra wrapper (e.g. Pack/SubCategory/ModelName/Supported), still avoid collapsing Pack root itself
    if len(cur.relative_to(stl_lib_dir).parts) == 1:
        return p_dir
    return cur


def _group_3mf_bundles(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_dir: dict[str, list[dict[str, Any]]] = {}
    passthrough: list[dict[str, Any]] = []

    for it in items:
        if it.get("kind") != "3mf":
            passthrough.append(it)
            continue
        rel = it.get("relPath") or it["name"]
        parts = rel.split("/")
        if len(parts) < 3:
            passthrough.append(it)
            continue
        # Group by <Category>/<ModelSubfolder> (depth-2 under D:\data3D)
        cluster_rel = "/".join(parts[:2])
        folder_title = parts[1]
        if folder_title.lower().strip() in MULTI_MODEL_PACK_DIRS:
            passthrough.append(it)
            continue
        by_dir.setdefault(cluster_rel, []).append(it)

    bundled: list[dict[str, Any]] = []
    for cluster_rel, children in by_dir.items():
        if len(children) < 2:
            bundled.extend(children)
            continue
        children_sorted = sorted(children, key=lambda c: c["name"].lower())
        parts = cluster_rel.split("/")
        folder_top = parts[0]
        title = parts[1]
        total_size = sum(int(c.get("size") or 0) for c in children_sorted)
        latest_mtime = max((c.get("mtime") or "" for c in children_sorted), default="")
        thumb = next((c.get("thumb") for c in children_sorted if c.get("thumb")), None)
        plate_thumb = next((c.get("plateThumb") for c in children_sorted if c.get("plateThumb")), None)

        colors: list[str] = []
        seen_c: set[str] = set()
        designers: list[str] = []
        printers: list[str] = []
        total_plates = 0
        for c in children_sorted:
            cm = c.get("meta") or {}
            total_plates += int(cm.get("plates") or 0)
            if cm.get("designer") and cm["designer"] not in designers:
                designers.append(cm["designer"])
            if cm.get("printer") and cm["printer"] not in printers:
                printers.append(cm["printer"])
            for col in (cm.get("colors") or []):
                if col not in seen_c and len(colors) < 8:
                    seen_c.add(col)
                    colors.append(col)

        # Representative printInfo (prefer SLICED, else first valid MESH_ESTIMATE) for sorting/filtering
        rep_pi = next(
            (
                (c.get("meta") or {}).get("printInfo")
                for c in children_sorted
                if (c.get("meta") or {}).get("printInfo", {}).get("source") == "SLICED"
            ),
            None,
        ) or next(
            (
                (c.get("meta") or {}).get("printInfo")
                for c in children_sorted
                if (c.get("meta") or {}).get("printInfo", {}).get("source") == "MESH_ESTIMATE"
            ),
            None,
        )

        bundle_entries = [
            {
                "id": c["id"],
                "name": c["name"],
                "relPath": c.get("relPath") or c["name"],
                "size": c.get("size") or 0,
                "mtime": c.get("mtime") or "",
                "thumb": c.get("thumb"),
                "plateThumb": c.get("plateThumb"),
                "plates": (c.get("meta") or {}).get("plates"),
                "printInfo": (c.get("meta") or {}).get("printInfo"),
            }
            for c in children_sorted
        ]

        b_meta: dict[str, Any] = {
            "bundleItems": bundle_entries,
            "inner3mf": len(children_sorted),
        }
        if total_plates:
            b_meta["plates"] = total_plates
        if colors:
            b_meta["colors"] = colors
        if designers:
            b_meta["designer"] = designers[0]
        if printers:
            b_meta["printer"] = printers[0]
        if rep_pi:
            b_meta["printInfo"] = rep_pi

        bundled.append({
            "id": safe_id(cluster_rel),
            "name": title,
            "relPath": cluster_rel,
            "folder": folder_top,
            "ext": ".3mf",
            "kind": "3mf_bundle",
            "size": total_size,
            "mtime": latest_mtime,
            "category": FOLDER_TO_CATEGORY.get(folder_top, folder_top),
            "isDup": any(c.get("isDup") for c in children_sorted),
            "thumb": thumb,
            "plateThumb": plate_thumb,
            "meta": b_meta,
            "containedCount": len(children_sorted),
            "containedSample": [c["name"] for c in children_sorted[:20]],
            "error": None,
        })

    return passthrough + bundled


def _link_cross_format_siblings(items: list[dict[str, Any]]) -> None:
    def norm_key(name: str) -> str:
        s = re.sub(r"\.(3mf|stl)$", "", name, flags=re.I)
        s = re.sub(r"[^a-z0-9]+", "", s.lower())
        return s

    stl_map: dict[str, dict[str, Any]] = {}
    tmf_map: dict[str, dict[str, Any]] = {}
    for it in items:
        k = it.get("kind")
        nk = norm_key(it.get("name") or "")
        if len(nk) < 6:
            continue
        if k == "stl_bundle":
            stl_map.setdefault(nk, it)
        elif k in ("3mf", "3mf_bundle"):
            # Prefer 3mf_bundle over individual 3mf if same key
            if nk not in tmf_map or k == "3mf_bundle":
                tmf_map[nk] = it

    for nk, t_item in tmf_map.items():
        s_item = stl_map.get(nk)
        if s_item:
            t_item.setdefault("meta", {})["siblingRef"] = {"id": s_item["id"], "name": s_item["name"], "relPath": s_item["relPath"], "kind": "STL"}
            s_item.setdefault("meta", {})["siblingRef"] = {"id": t_item["id"], "name": t_item["name"], "relPath": t_item["relPath"], "kind": "3MF"}


def build() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Source directory not found: {SOURCE_DIR}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    # Index cached rows by (filename|size|mtime) so moved files keep their cached thumbs!
    prev_by_sig: dict[str, dict[str, Any]] = {}
    if DATA_JSON.exists():
        try:
            old = json.loads(DATA_JSON.read_text(encoding="utf-8"))
            for row in old:
                if row.get("kind") == "3mf_bundle":
                    for sub in (row.get("meta") or {}).get("bundleItems") or []:
                        sub_row = {
                            "id": sub.get("id"),
                            "name": sub.get("name"),
                            "relPath": sub.get("relPath"),
                            "size": sub.get("size"),
                            "mtime": sub.get("mtime"),
                            "ext": ".3mf",
                            "kind": "3mf",
                            "thumb": sub.get("thumb"),
                            "plateThumb": sub.get("plateThumb"),
                            "meta": {k: v for k, v in {
                                "plates": sub.get("plates"),
                                "printInfo": sub.get("printInfo"),
                            }.items() if v is not None},
                            "containedCount": 0,
                            "containedSample": [],
                            "error": None,
                        }
                        prev_by_sig[f"{sub_row['name']}|{sub_row['size']}|{sub_row['mtime']}"] = sub_row
                else:
                    prev_by_sig[f"{row['name']}|{row['size']}|{row['mtime']}"] = row
        except Exception:
            pass

    stl_roots = {"_STL_Library", "_STL_Co_Anh", "_STL_Khong_Anh"}
    all_files = sorted(
        [
            p for p in SOURCE_DIR.rglob("*")
            if p.is_file()
            and p.name != "_README_Parts.txt"
            and not any(r in stl_roots for r in p.relative_to(SOURCE_DIR).parts[:1])
        ],
        key=lambda p: p.name.lower(),
    )

    # Index image files by stem across source (excluding _STL_Library)
    images_by_stem: dict[str, Path] = {}
    for fp in all_files:
        if fp.suffix.lower() in IMAGE_EXTS:
            images_by_stem[fp.stem.lower()] = fp

    items: list[dict[str, Any]] = []
    stats = {"cached": 0, "new": 0}

    for fp in all_files:
        rel_path = fp.relative_to(SOURCE_DIR).as_posix()
        parts = fp.relative_to(SOURCE_DIR).parts
        folder = parts[0] if len(parts) > 1 else ""
        fn = fp.name
        st = fp.stat()
        ext = fp.suffix.lower()
        mtime_iso = datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
        sig_key = f"{fn}|{st.st_size}|{mtime_iso}"

        if folder:
            folder_cat = FOLDER_TO_CATEGORY.get(folder, folder)
        else:
            folder_cat = None

        is_dup = False
        if re.search(r"\(\d+\)\.[^.]+$", fn):
            base_stem = re.sub(r"\s*\(\d+\)$", "", fp.stem).strip()
            if (fp.parent / f"{base_stem}{ext}").exists() and base_stem != fp.stem:
                is_dup = True

        # Reuse cached thumb/metadata if unchanged signature
        if sig_key in prev_by_sig:
            cached = dict(prev_by_sig[sig_key])
            t_ok = (not cached.get("thumb")) or (OUT_DIR / cached["thumb"]).exists()
            p_ok = (not cached.get("plateThumb")) or (OUT_DIR / cached["plateThumb"]).exists()
            if t_ok and p_ok:
                cached["relPath"] = rel_path
                cached["folder"] = folder
                cached["isDup"] = is_dup
                if folder_cat:
                    cached["category"] = folder_cat
                if ext == ".zip" and "zipKind" not in (cached.get("meta") or {}):
                    zk, zexts, zerr = classify_zip_contents(fp, st.st_size)
                    cached.setdefault("meta", {})["zipKind"] = zk
                    cached["meta"]["zipExts"] = zexts
                    if zerr and not cached.get("error"):
                        cached["error"] = zerr
                items.append(cached)
                stats["cached"] += 1
                continue

        stats["new"] += 1
        item_id = safe_id(rel_path)

        if ext == ".3mf":
            kind = "3mf"
        elif ext == ".zip":
            kind = "zip"
        elif ext == ".stl":
            kind = "stl"
        elif ext in {".rar", ".7z"}:
            kind = "archive"
        elif ext in {".obj", ".mtl", ".glb", ".nom", ".gcode"}:
            kind = "3d_other"
        elif ext in IMAGE_EXTS:
            kind = "image"
        else:
            kind = "non3d"

        thumb_rel: str | None = None
        plate_rel: str | None = None
        meta: dict[str, Any] = {}
        contained_files: list[str] = []
        zip_error: str | None = None

        if ext == ".3mf":
            try:
                with zipfile.ZipFile(fp) as z:
                    thumb_rel, plate_rel, meta = process_3mf_zip(z, item_id)
            except Exception as exc:
                zip_error = str(exc)

        elif ext == ".zip":
            zk, zexts, zerr = classify_zip_contents(fp, st.st_size)
            meta["zipKind"] = zk
            meta["zipExts"] = zexts
            if zerr:
                zip_error = zerr
            try:
                with zipfile.ZipFile(fp) as z:
                    names = [n for n in z.namelist() if "__MACOSX" not in n and not n.endswith("/")]
                    contained_files = names[:40]
                    imgs = [n for n in names if Path(n).suffix.lower() in IMAGE_EXTS]
                    tmfs = [n for n in names if n.lower().endswith(".3mf")]
                    stls = [n for n in names if n.lower().endswith(".stl")]
                    if tmfs:
                        meta["inner3mf"] = len(tmfs)
                    if stls:
                        meta["innerStl"] = len(stls)
                    if imgs:
                        meta["innerImg"] = len(imgs)
                        best_img = pick_best_zip_image(imgs)
                        if best_img:
                            img_ext = Path(best_img).suffix.lower() or ".png"
                            out_p = THUMBS_DIR / f"{item_id}_zip{img_ext}"
                            try:
                                info = z.getinfo(best_img)
                                if info.file_size <= 25 * 1024 * 1024:
                                    if save_image_bytes(z.read(best_img), out_p):
                                        thumb_rel = f"thumbs/{out_p.name}"
                            except Exception:
                                pass
                    if not thumb_rel and tmfs:
                        for inner_name in tmfs[:3]:
                            try:
                                info = z.getinfo(inner_name)
                                if info.file_size <= 150 * 1024 * 1024:
                                    raw_3mf = z.read(inner_name)
                                    with zipfile.ZipFile(io.BytesIO(raw_3mf)) as iz:
                                        t_rel, p_rel, iz_meta = process_3mf_zip(iz, item_id)
                                        if iz_meta:
                                            meta.update(iz_meta)
                                        if t_rel:
                                            thumb_rel = t_rel
                                            plate_rel = p_rel
                                            break
                            except Exception:
                                continue
            except Exception as exc:
                zip_error = str(exc)

        if not thumb_rel and kind not in {"image", "non3d"}:
            stem_key = fp.stem.lower()
            if stem_key in images_by_stem:
                src_img = images_by_stem[stem_key]
                out_p = THUMBS_DIR / f"{item_id}_root{src_img.suffix.lower()}"
                try:
                    if src_img.stat().st_size <= 20 * 1024 * 1024:
                        if save_image_bytes(src_img.read_bytes(), out_p):
                            thumb_rel = f"thumbs/{out_p.name}"
                except Exception:
                    pass

        extra_txt = " ".join([str(meta.get("title", "")), " ".join(contained_files[:15])])
        if folder_cat:
            category = folder_cat
        elif kind in {"image", "non3d"}:
            category = "Tài liệu / Ảnh lẻ (Non-3D)"
        else:
            category = suggest_category(fn, extra_txt)

        items.append({
            "id": item_id,
            "name": fn,
            "relPath": rel_path,
            "folder": folder,
            "ext": ext,
            "kind": kind,
            "size": st.st_size,
            "mtime": mtime_iso,
            "category": category,
            "isDup": is_dup,
            "thumb": thumb_rel,
            "plateThumb": plate_rel,
            "meta": meta,
            "containedCount": len(contained_files),
            "containedSample": contained_files[:20],
            "error": zip_error,
        })

    # Group _STL_Library / _STL_Co_Anh / _STL_Khong_Anh by model folder
    for stl_folder_name in ("_STL_Library", "_STL_Co_Anh", "_STL_Khong_Anh"):
        stl_lib_dir = SOURCE_DIR / stl_folder_name
        if not stl_lib_dir.is_dir():
            continue
        mesh_dirs: dict[Path, list[Path]] = {}
        for p in stl_lib_dir.rglob("*"):
            if p.is_file() and p.suffix.lower() in {".stl", ".obj", ".glb", ".3ds", ".ply"}:
                bundle_root = _resolve_stl_bundle_root(p.parent, stl_lib_dir)
                mesh_dirs.setdefault(bundle_root, []).append(p)
        for mdir in sorted(mesh_dirs.keys(), key=lambda x: x.as_posix().lower()):
            rel_path = mdir.relative_to(SOURCE_DIR).as_posix()
            mesh_files = sorted(mesh_dirs[mdir], key=lambda x: x.name.lower())
            total_sz = sum(f.stat().st_size for f in mesh_files)
            latest_mtime = max((f.stat().st_mtime for f in mesh_files), default=mdir.stat().st_mtime)
            mtime_iso = datetime.datetime.fromtimestamp(latest_mtime).strftime("%Y-%m-%d %H:%M")
            sig_key = f"{mdir.name}|{total_sz}|{mtime_iso}"
            if sig_key in prev_by_sig:
                cached = dict(prev_by_sig[sig_key])
                t_ok = (not cached.get("thumb")) or (OUT_DIR / cached["thumb"]).exists()
                if t_ok and cached.get("containedCount") == len(mesh_files):
                    cached["relPath"] = rel_path
                    cached["folder"] = stl_folder_name
                    cached["category"] = stl_folder_name
                    items.append(cached)
                    stats["cached"] += 1
                    continue

            stats["new"] += 1
            item_id = safe_id(rel_path)
            imgs = sorted(
                [f for f in mdir.rglob("*") if f.is_file() and f.suffix.lower() in IMAGE_EXTS],
                key=lambda x: (len(x.parts), x.name.lower()),
            )
            if not imgs and stl_folder_name == "_STL_Co_Anh":
                cur = mdir.parent
                while cur != stl_lib_dir and cur.is_relative_to(stl_lib_dir):
                    imgs = sorted(
                        [f for f in cur.rglob("*") if f.is_file() and f.suffix.lower() in IMAGE_EXTS],
                        key=lambda x: x.name.lower(),
                    )[:1]
                    if imgs:
                        break
                    cur = cur.parent
            thumb_rel = None
            if imgs:
                best = imgs[0]
                out_p = THUMBS_DIR / f"{item_id}_stl{best.suffix.lower()}"
                try:
                    if best.stat().st_size <= 20 * 1024 * 1024 and save_image_bytes(best.read_bytes(), out_p):
                        thumb_rel = f"thumbs/{out_p.name}"
                except Exception:
                    pass

            sample_names = [f.name for f in mesh_files[:20]]
            items.append({
                "id": item_id,
                "name": mdir.name,
                "relPath": rel_path,
                "folder": stl_folder_name,
                "ext": ".stl",
                "kind": "stl_bundle",
                "size": total_sz,
                "mtime": mtime_iso,
                "category": stl_folder_name,
                "isDup": False,
                "thumb": thumb_rel,
                "plateThumb": None,
                "meta": {"innerStl": len(mesh_files)},
                "containedCount": len(mesh_files),
                "containedSample": sample_names,
                "error": None,
            })

    # Populate BaSa3D printInfo metrics (slice_info.config for sliced 3MFs, mesh geometry for unsliced 3MFs & STL bundles)
    pending_tasks: list[tuple[int, str, str, dict[str, Any]]] = []
    for idx, item in enumerate(items):
        if item.get("error"):
            continue
        k = item.get("kind")
        if k in ("3mf", "stl_bundle") and "printInfo" not in (item.get("meta") or {}):
            pending_tasks.append((idx, k, item.get("relPath") or item["name"], item.get("meta") or {}))

    if pending_tasks:
        print(f"Measuring 3D print specs for {len(pending_tasks)} items (sliced 3MF / mesh geometry)...", flush=True)
        if len(pending_tasks) >= 20:
            workers = min(12, os.cpu_count() or 4)
            with ProcessPoolExecutor(max_workers=workers) as ex:
                for done_i, (idx, pinfo) in enumerate(ex.map(_compute_print_info_worker, pending_tasks, chunksize=16), 1):
                    if pinfo:
                        items[idx].setdefault("meta", {})["printInfo"] = pinfo
                    if done_i % 500 == 0 or done_i == len(pending_tasks):
                        print(f"  [printInfo] {done_i}/{len(pending_tasks)}", flush=True)
        else:
            for t in pending_tasks:
                idx, pinfo = _compute_print_info_worker(t)
                if pinfo:
                    items[idx].setdefault("meta", {})["printInfo"] = pinfo

    items = _group_3mf_bundles(items)
    _link_cross_format_siblings(items)

    DATA_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    DATA_JS.write_text(
        "window.CATALOG_DATA = " + json.dumps(items, ensure_ascii=False) + ";\n"
        f"window.CATALOG_META = {json.dumps({'sourceDir': str(SOURCE_DIR), 'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"Done! Total items: {len(items)} (cached: {stats['cached']}, newly scanned: {stats['new']})")
    with_thumb = sum(1 for x in items if x.get("thumb"))
    print(f"Items with preview image: {with_thumb}/{len(items)}")


if __name__ == "__main__":
    build()
