#!/usr/bin/env python3
r"""
Local Catalog Server for D:\data3D.
Binds strictly to 127.0.0.1 so the browser UI (catalog.html) can:
- Move files directly into D:\data3D\<Category>\ when you change category
- Create new category folders inside D:\data3D\
- Send deleted files to the Windows Recycle Bin (and remove from catalog)
- Reveal files in Windows Explorer
- Re-scan D:\data3D on demand
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes
import datetime
import hashlib
import json
import math
import mimetypes
import os
import re
import subprocess
import threading
import time
import unicodedata
import uuid
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

import build_catalog
import dedup_index

HOST = "127.0.0.1"
PORT = int(os.environ.get("CATALOG_PORT", "8338"))

# Paths: derive from env vars with sensible defaults.
# BASA3D_REPO_DIR is auto-detected from this file's location (tools/catalog/ → repo root).
BASA3D_REPO_DIR = Path(os.environ.get(
    "BASA3D_REPO_DIR",
    str(Path(__file__).resolve().parent.parent.parent),
)).resolve()
OUT_DIR = Path(os.environ.get("CATALOG_OUT_DIR", str(BASA3D_REPO_DIR / ".catalog-data"))).resolve()
DATA_3D_DIR = Path(os.environ.get("CATALOG_DATA_DIR", r"D:\data3D")).resolve()
DATA_JSON = OUT_DIR / "catalog_data.json"
DATA_JS = OUT_DIR / "catalog_data.js"
THUMBS_DIR = OUT_DIR / "thumbs"
REVIEW_STATE_JSON = OUT_DIR / "review_state.json"
BASA3D_SYNC_CACHE_JSON = OUT_DIR / "basa3d_sync_cache.json"
EXPORTS_DIR = OUT_DIR / "exports"

VALID_REVIEW_STATUSES = {"PENDING", "APPROVED", "DEFERRED", "PUSHED"}
VALID_DEFER_REASONS = {"MISSING_IMAGE", "MISSING_INFO", "NOT_PRINTED", "OTHER", ""}

CATEGORY_TO_BASA3D = {
    "Clicker": ("clicker", "Clicker", "CLK"),
    "Keychain": ("keychain", "Keychain", "KEY"),
    "Động vật & Flexi": ("animal-flexi", "Động vật & Flexi", "FLX"),
    "Pokemon": ("pokemon", "Pokemon", "PKM"),
    "Anime": ("anime", "Anime", "ANI"),
    "Figure": ("figure-model", "Figure & Model", "FIG"),
    "Trang trí & Lễ hội": ("home-decor", "Home Decor", "DEC"),
    "Phụ kiện, Hộp & Gridfinity": ("accessories-gadgets", "Accessories & Gadgets", "ACC"),
    "antistress": ("antistress", "Antistress & Fidget", "ANT"),
    "Bộ nhiều mảnh (Multipart)": ("multipart-model", "Mô hình nhiều mảnh", "MLT"),
    "Gia Dụng": ("home-decor", "Home Decor", "DEC"),
    "Tay Cầm": ("accessories-gadgets", "Accessories & Gadgets", "ACC"),
}

LOCK = threading.Lock()
PUSH_JOBS_LOCK = threading.Lock()
PUSH_JOBS: dict[str, dict] = {}

FOLDER_TO_CATEGORY = {
    "_Non3D_Archive": "Tài liệu / Ảnh lẻ (Non-3D)",
}


def category_to_folder(cat: str) -> str:
    if cat == "Tài liệu / Ảnh lẻ (Non-3D)":
        return "_Non3D_Archive"
    cleaned = re.sub(r"\s*/\s*", " - ", cat)
    cleaned = re.sub(r'[<>:"/\\|?*]', "-", cleaned).strip(" .")
    return cleaned or "Chưa phân loại"


def resolve_inside_data3d(rel_path: str) -> Path:
    clean = rel_path.replace("\\", "/").lstrip("/")
    target = (DATA_3D_DIR / clean).resolve()
    if not target.is_relative_to(DATA_3D_DIR) or target == DATA_3D_DIR:
        raise ValueError("Path escapes D:\\data3D")
    return target


def send_to_recycle_bin(path: Path) -> None:
    """Move a file to the Windows Recycle Bin using Shell32 SHFileOperationW."""
    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", ctypes.c_uint),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", ctypes.c_ushort),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", ctypes.c_void_p),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    FO_DELETE = 3
    FOF_SILENT = 0x0004
    FOF_NOCONFIRMATION = 0x0010
    FOF_ALLOWUNDO = 0x0040
    FOF_NOERRORUI = 0x0400

    op = SHFILEOPSTRUCTW()
    op.hwnd = None
    op.wFunc = FO_DELETE
    op.pFrom = str(path) + "\0\0"
    op.pTo = None
    op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI
    res = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    if res != 0 or op.fAnyOperationsAborted:
        raise OSError(f"SHFileOperationW failed with code {res}")


def _sh_open_folder_and_select(fp: Path) -> None:
    target = os.path.normpath(str(fp))
    parent = os.path.normpath(str(fp.parent))
    shell32 = ctypes.windll.shell32
    ole32 = ctypes.windll.ole32
    user32 = ctypes.windll.user32

    shell32.ILCreateFromPathW.argtypes = [wintypes.LPCWSTR]
    shell32.ILCreateFromPathW.restype = ctypes.c_void_p
    shell32.ILFindLastID.argtypes = [ctypes.c_void_p]
    shell32.ILFindLastID.restype = ctypes.c_void_p
    shell32.ILFree.argtypes = [ctypes.c_void_p]
    shell32.ILFree.restype = None
    shell32.SHOpenFolderAndSelectItems.argtypes = [
        ctypes.c_void_p,
        wintypes.UINT,
        ctypes.POINTER(ctypes.c_void_p),
        wintypes.DWORD,
    ]
    shell32.SHOpenFolderAndSelectItems.restype = ctypes.c_long

    # Allow newly activated Explorer window to come to the foreground
    try:
        user32.AllowSetForegroundWindow(-1)  # ASFW_ANY
    except Exception:
        pass

    COINIT_APARTMENTTHREADED = 0x2
    hr_init = ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
    folder_pidl = None
    item_pidl = None
    try:
        folder_pidl = shell32.ILCreateFromPathW(parent)
        item_pidl = shell32.ILCreateFromPathW(target)
        if not folder_pidl or not item_pidl:
            raise OSError("ILCreateFromPathW failed")
        child_pidl = shell32.ILFindLastID(item_pidl)
        if not child_pidl:
            raise OSError("ILFindLastID failed")
        arr = (ctypes.c_void_p * 1)(child_pidl)
        hr = shell32.SHOpenFolderAndSelectItems(folder_pidl, 1, arr, 0)
        if hr < 0:
            raise OSError(f"SHOpenFolderAndSelectItems failed: 0x{hr & 0xFFFFFFFF:08X}")
    finally:
        if item_pidl:
            shell32.ILFree(item_pidl)
        if folder_pidl:
            shell32.ILFree(folder_pidl)
        if hr_init in (0, 1):
            ole32.CoUninitialize()


def reveal_in_explorer(fp: Path) -> str:
    """Open Windows Explorer cleanly at the folder or highlighting the file."""
    target = os.path.normpath(str(fp))
    if '"' in target:
        raise ValueError("Invalid character in path")

    shell32 = ctypes.windll.shell32
    user32 = ctypes.windll.user32
    shell32.ShellExecuteW.argtypes = [
        wintypes.HWND,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        ctypes.c_int,
    ]
    shell32.ShellExecuteW.restype = ctypes.c_void_p

    try:
        user32.AllowSetForegroundWindow(-1)
    except Exception:
        pass

    if fp.is_dir():
        rc = shell32.ShellExecuteW(None, "open", target, None, None, 1)
        if rc and int(rc) > 32:
            return "shell_open_dir"
        os.startfile(target)
        return "startfile_dir"

    err_holder: list[Exception] = []

    def _run_sta() -> None:
        try:
            _sh_open_folder_and_select(fp)
        except Exception as exc:
            err_holder.append(exc)

    t = threading.Thread(target=_run_sta, daemon=True)
    t.start()
    t.join(timeout=1.2)
    if not t.is_alive() and not err_holder:
        return "sh_select_item"

    # Fallback 1: open containing folder directly (immune to /select quoting quirks)
    parent = os.path.normpath(str(fp.parent))
    rc = shell32.ShellExecuteW(None, "open", parent, None, None, 1)
    if rc and int(rc) > 32:
        return f"shell_open_parent (select fallback: {err_holder[0] if err_holder else 'timeout'})"
    subprocess.Popen(["explorer.exe", "/select,", target])
    return "explorer_cli_fallback"


def load_items() -> list[dict]:
    if not DATA_JSON.exists():
        return []
    return json.loads(DATA_JSON.read_text(encoding="utf-8"))


def save_items(items: list[dict]) -> None:
    DATA_JSON.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    DATA_JS.write_text(
        "window.CATALOG_DATA = " + json.dumps(items, ensure_ascii=False) + ";\n"
        + f"window.CATALOG_META = {json.dumps({'sourceDir': str(DATA_3D_DIR), 'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}, ensure_ascii=False)};\n",
        encoding="utf-8",
    )


def list_disk_folders() -> list[str]:
    if not DATA_3D_DIR.exists():
        return []
    folders = []
    for p in sorted(DATA_3D_DIR.iterdir(), key=lambda x: x.name.lower()):
        if p.is_dir():
            folders.append(FOLDER_TO_CATEGORY.get(p.name, p.name))
    return folders


def _move_item_on_disk(item: dict, target_cat: str) -> dict:
    folder_name = category_to_folder(target_cat)
    rel = item.get("relPath") or item.get("name")
    src = resolve_inside_data3d(rel)
    if not src.exists():
        raise FileNotFoundError(f"File not found on disk: {src}")

    dest_dir = (DATA_3D_DIR / folder_name).resolve()
    if not dest_dir.is_relative_to(DATA_3D_DIR):
        raise ValueError("Invalid target folder")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    if src.resolve() != dest.resolve():
        if dest.exists():
            stem = src.name if src.is_dir() else src.stem
            ext = "" if src.is_dir() else src.suffix
            n = 2
            while (dest_dir / f"{stem} ({n}){ext}").exists():
                n += 1
            dest = dest_dir / f"{stem} ({n}){ext}"
        src.rename(dest)

    item["name"] = dest.name
    item["relPath"] = dest.relative_to(DATA_3D_DIR).as_posix()
    item["folder"] = folder_name
    item["category"] = FOLDER_TO_CATEGORY.get(folder_name, target_cat)
    return item


def _delete_item_on_disk(item: dict) -> Path:
    rel = item.get("relPath") or item.get("name")
    src = resolve_inside_data3d(rel)
    if src.exists():
        send_to_recycle_bin(src)
    for k in ("thumb", "plateThumb"):
        t = item.get(k)
        if t:
            tp = (OUT_DIR / t).resolve()
            if tp.is_relative_to(THUMBS_DIR) and tp.is_file():
                try:
                    tp.unlink()
                except Exception:
                    pass
    return src


def load_review_state() -> dict[str, dict]:
    if not REVIEW_STATE_JSON.exists():
        return {}
    try:
        data = json.loads(REVIEW_STATE_JSON.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_review_state(reviews: dict[str, dict]) -> None:
    REVIEW_STATE_JSON.write_text(json.dumps(reviews, ensure_ascii=False, indent=2), encoding="utf-8")


def basa3d_source_key(rel_path: str) -> str:
    segs = [s for s in re.split(r"[\\/]+", rel_path) if s and s != "."]
    normalized = unicodedata.normalize("NFC", "/".join(segs))
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def clean_display_name(raw_name: str) -> str:
    s = re.sub(r"\.(3mf|stl|zip)$", "", raw_name, flags=re.IGNORECASE)
    s = re.sub(r"\s*@Print3DWorld.*$", "", s, flags=re.IGNORECASE)
    s = s.replace("+", " ").replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip(" -.")
    return s or raw_name


def resolve_basa3d_category(item: dict) -> tuple[str, str, str]:
    cat = item.get("category") or "Chưa phân loại"
    if cat == "_STL_Co_Anh":
        cat = build_catalog.suggest_category(item.get("name") or "", "")
    return CATEGORY_TO_BASA3D.get(cat, ("chua-phan-loai", "Chưa phân loại", "UNC"))


def compute_basa3d_pricing_py(print_info: dict | None, cfg: dict | None) -> dict | None:
    if not print_info or not print_info.get("grams") or not print_info.get("printMinutes"):
        return None
    if print_info.get("source") not in ("SLICED", "MESH_ESTIMATE"):
        return None
    c = {
        "plaVndPerGram": 250,
        "petgVndPerGram": 320,
        "absVndPerGram": 300,
        "tpuVndPerGram": 380,
        "electricityVndPerKwh": 3500,
        "machinePriceVnd": 15_000_000,
        "machineLifetimeHours": 10_000,
        "printerPowerKw": 0.2,
        "laborVndPerHour": 35_000,
        "laborMinutesPerPlate": 0,
        "failureBufferPct": 10,
        "marginPct": 40,
        "packagingFeeVnd": 5_000,
        "minPriceVnd": 25_000,
    }
    if isinstance(cfg, dict):
        for k in c:
            if k in cfg and isinstance(cfg[k], (int, float)) and math.isfinite(cfg[k]) and cfg[k] >= 0:
                c[k] = float(cfg[k])

    def ucost(mat: str | None) -> float:
        m = str(mat or "PLA").upper()
        if "PETG" in m:
            return c["petgVndPerGram"]
        if "TPU" in m:
            return c["tpuVndPerGram"]
        if "ABS" in m or "ASA" in m:
            return c["absVndPerGram"]
        return c["plaVndPerGram"]

    fils = print_info.get("filaments") or [{"type": "PLA", "color": None, "grams": print_info["grams"]}]
    material_cost = 0
    material_lines = []
    for f in fils:
        g = float(f.get("grams") or 0)
        uc = ucost(f.get("type"))
        cost_vnd = round(g * uc)
        material_cost += cost_vnd
        material_lines.append({
            "label": f"{f.get('type') or 'PLA'}" + (f" ({f['color']})" if f.get("color") else ""),
            "gram": g,
            "costVnd": cost_vnd,
        })

    print_hours = float(print_info["printMinutes"]) / 60.0
    elec_cost = round(print_hours * c["printerPowerKw"] * c["electricityVndPerKwh"])
    depr_cost = round(print_hours * (c["machinePriceVnd"] / max(1.0, c["machineLifetimeHours"])))
    buf_cost = round((material_cost + elec_cost + depr_cost) * (c["failureBufferPct"] / 100.0))
    plates = max(1, int(print_info.get("plateCount") or 1))
    labor_cost = round(((c["laborMinutesPerPlate"] * plates) / 60.0) * c["laborVndPerHour"])
    pkg_cost = round(c["packagingFeeVnd"])
    total_cost = material_cost + elec_cost + depr_cost + buf_cost + labor_cost + pkg_cost
    denom = max(0.05, 1.0 - min(95.0, c["marginPct"]) / 100.0)
    before_round = round(total_cost / denom)
    raw_rounded = int(math.ceil(before_round / 1000.0) * 1000)
    final_price = max(int(round(c["minPriceVnd"])), raw_rounded)

    return {
        "finalPriceVnd": final_price,
        "totalCostVnd": total_cost,
        "materialCostVnd": material_cost,
        "materialLines": material_lines,
        "electricityCostVnd": elec_cost,
        "machineDepreciationVnd": depr_cost,
        "failureBufferVnd": buf_cost,
        "laborCostVnd": labor_cost,
        "packagingFeeVnd": pkg_cost,
        "priceBeforeRoundingVnd": before_round,
    }


def _collect_preview_images(item: dict) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for key in ("thumb", "plateThumb"):
        rel_t = item.get(key)
        if rel_t:
            p = (OUT_DIR / rel_t).resolve()
            if p.is_file() and str(p).lower() not in seen:
                seen.add(str(p).lower())
                out.append(str(p))
    # For STL bundles, also check up to 3 real photos inside D:\data3D\<relPath>
    if item.get("kind") == "stl_bundle":
        try:
            src_dir = resolve_inside_data3d(item.get("relPath") or "")
            if src_dir.is_dir():
                for f in sorted(src_dir.rglob("*"), key=lambda x: (len(x.parts), x.name.lower())):
                    if f.is_file() and f.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and f.stat().st_size <= 20 * 1024 * 1024:
                        if str(f).lower() not in seen and len(out) < 4:
                            seen.add(str(f).lower())
                            out.append(str(f))
        except Exception:
            pass
    return out


def build_basa3d_export_payload(
    items: list[dict],
    reviews: dict[str, dict],
    pricing_cfg: dict | None,
    target_ids: set[str] | None = None,
) -> dict:
    export_items: list[dict] = []
    for it in items:
        iid = it.get("id")
        if not iid:
            continue
        rv = reviews.get(iid) or {}
        if target_ids is not None:
            if iid not in target_ids:
                continue
        elif rv.get("status") != "APPROVED":
            continue

        rel_path = it.get("relPath") or it.get("name")
        meta = it.get("meta") or {}
        cat_slug, cat_name, sku_code = resolve_basa3d_category(it)
        display_name = (rv.get("displayName") or "").strip() or clean_display_name(meta.get("title") or it.get("name") or "")

        variants: list[dict] = []
        bundle_items = meta.get("bundleItems") or []
        if it.get("kind") == "3mf_bundle" and bundle_items:
            for sub in bundle_items:
                pi = sub.get("printInfo") or {}
                pr = compute_basa3d_pricing_py(pi, pricing_cfg)
                vname = clean_display_name(Path(sub.get("name") or "Profile").stem)
                variants.append({
                    "name": vname[:180],
                    "priceVnd": pr["finalPriceVnd"] if pr else 0,
                    "costPriceVnd": pr["totalCostVnd"] if pr else None,
                    "weightGrams": round(float(pi.get("grams") or 0)) if pi.get("grams") else None,
                    "attributes": {
                        "sourceType": pi.get("source") or "UNKNOWN",
                        "plateCount": pi.get("plateCount") or 1,
                        "printMinutes": pi.get("printMinutes") or None,
                        "sizeMm": pi.get("sizeMm") or None,
                        "volumeCm3": pi.get("volumeCm3") or None,
                        "filaments": pi.get("filaments") or [],
                        "exceedsBed": bool(pi.get("exceedsBed")),
                        "relPath": sub.get("relPath"),
                    },
                    "pricingBreakdown": pr,
                })
        else:
            pi = meta.get("printInfo") or {}
            pr = compute_basa3d_pricing_py(pi, pricing_cfg)
            variants.append({
                "name": "Mặc định",
                "priceVnd": pr["finalPriceVnd"] if pr else 0,
                "costPriceVnd": pr["totalCostVnd"] if pr else None,
                "weightGrams": round(float(pi.get("grams") or 0)) if pi.get("grams") else None,
                "attributes": {
                    "sourceType": pi.get("source") or "UNKNOWN",
                    "plateCount": pi.get("plateCount") or meta.get("plates") or 1,
                    "printMinutes": pi.get("printMinutes") or None,
                    "sizeMm": pi.get("sizeMm") or None,
                    "volumeCm3": pi.get("volumeCm3") or None,
                    "filaments": pi.get("filaments") or [],
                    "exceedsBed": bool(pi.get("exceedsBed")),
                    "relPath": rel_path,
                },
                "pricingBreakdown": pr,
            })

        priced_vals = [v["priceVnd"] for v in variants if v["priceVnd"] > 0]
        base_price = min(priced_vals) if priced_vals else None
        rep_variant = next((v for v in variants if v["priceVnd"] == base_price), variants[0]) if variants else None
        rep_pi = meta.get("printInfo") or {}

        export_items.append({
            "catalogId": iid,
            "sourceKey": basa3d_source_key(rel_path),
            "sourceRelPath": rel_path,
            "sourceDir": rel_path if it.get("kind") in ("stl_bundle", "3mf_bundle") else Path(rel_path).parent.as_posix(),
            "groupMode": "FOLDER" if it.get("kind") in ("stl_bundle", "3mf_bundle") else "FILE",
            "sourceBytes": int(it.get("size") or 0),
            "sourceMtime": it.get("mtime") or "",
            "name": display_name[:180],
            "localCategory": it.get("category") or "",
            "categorySlug": cat_slug,
            "categoryName": cat_name,
            "skuCode": sku_code,
            "designer": meta.get("designer") or None,
            "note": rv.get("note") or "",
            "basePriceVnd": base_price,
            "pricingBreakdown": rep_variant["pricingBreakdown"] if rep_variant else None,
            "sizeMm": rep_pi.get("sizeMm") or None,
            "volumeCm3": rep_pi.get("volumeCm3") or None,
            "triangles": rep_pi.get("triangles") or None,
            "images": _collect_preview_images(it),
            "variants": variants,
        })

    return {
        "schemaVersion": "basa3d-catalog-export-v1",
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sourceRoot": str(DATA_3D_DIR),
        "pricingConfig": pricing_cfg or {},
        "count": len(export_items),
        "items": export_items,
    }


def load_basa3d_sync_cache() -> dict | None:
    if not BASA3D_SYNC_CACHE_JSON.exists():
        return None
    try:
        data = json.loads(BASA3D_SYNC_CACHE_JSON.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _apply_manifest_to_reviews(payload: dict, manifest: dict, batch_id: str) -> tuple[int, list[str], dict]:
    res_by_key = {
        str(r.get("sourceKey")): r
        for r in (manifest.get("items") or [])
        if r.get("sourceKey")
    }
    now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pushed_count = 0
    errors: list[str] = []
    with LOCK:
        reviews = load_review_state()
        for ex_it in payload.get("items") or []:
            iid = ex_it["catalogId"]
            sk = ex_it["sourceKey"]
            m_res = res_by_key.get(sk)
            if not m_res:
                continue
            act = m_res.get("action")
            if act == "ERROR":
                errors.append(f"{ex_it['name']}: {m_res.get('error', 'unknown')}")
                continue
            cur = dict(reviews.get(iid) or {})
            cur.update({
                "status": "PUSHED",
                "deferReason": "",
                "pushedAt": now_iso,
                "batchId": batch_id,
                "sourceKey": sk,
                "basa3dProductId": m_res.get("productId"),
                "basa3dSlug": m_res.get("slug"),
                "basa3dSku": m_res.get("sku"),
                "basa3dAction": act or "CREATE",
                "basa3dProductStatus": "DRAFT",
                "basa3dReviewStatus": "PENDING",
                "updatedAt": now_iso,
            })
            reviews[iid] = cur
            pushed_count += 1
        save_review_state(reviews)
    return pushed_count, errors, reviews


def run_basa3d_dev_sync() -> dict:
    sync_script = BASA3D_REPO_DIR / "scripts" / "stl-import" / "dev-bridge-sync.ts"
    if not sync_script.is_file():
        return {"ok": False, "error": f"Không thấy {sync_script}"}
    npx_bin = "npx.cmd" if os.name == "nt" else "npx"
    proc = subprocess.run(
        [npx_bin, "tsx", "--env-file=.env.local", str(sync_script)],
        cwd=str(BASA3D_REPO_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=45,
    )
    if proc.returncode != 0:
        return {"ok": False, "error": (proc.stderr or proc.stdout or f"exit {proc.returncode}")[-800:]}
    raw_lines = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip()]
    json_line = next((ln for ln in reversed(raw_lines) if ln.startswith("{")), "")
    if not json_line:
        return {"ok": False, "error": "Sync không trả về JSON"}
    sync_data = json.loads(json_line)

    # Reconcile BaSa3D imported products with local review_state.json by deterministic sourceKey
    imported_by_key = sync_data.get("importedByKey") or {}
    now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    matched_count = 0
    with LOCK:
        items = load_items()
        reviews = load_review_state()
        for it in items:
            iid = str(it.get("id") or "")
            rel = it.get("relPath") or it.get("name") or ""
            if not iid or not rel:
                continue
            sk = basa3d_source_key(rel)
            remote = imported_by_key.get(sk)
            if not remote:
                continue
            matched_count += 1
            cur = dict(reviews.get(iid) or {})
            cur_status = cur.get("status") or "PENDING"
            if cur_status == "PENDING":
                cur["status"] = "PUSHED"
            cur.update({
                "sourceKey": sk,
                "basa3dProductId": remote.get("productId"),
                "basa3dSlug": remote.get("slug"),
                "basa3dProductStatus": remote.get("productStatus"),
                "basa3dReviewStatus": remote.get("reviewStatus"),
                "basa3dBasePriceVnd": remote.get("basePriceVnd"),
                "basa3dVariantsCount": remote.get("variantsCount"),
                "syncedAt": now_iso,
            })
            if "updatedAt" not in cur:
                cur["updatedAt"] = now_iso
            reviews[iid] = cur
        save_review_state(reviews)
        BASA3D_SYNC_CACHE_JSON.write_text(json.dumps(sync_data, ensure_ascii=False, indent=2), encoding="utf-8")

    sync_data["matchedCatalogCount"] = matched_count
    sync_data["reviews"] = reviews
    return sync_data


def _run_push_job_worker(job_id: str, cmd: list[str], payload: dict, export_file: Path, manifest_file: Path, batch_id: str) -> None:
    started = time.monotonic()
    raw_tail: list[str] = []
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(BASA3D_REPO_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            s = line.strip()
            if not s:
                continue
            raw_tail.append(s)
            if len(raw_tail) > 30:
                raw_tail.pop(0)
            if s.startswith("::PROGRESS::"):
                try:
                    ev = json.loads(s[len("::PROGRESS::"):])
                except Exception:
                    continue
                with PUSH_JOBS_LOCK:
                    job = PUSH_JOBS.get(job_id)
                    if not job:
                        continue
                    total = max(1, int(ev.get("total") or job["total"] or 1))
                    job["total"] = total
                    if ev.get("phase") == "item":
                        job["currentName"] = ev.get("name") or ""
                        job["currentIndex"] = int(ev.get("current") or 0)
                    elif ev.get("phase") == "done":
                        job["completed"] = int(ev.get("current") or (job["completed"] + 1))
                        job["percent"] = min(100, round(job["completed"] * 100 / total))
                        act = ev.get("action") or "CREATE"
                        if act == "CREATE":
                            job["createdCount"] += 1
                        elif act == "UPDATE":
                            job["updatedCount"] += 1
                        elif act == "SKIP":
                            job["skippedCount"] += 1
                        else:
                            job["errorCount"] += 1
                        job["logs"].append({
                            "index": job["completed"],
                            "action": act,
                            "name": ev.get("name") or "",
                            "productId": ev.get("productId"),
                            "slug": ev.get("slug"),
                            "sku": ev.get("sku"),
                            "variantsCount": ev.get("variantsCount") or 1,
                            "error": ev.get("error"),
                        })
                    job["elapsedSec"] = round(time.monotonic() - started, 1)

        rc = proc.wait(timeout=300)
        manifest = {}
        if manifest_file.is_file():
            try:
                manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                manifest = {}

        if manifest.get("items"):
            pushed_count, errors, reviews = _apply_manifest_to_reviews(payload, manifest, batch_id)
            with PUSH_JOBS_LOCK:
                job = PUSH_JOBS[job_id]
                job["completed"] = job["total"]
                job["percent"] = 100
                job["pushedCount"] = pushed_count
                job["errors"] = errors
                job["totals"] = manifest.get("totals")
                job["reviews"] = reviews
                job["manifestPath"] = str(manifest_file)
                job["elapsedSec"] = round(time.monotonic() - started, 1)
                job["status"] = "DONE" if (rc == 0 or pushed_count > 0) else "ERROR"
                job["done"] = True
                if rc != 0 and not errors:
                    job["fatalError"] = f"Importer exit {rc}: {' | '.join(raw_tail[-5:])}"
        else:
            with PUSH_JOBS_LOCK:
                job = PUSH_JOBS[job_id]
                job["status"] = "ERROR"
                job["done"] = True
                job["elapsedSec"] = round(time.monotonic() - started, 1)
                job["fatalError"] = f"Importer lỗi (exit {rc}): {' | '.join(raw_tail[-6:])}"
    except Exception as exc:
        with PUSH_JOBS_LOCK:
            job = PUSH_JOBS.get(job_id)
            if job:
                job["status"] = "ERROR"
                job["done"] = True
                job["elapsedSec"] = round(time.monotonic() - started, 1)
                job["fatalError"] = str(exc)


class CatalogHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(OUT_DIR), **kwargs)

    def log_message(self, format: str, *args) -> None:
        pass  # Keep console clean

    def send_json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {
                "ok": True,
                "live": True,
                "sourceDir": str(DATA_3D_DIR),
                "folders": list_disk_folders(),
            })
            return
        if parsed.path == "/api/items":
            with LOCK:
                items = load_items()
                reviews = load_review_state()
                basa3d_sync = load_basa3d_sync_cache()
            self.send_json(200, {
                "ok": True,
                "items": items,
                "reviews": reviews,
                "folders": list_disk_folders(),
                "basa3dSync": basa3d_sync,
            })
            return
        if parsed.path == "/api/review":
            with LOCK:
                reviews = load_review_state()
            self.send_json(200, {"ok": True, "reviews": reviews})
            return
        if parsed.path == "/api/basa3d/sync":
            try:
                res = run_basa3d_dev_sync()
                self.send_json(200 if res.get("ok") else 500, res)
            except Exception as exc:
                self.send_json(500, {"ok": False, "error": str(exc)})
            return
        if parsed.path == "/api/push_basa3d/status":
            qs = parse_qs(parsed.query)
            job_id = (qs.get("jobId") or [""])[0]
            with PUSH_JOBS_LOCK:
                job = dict(PUSH_JOBS.get(job_id) or {})
            if not job:
                self.send_json(404, {"ok": False, "error": "Push job not found"})
                return
            self.send_json(200, {"ok": True, "job": job})
            return
        if parsed.path == "/api/index/dups":
            with LOCK:
                stats = dedup_index.build_index(DATA_3D_DIR)
                groups = dedup_index.find_internal_duplicates(DATA_3D_DIR)
                by_rel = {
                    (x.get("relPath") or x.get("name")): x.get("id")
                    for x in load_items()
                }
                for g in groups:
                    g["entries"] = [{"relPath": r, "id": by_rel.get(r)} for r in g["files"]]
            self.send_json(200, {"ok": True, "stats": stats, "groups": groups})
            return
        if parsed.path == "/files":
            # Serve file inside D:\data3D safely if requested
            q = unquote(parsed.query)
            if q.startswith("p="):
                try:
                    fp = resolve_inside_data3d(q[2:])
                    if fp.is_file():
                        ctype, _ = mimetypes.guess_type(str(fp))
                        data = fp.read_bytes()
                        self.send_response(200)
                        self.send_header("Content-Type", ctype or "application/octet-stream")
                        self.send_header("Content-Length", str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                        return
                except Exception:
                    pass
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if parsed.path == "/" or parsed.path == "/catalog.html":
            # Serve catalog.html from the script's own directory (tools/catalog/)
            html_path = Path(__file__).resolve().parent / "catalog.html"
            if html_path.is_file():
                data = html_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            body = self.read_json_body()
        except Exception as exc:
            self.send_json(400, {"ok": False, "error": f"Invalid JSON: {exc}"})
            return

        if parsed.path == "/api/move":
            item_id = body.get("id", "")
            target_cat = (body.get("category") or "").strip()
            if not item_id or not target_cat:
                self.send_json(400, {"ok": False, "error": "Missing id or category"})
                return
            with LOCK:
                items = load_items()
                idx = next((i for i, x in enumerate(items) if x.get("id") == item_id), None)
                if idx is None:
                    self.send_json(404, {"ok": False, "error": "Item not found in catalog"})
                    return
                try:
                    updated = _move_item_on_disk(items[idx], target_cat)
                except Exception as exc:
                    self.send_json(400, {"ok": False, "error": str(exc)})
                    return
                save_items(items)
                self.send_json(200, {"ok": True, "item": updated, "folders": list_disk_folders()})
            return

        if parsed.path == "/api/move_batch":
            ids = set(body.get("ids") or [])
            target_cat = (body.get("category") or "").strip()
            if not ids or not target_cat:
                self.send_json(400, {"ok": False, "error": "Missing ids or category"})
                return
            with LOCK:
                items = load_items()
                moved_items = []
                errors = []
                for item in items:
                    if item.get("id") in ids:
                        try:
                            moved_items.append(_move_item_on_disk(item, target_cat))
                        except Exception as exc:
                            errors.append(f"{item.get('name')}: {exc}")
                save_items(items)
                self.send_json(200, {
                    "ok": True,
                    "movedCount": len(moved_items),
                    "movedItems": moved_items,
                    "errors": errors,
                    "folders": list_disk_folders(),
                })
            return

        if parsed.path == "/api/delete":
            item_id = body.get("id", "")
            if not item_id:
                self.send_json(400, {"ok": False, "error": "Missing id"})
                return
            with LOCK:
                items = load_items()
                idx = next((i for i, x in enumerate(items) if x.get("id") == item_id), None)
                if idx is None:
                    self.send_json(404, {"ok": False, "error": "Item not found in catalog"})
                    return
                src = _delete_item_on_disk(items[idx])
                items.pop(idx)
                save_items(items)
                self.send_json(200, {"ok": True, "deletedId": item_id, "file": str(src)})
            return

        if parsed.path == "/api/delete_batch":
            ids = set(body.get("ids") or [])
            if not ids:
                self.send_json(400, {"ok": False, "error": "Missing ids"})
                return
            with LOCK:
                items = load_items()
                kept = []
                deleted_ids = []
                errors = []
                for item in items:
                    if item.get("id") in ids:
                        try:
                            _delete_item_on_disk(item)
                            deleted_ids.append(item.get("id"))
                        except Exception as exc:
                            errors.append(f"{item.get('name')}: {exc}")
                            kept.append(item)
                    else:
                        kept.append(item)
                save_items(kept)
                self.send_json(200, {
                    "ok": True,
                    "deletedCount": len(deleted_ids),
                    "deletedIds": deleted_ids,
                    "errors": errors,
                })
            return

        if parsed.path == "/api/mkdir":
            cat_name = (body.get("category") or "").strip()
            if not cat_name:
                self.send_json(400, {"ok": False, "error": "Missing category name"})
                return
            folder_name = category_to_folder(cat_name)
            dest_dir = (DATA_3D_DIR / folder_name).resolve()
            if not dest_dir.is_relative_to(DATA_3D_DIR) or dest_dir == DATA_3D_DIR:
                self.send_json(400, {"ok": False, "error": "Invalid folder name"})
                return
            dest_dir.mkdir(parents=True, exist_ok=True)
            self.send_json(200, {"ok": True, "folder": folder_name, "folders": list_disk_folders()})
            return

        if parsed.path == "/api/reveal":
            rel = body.get("relPath") or ""
            try:
                fp = resolve_inside_data3d(rel)
                if fp.exists():
                    method = reveal_in_explorer(fp)
                    print(f"[reveal] {fp} -> {method}", flush=True)
                    self.send_json(200, {"ok": True, "method": method, "path": str(fp)})
                    return
                self.send_json(404, {"ok": False, "error": f"Không tìm thấy trên ổ đĩa: {fp}"})
            except Exception as exc:
                print(f"[reveal ERROR] rel={rel!r}: {exc}", flush=True)
                self.send_json(400, {"ok": False, "error": str(exc)})
            return

        if parsed.path == "/api/rescan":
            with LOCK:
                build_catalog.build()
                dedup_index.build_index(DATA_3D_DIR)
                items = load_items()
            self.send_json(200, {"ok": True, "count": len(items), "folders": list_disk_folders()})
            return

        if parsed.path == "/api/index/rebuild":
            with LOCK:
                stats = dedup_index.build_index(DATA_3D_DIR)
            self.send_json(200, {"ok": True, "stats": stats})
            return

        if parsed.path == "/api/index/check_folder":
            folder_str = (body.get("folderPath") or "").strip().strip('"')
            if not folder_str:
                self.send_json(400, {"ok": False, "error": "Chưa nhập đường dẫn thư mục cần check"})
                return
            target = Path(folder_str)
            if not target.is_dir():
                self.send_json(400, {"ok": False, "error": f"Không tìm thấy thư mục: {target}"})
                return
            with LOCK:
                dedup_index.build_index(DATA_3D_DIR)
                results = dedup_index.check_folder(target)
            self.send_json(200, {"ok": True, "folder": str(target), "results": results})
            return

        if parsed.path == "/api/review":
            updates = body.get("updates")
            if not isinstance(updates, list):
                self.send_json(400, {"ok": False, "error": "Missing updates list"})
                return
            now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with LOCK:
                reviews = load_review_state()
                for u in updates:
                    if not isinstance(u, dict):
                        continue
                    iid = str(u.get("id") or "").strip()
                    if not iid:
                        continue
                    cur = dict(reviews.get(iid) or {})
                    if "status" in u:
                        st_val = str(u["status"]).upper()
                        if st_val not in VALID_REVIEW_STATUSES:
                            self.send_json(400, {"ok": False, "error": f"Invalid status: {st_val}"})
                            return
                        cur["status"] = st_val
                        if st_val != "DEFERRED":
                            cur["deferReason"] = ""
                    if "deferReason" in u:
                        dr = str(u["deferReason"] or "").upper()
                        if dr not in VALID_DEFER_REASONS:
                            self.send_json(400, {"ok": False, "error": f"Invalid deferReason: {dr}"})
                            return
                        cur["deferReason"] = dr
                    if "note" in u:
                        cur["note"] = str(u["note"] or "")
                    if "displayName" in u:
                        cur["displayName"] = str(u["displayName"] or "")
                    cur["updatedAt"] = now_iso
                    reviews[iid] = cur
                save_review_state(reviews)
            self.send_json(200, {"ok": True, "reviews": reviews})
            return

        if parsed.path == "/api/push_basa3d/start":
            pricing_cfg = body.get("pricingCfg")
            raw_ids = body.get("ids")
            target_ids = set(str(x) for x in raw_ids) if isinstance(raw_ids, list) and raw_ids else None
            ts_tag = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = f"batch_{ts_tag}"

            with LOCK:
                items = load_items()
                reviews = load_review_state()
                payload = build_basa3d_export_payload(items, reviews, pricing_cfg, target_ids)
                if not payload["items"]:
                    self.send_json(400, {"ok": False, "error": "Chưa có mẫu nào được tick Duyệt (APPROVED) để đẩy."})
                    return
                EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
                export_file = EXPORTS_DIR / f"basa3d_export_{ts_tag}.json"
                export_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

            importer_script = BASA3D_REPO_DIR / "scripts" / "stl-import" / "import-from-json.ts"
            if not importer_script.is_file():
                self.send_json(400, {
                    "ok": False,
                    "error": f"Chưa tìm thấy importer tại {importer_script}. Đã xuất sẵn JSON tại {export_file}",
                    "exportPath": str(export_file),
                })
                return

            manifest_file = EXPORTS_DIR / f"basa3d_manifest_{ts_tag}.json"
            npx_bin = "npx.cmd" if os.name == "nt" else "npx"
            cmd = [
                npx_bin, "tsx", "--env-file=.env.local",
                str(importer_script),
                "--json", str(export_file),
                "--out", str(manifest_file),
                "--apply",
            ]
            job_id = uuid.uuid4().hex[:12]
            job_state = {
                "jobId": job_id,
                "status": "RUNNING",
                "done": False,
                "total": len(payload["items"]),
                "completed": 0,
                "currentIndex": 0,
                "currentName": payload["items"][0]["name"],
                "percent": 0,
                "createdCount": 0,
                "updatedCount": 0,
                "skippedCount": 0,
                "errorCount": 0,
                "pushedCount": 0,
                "errors": [],
                "logs": [],
                "elapsedSec": 0.0,
                "exportPath": str(export_file),
                "manifestPath": str(manifest_file),
                "fatalError": None,
                "reviews": None,
            }
            with PUSH_JOBS_LOCK:
                PUSH_JOBS[job_id] = job_state
            threading.Thread(
                target=_run_push_job_worker,
                args=(job_id, cmd, payload, export_file, manifest_file, batch_id),
                daemon=True,
            ).start()
            self.send_json(200, {"ok": True, "jobId": job_id, "total": len(payload["items"]), "exportPath": str(export_file)})
            return

        if parsed.path == "/api/push_basa3d":
            export_only = bool(body.get("exportOnly", True))
            mark_pushed = bool(body.get("markPushed", False))
            pricing_cfg = body.get("pricingCfg")
            raw_ids = body.get("ids")
            target_ids = set(str(x) for x in raw_ids) if isinstance(raw_ids, list) and raw_ids else None
            ts_tag = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = f"batch_{ts_tag}"

            with LOCK:
                items = load_items()
                reviews = load_review_state()
                payload = build_basa3d_export_payload(items, reviews, pricing_cfg, target_ids)
                if not payload["items"]:
                    self.send_json(400, {"ok": False, "error": "Chưa có mẫu nào được tick Duyệt (APPROVED) để xuất/đẩy."})
                    return

                EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
                export_file = EXPORTS_DIR / f"basa3d_export_{ts_tag}.json"
                export_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

                if export_only:
                    if mark_pushed:
                        now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        for ex_it in payload["items"]:
                            iid = ex_it["catalogId"]
                            cur = dict(reviews.get(iid) or {})
                            cur.update({
                                "status": "PUSHED",
                                "deferReason": "",
                                "pushedAt": now_iso,
                                "batchId": batch_id,
                                "sourceKey": ex_it["sourceKey"],
                                "updatedAt": now_iso,
                            })
                            reviews[iid] = cur
                        save_review_state(reviews)
                    self.send_json(200, {
                        "ok": True,
                        "mode": "export_only",
                        "exportPath": str(export_file),
                        "exportFilename": export_file.name,
                        "count": payload["count"],
                        "payload": payload,
                        "reviews": reviews,
                    })
                    return

            # Auto-flow: run BaSa3D CLI importer against dev DB outside LOCK, then lock to record PUSHED
            importer_script = BASA3D_REPO_DIR / "scripts" / "stl-import" / "import-from-json.ts"
            if not importer_script.is_file():
                self.send_json(400, {
                    "ok": False,
                    "error": f"Chưa tìm thấy importer tại {importer_script}. Đã xuất sẵn JSON tại {export_file}",
                    "exportPath": str(export_file),
                })
                return

            manifest_file = EXPORTS_DIR / f"basa3d_manifest_{ts_tag}.json"
            npx_bin = "npx.cmd" if os.name == "nt" else "npx"
            cmd = [
                npx_bin, "tsx", "--env-file=.env.local",
                str(importer_script),
                "--json", str(export_file),
                "--out", str(manifest_file),
                "--apply",
            ]
            proc = subprocess.run(
                cmd,
                cwd=str(BASA3D_REPO_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=300,
            )
            manifest = {}
            if manifest_file.is_file():
                try:
                    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
                except Exception:
                    manifest = {}

            if not manifest.get("items") and proc.returncode != 0:
                self.send_json(500, {
                    "ok": False,
                    "error": f"Importer lỗi (exit {proc.returncode}): {(proc.stderr or proc.stdout)[-800:]}",
                    "exportPath": str(export_file),
                })
                return

            pushed_count, errors, reviews = _apply_manifest_to_reviews(payload, manifest, batch_id)

            self.send_json(200, {
                "ok": True,
                "mode": "auto_push_dev",
                "exportPath": str(export_file),
                "manifestPath": str(manifest_file),
                "pushedCount": pushed_count,
                "errors": errors,
                "totals": manifest.get("totals"),
                "reviews": reviews,
            })
            return

        self.send_json(404, {"ok": False, "error": "Unknown API endpoint"})


def main() -> None:
    # Ensure output directories exist on first run
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

    os.chdir(OUT_DIR)
    server = ThreadingHTTPServer((HOST, PORT), CatalogHandler)
    url = f"http://{HOST}:{PORT}/catalog.html"
    print(f"BaSa3D Live Catalog Server running at {url}")
    print(f"  Source data : {DATA_3D_DIR}")
    print(f"  Output cache: {OUT_DIR}")
    print(f"  BaSa3D repo : {BASA3D_REPO_DIR}")
    print("Keep this window open while using live move/delete. Press Ctrl+C to stop.")
    if os.environ.get("NO_OPEN_BROWSER") != "1":
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
