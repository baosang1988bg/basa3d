#!/usr/bin/env python3
"""Fast 3MF (slice_info.config + .model mesh) and STL geometry/print-spec extractor.

Matches BaSa3D's FDM estimate model & slice_info parser:
  - e:\\AOO\\BaSa3D\\src\\lib\\parsers\\threemf-slice-info.ts
  - e:\\AOO\\BaSa3D\\src\\lib\\parsers\\mesh-volume.ts
  - e:\\AOO\\BaSa3D\\src\\lib\\pricing\\fdm-estimate-model.ts
"""

from __future__ import annotations

import math
import re
import struct
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from lxml import etree

MAX_3MF_MODEL_BYTES = 120 * 1024 * 1024  # per archive total uncompressed .model cap
MAX_3MF_TRIANGLES = 3_000_000
MAX_STL_BUNDLE_TRIANGLES = 12_000_000

UNIT_TO_MM = {
    "micron": 0.001,
    "millimeter": 1.0,
    "centimeter": 10.0,
    "inch": 25.4,
    "foot": 304.8,
    "meter": 1000.0,
}

# BaSa3D fdm-estimate-model.ts constants
FDM = {
    "SHELL_THICKNESS_MM": 0.9,
    "SUPPORT_FACTOR": 0.1,
    "Q_WALL": 0.35,
    "Q_INFILL": 0.9,
    "Q_SUPPORT": 0.6,
    "MIN_LAYER_SECONDS": 8.0,
    "LAYER_OVERHEAD_SECONDS": 1.5,
    "T_SETUP": 6.0,
    "K_CALIB": 1.0,
    "LAYER_HEIGHT_MM": 0.2,
    "DEFAULT_INFILL_PCT": 15,
    "PLA_DENSITY": 1.24,
    "BUILD_VOLUME_MM": (256.0, 256.0, 256.0),
}

STL_BIN_DTYPE = np.dtype([
    ("normal", "<f4", 3),
    ("verts", "<f4", (3, 3)),
    ("attr", "<u2"),
])


def _estimate_fdm_from_metrics(
    volume_mm3: float,
    surface_mm2: float,
    size_mm: tuple[float, float, float],
    triangles: int,
    filament_type: str = "PLA",
    filament_color: str | None = None,
    plate_count: int = 1,
    colors_count: int = 1,
    max_part_mm: tuple[float, float, float] | None = None,
) -> dict[str, Any]:
    sx, sy, sz = size_mm
    check_dims = max_part_mm or size_mm
    sorted_size = sorted(check_dims)
    sorted_bed = sorted(FDM["BUILD_VOLUME_MM"])
    exceeds_bed = any(a > b for a, b in zip(sorted_size, sorted_bed))

    vol_cm3 = volume_mm3 / 1000.0
    surf_cm2 = surface_mm2 / 100.0
    infill = FDM["DEFAULT_INFILL_PCT"] / 100.0
    shell = min(vol_cm3, (surf_cm2 * FDM["SHELL_THICKNESS_MM"]) / 10.0)
    fill = max(0.0, vol_cm3 - shell)
    support = vol_cm3 * FDM["SUPPORT_FACTOR"]

    density = {
        "PLA": 1.24,
        "PETG": 1.27,
        "ABS": 1.04,
        "ASA": 1.07,
        "TPU": 1.21,
    }.get(filament_type.upper(), FDM["PLA_DENSITY"])
    grams = max(1.0, round(density * (shell + fill * infill + support) * 10.0) / 10.0)

    layers = max(1, math.ceil(sz / FDM["LAYER_HEIGHT_MM"] - 1e-9))
    flow = (
        shell / FDM["Q_WALL"]
        + (fill * infill) / FDM["Q_INFILL"]
        + support / FDM["Q_SUPPORT"]
    )
    layer_floor = (layers * FDM["MIN_LAYER_SECONDS"]) / 60.0
    minutes = FDM["T_SETUP"] + max(flow, layer_floor) + (layers * FDM["LAYER_OVERHEAD_SECONDS"]) / 60.0
    print_minutes = max(1, round(minutes * FDM["K_CALIB"]))

    return {
        "source": "MESH_ESTIMATE",
        "plateCount": max(1, plate_count),
        "printMinutes": print_minutes,
        "grams": grams,
        "filaments": [{
            "id": "1",
            "type": filament_type.upper() or "PLA",
            "color": filament_color,
            "grams": grams,
        }],
        "colorsCount": max(1, colors_count),
        "volumeCm3": round(vol_cm3, 2),
        "surfaceCm2": round(surf_cm2, 2),
        "sizeMm": [round(sx, 1), round(sy, 1), round(sz, 1)],
        "triangles": int(triangles),
        "exceedsBed": exceeds_bed,
    }


def _parse_slice_info_xml(raw_xml: str) -> dict[str, Any] | None:
    try:
        root = ET.fromstring(raw_xml)
    except Exception:
        return None
    plates = root.findall(".//plate")
    if not plates:
        return None

    total_sec = 0.0
    fil_totals: dict[tuple[str, str], dict[str, Any]] = {}
    for plate in plates:
        for meta in plate.findall("metadata"):
            if meta.attrib.get("key") == "prediction":
                try:
                    total_sec += float(meta.attrib.get("value", "0"))
                except ValueError:
                    pass
        for fil in plate.findall("filament"):
            fid = str(fil.attrib.get("id", ""))
            ftype = (fil.attrib.get("type") or "").strip().upper() or "PLA"
            fcolor = fil.attrib.get("color") or None
            try:
                ug = float(fil.attrib.get("used_g", "0"))
            except ValueError:
                ug = 0.0
            if ug <= 0:
                continue
            key = (fid, fcolor or "")
            if key in fil_totals:
                fil_totals[key]["grams"] += ug
            else:
                fil_totals[key] = {
                    "id": fid,
                    "type": ftype,
                    "color": fcolor,
                    "grams": ug,
                }

    if not fil_totals or total_sec <= 0:
        return None

    fils = []
    for f in fil_totals.values():
        f_copy = dict(f)
        f_copy["grams"] = round(f["grams"], 2)
        fils.append(f_copy)

    total_grams = round(sum(f["grams"] for f in fils), 1)
    print_minutes = max(1, round(total_sec / 60.0))
    return {
        "source": "SLICED",
        "plateCount": len(plates),
        "printMinutes": print_minutes,
        "grams": total_grams,
        "filaments": fils,
        "colorsCount": len(fils),
    }


def _parse_transform(val: str | None) -> tuple[np.ndarray, np.ndarray]:
    if not val:
        return np.eye(3, dtype=np.float64), np.zeros(3, dtype=np.float64)
    parts = val.strip().split()
    if len(parts) != 12:
        return np.eye(3, dtype=np.float64), np.zeros(3, dtype=np.float64)
    try:
        m = [float(x) for x in parts]
    except ValueError:
        return np.eye(3, dtype=np.float64), np.zeros(3, dtype=np.float64)
    mat3 = np.array([
        [m[0], m[1], m[2]],
        [m[3], m[4], m[5]],
        [m[6], m[7], m[8]],
    ], dtype=np.float64)
    trans = np.array([m[9], m[10], m[11]], dtype=np.float64)
    return mat3, trans


def _extract_3mf_geometry(z: zipfile.ZipFile, names: list[str]) -> tuple[float, float, tuple[float, float, float], int] | str:
    model_infos = [
        info for info in z.infolist()
        if info.filename.lower().endswith(".model") and "__MACOSX" not in info.filename
    ]
    if not model_infos:
        return "NO_MODEL"
    total_xml_bytes = sum(i.file_size for i in model_infos)
    if total_xml_bytes > MAX_3MF_MODEL_BYTES:
        return "MESH_TOO_LARGE"

    # Load main model + component models with lxml
    parser = etree.XMLParser(resolve_entities=False, huge_tree=True)
    main_name = next((i.filename for i in model_infos if i.filename.lower() == "3d/3dmodel.model"), model_infos[0].filename)

    objects: dict[tuple[str, str], dict[str, Any]] = {}
    build_items: list[tuple[str, str, np.ndarray, np.ndarray]] = []
    unit_scale = 1.0
    parsed_files: set[str] = set()
    tri_budget = 0

    def load_model(mpath: str) -> None:
        nonlocal unit_scale, tri_budget
        norm_p = mpath.lstrip("/").lower()
        if norm_p in parsed_files:
            return
        parsed_files.add(norm_p)
        actual = next((i.filename for i in model_infos if i.filename.lower() == norm_p), None)
        if not actual:
            return
        root = etree.fromstring(z.read(actual), parser=parser)
        if norm_p == main_name.lower():
            unit_name = (root.attrib.get("unit") or "millimeter").lower()
            unit_scale = UNIT_TO_MM.get(unit_name, 1.0)

        for obj in root.iter():
            tag = obj.tag.rsplit("}", 1)[-1]
            if tag == "object":
                oid = obj.attrib.get("id", "")
                if not oid:
                    continue
                mesh_el = None
                comps_el = None
                for ch in obj:
                    ctag = ch.tag.rsplit("}", 1)[-1]
                    if ctag == "mesh":
                        mesh_el = ch
                    elif ctag == "components":
                        comps_el = ch
                if mesh_el is not None:
                    verts_list = []
                    tris_list = []
                    for mch in mesh_el:
                        mtag = mch.tag.rsplit("}", 1)[-1]
                        if mtag == "vertices":
                            for v in mch:
                                va = v.attrib
                                verts_list.append((float(va["x"]), float(va["y"]), float(va["z"])))
                        elif mtag == "triangles":
                            for t in mch:
                                ta = t.attrib
                                tris_list.append((int(ta["v1"]), int(ta["v2"]), int(ta["v3"])))
                    tri_budget += len(tris_list)
                    if tri_budget > MAX_3MF_TRIANGLES:
                        raise OverflowError("MESH_TOO_LARGE")
                    if verts_list and tris_list:
                        V = np.asarray(verts_list, dtype=np.float64)
                        T = np.asarray(tris_list, dtype=np.int32)
                        objects[(norm_p, oid)] = {"type": "mesh", "V": V, "T": T}
                elif comps_el is not None:
                    comps = []
                    for c in comps_el:
                        if c.tag.rsplit("}", 1)[-1] != "component":
                            continue
                        cid = c.attrib.get("objectid", "")
                        # p:path attribute uses production namespace
                        cpath = None
                        for k, v in c.attrib.items():
                            if k == "path" or k.endswith("}path"):
                                cpath = v
                                break
                        target_p = cpath.lstrip("/").lower() if cpath else norm_p
                        mat3, trans = _parse_transform(c.attrib.get("transform"))
                        comps.append((target_p, cid, mat3, trans))
                    objects[(norm_p, oid)] = {"type": "comps", "comps": comps}

            elif tag == "build" and norm_p == main_name.lower():
                for it in obj:
                    if it.tag.rsplit("}", 1)[-1] != "item":
                        continue
                    oid = it.attrib.get("objectid", "")
                    ipath = None
                    for k, v in it.attrib.items():
                        if k == "path" or k.endswith("}path"):
                            ipath = v
                            break
                    target_p = ipath.lstrip("/").lower() if ipath else norm_p
                    mat3, trans = _parse_transform(it.attrib.get("transform"))
                    build_items.append((target_p, oid, mat3, trans))

    try:
        load_model(main_name)
        # Load any referenced component model files
        queue = [c[0] for c in build_items]
        for key_obj in list(objects.values()):
            if key_obj["type"] == "comps":
                for c in key_obj["comps"]:
                    queue.append(c[0])
        while queue:
            mp = queue.pop()
            if mp not in parsed_files:
                load_model(mp)
                for key_obj in list(objects.values()):
                    if key_obj["type"] == "comps":
                        for c in key_obj["comps"]:
                            if c[0] not in parsed_files:
                                queue.append(c[0])
    except OverflowError:
        return "MESH_TOO_LARGE"
    except Exception:
        return "MESH_INVALID"

    # Evaluate build items; fallback to all mesh objects if <build> empty
    if not build_items:
        for (mp, oid), obj in objects.items():
            if obj["type"] == "mesh":
                build_items.append((mp, oid, np.eye(3, dtype=np.float64), np.zeros(3, dtype=np.float64)))

    total_signed_vol = 0.0
    total_area = 0.0
    total_tris = 0
    item_max_dims = [0.0, 0.0, 0.0]

    # Cache mesh stats when transform is uniform/orthogonal, else transform vertices
    def eval_node(
        mp: str,
        oid: str,
        mat3: np.ndarray,
        trans: np.ndarray,
        bounds_out: list[np.ndarray],
        depth: int = 0,
    ) -> None:
        nonlocal total_signed_vol, total_area, total_tris
        if depth > 16:
            return
        obj = objects.get((mp, oid))
        if not obj:
            return
        if obj["type"] == "comps":
            for cm_p, cm_id, c_mat, c_trans in obj["comps"]:
                # inner (c) applied first, then outer (mat3, trans): p' = (p @ c_mat + c_trans) @ mat3 + trans
                new_mat = c_mat @ mat3
                new_trans = c_trans @ mat3 + trans
                eval_node(cm_p, cm_id, new_mat, new_trans, bounds_out, depth + 1)
            return

        V = obj["V"]
        T = obj["T"]
        total_tris += len(T)
        if total_tris > MAX_3MF_TRIANGLES * 2:
            raise OverflowError("MESH_TOO_LARGE")
        Vt = (V @ mat3 + trans) * unit_scale
        bounds_out[0] = np.minimum(bounds_out[0], Vt.min(axis=0))
        bounds_out[1] = np.maximum(bounds_out[1], Vt.max(axis=0))

        p0 = Vt[T[:, 0]]
        p1 = Vt[T[:, 1]]
        p2 = Vt[T[:, 2]]
        cross = np.cross(p1 - p0, p2 - p0)
        area2 = np.linalg.norm(cross, axis=1)
        total_area += float(area2.sum() * 0.5)
        signed = np.einsum("ij,ij->i", p0, np.cross(p1, p2)).sum() / 6.0
        total_signed_vol += abs(float(signed))

    g_min = np.array([np.inf, np.inf, np.inf])
    g_max = np.array([-np.inf, -np.inf, -np.inf])
    try:
        for mp, oid, mat3, trans in build_items:
            ibounds = [np.array([np.inf, np.inf, np.inf]), np.array([-np.inf, -np.inf, -np.inf])]
            eval_node(mp, oid, mat3, trans, ibounds)
            if np.all(np.isfinite(ibounds[0])):
                dims = (ibounds[1] - ibounds[0]).tolist()
                item_max_dims = [max(a, b) for a, b in zip(item_max_dims, dims)]
                g_min = np.minimum(g_min, ibounds[0])
                g_max = np.maximum(g_max, ibounds[1])
    except OverflowError:
        return "MESH_TOO_LARGE"
    except Exception:
        return "MESH_INVALID"

    if total_tris == 0 or not np.all(np.isfinite(g_min)) or total_signed_vol <= 0:
        return "MESH_INVALID"

    # Use largest individual item dims when multiple items exist across plates
    if len(build_items) > 1 and max(item_max_dims) > 0:
        sx, sy, sz = item_max_dims
    else:
        sx, sy, sz = (g_max - g_min).tolist()
    return total_signed_vol, total_area, (sx, sy, sz), total_tris


def extract_3mf_print_info(fp: Path, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    meta = meta or {}
    try:
        with zipfile.ZipFile(fp) as z:
            names = z.namelist()
            si_name = next((n for n in names if n in ("Metadata/slice_info.config", "Metadata/slice_info.xml")), None)
            if si_name:
                raw_si = z.read(si_name).decode("utf-8", errors="ignore")
                sliced = _parse_slice_info_xml(raw_si)
                if sliced:
                    return sliced

            # Unsliced: parse mesh geometry + detected filament info from project_settings
            geom = _extract_3mf_geometry(z, names)
            if isinstance(geom, str):
                return {"source": geom, "plateCount": int(meta.get("plates") or 1)}

            vol_mm3, area_mm2, size_mm, tris = geom
            ftypes = meta.get("filament") or []
            colors = meta.get("colors") or []
            primary_type = str(ftypes[0]).upper() if ftypes else "PLA"
            primary_color = colors[0] if colors else None
            return _estimate_fdm_from_metrics(
                vol_mm3,
                area_mm2,
                size_mm,
                tris,
                filament_type=primary_type,
                filament_color=primary_color,
                plate_count=int(meta.get("plates") or 1),
                colors_count=max(1, len(colors), len(ftypes)),
            )
    except Exception:
        return {"source": "MESH_INVALID"}


def _parse_single_stl(fp: Path) -> tuple[float, float, np.ndarray, np.ndarray, int] | None:
    data = fp.read_bytes()
    if len(data) < 84:
        return None
    # Check binary vs ASCII STL cleanly (matching BaSa3D mesh-metrics.ts heuristic)
    tri_count = struct.unpack_from("<I", data, 80)[0]
    expected_len = 84 + tri_count * 50
    is_bin = (
        tri_count > 0
        and expected_len <= len(data)
        and expected_len >= len(data) - 64
        and not data[:80].lstrip().startswith(b"solid")
    )
    # Also accept binary STL whose 80-byte header happens to start with "solid" when size matches exactly
    if not is_bin and tri_count > 0 and expected_len == len(data):
        is_bin = True

    if is_bin:
        if tri_count > MAX_STL_BUNDLE_TRIANGLES:
            raise OverflowError("MESH_TOO_LARGE")
        arr = np.frombuffer(data, dtype=STL_BIN_DTYPE, count=tri_count, offset=84)
        V = arr["verts"].astype(np.float64, copy=False)  # (N, 3, 3)
        p0 = V[:, 0, :]
        p1 = V[:, 1, :]
        p2 = V[:, 2, :]
    else:
        # ASCII STL fallback
        txt = data.decode("utf-8", errors="ignore")
        nums = re.findall(r"vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)", txt)
        n_tris = len(nums) // 3
        if n_tris == 0:
            return None
        if n_tris > MAX_STL_BUNDLE_TRIANGLES:
            raise OverflowError("MESH_TOO_LARGE")
        V = np.asarray(nums[: n_tris * 3], dtype=np.float64).reshape(n_tris, 3, 3)
        p0 = V[:, 0, :]
        p1 = V[:, 1, :]
        p2 = V[:, 2, :]

    cross = np.cross(p1 - p0, p2 - p0)
    area = float(np.linalg.norm(cross, axis=1).sum() * 0.5)
    signed = float(np.einsum("ij,ij->i", p0, np.cross(p1, p2)).sum() / 6.0)
    vmin = np.minimum(np.minimum(p0.min(axis=0), p1.min(axis=0)), p2.min(axis=0))
    vmax = np.maximum(np.maximum(p0.max(axis=0), p1.max(axis=0)), p2.max(axis=0))
    return abs(signed), area, vmin, vmax, int(len(p0))


def extract_stl_bundle_print_info(mesh_paths: list[Path]) -> dict[str, Any]:
    stl_files = [p for p in mesh_paths if p.suffix.lower() == ".stl"]
    if not stl_files:
        return {"source": "NO_STL"}
    tot_vol = 0.0
    tot_area = 0.0
    tot_tris = 0
    part_max_dims = [0.0, 0.0, 0.0]

    try:
        for p in stl_files:
            res = _parse_single_stl(p)
            if not res:
                continue
            vol, area, vmin, vmax, tris = res
            tot_tris += tris
            if tot_tris > MAX_STL_BUNDLE_TRIANGLES:
                return {"source": "MESH_TOO_LARGE"}
            tot_vol += vol
            tot_area += area
            dims = (vmax - vmin).tolist()
            part_max_dims = [max(a, b) for a, b in zip(part_max_dims, dims)]
    except OverflowError:
        return {"source": "MESH_TOO_LARGE"}
    except Exception:
        return {"source": "MESH_INVALID"}

    if tot_tris == 0 or max(part_max_dims) <= 0 or tot_vol <= 0:
        return {"source": "MESH_INVALID"}

    return _estimate_fdm_from_metrics(tot_vol, tot_area, tuple(part_max_dims), tot_tris)
