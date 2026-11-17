#!/usr/bin/env python3
r"""
Moves all remaining 3D files/archives from C:\Users\ADMIN\Downloads
(and Downloads\Telegram Desktop, plus the 2 extracted OBJ folders)
into a dedicated staging folder D:\3D_Tu_O_C\ grouped cleanly by set.
Strictly ignores C:\_Backup_Drive and non-3D files (drivers, games, PDFs, etc.).
"""

from __future__ import annotations

import shutil
import time
import zipfile
from pathlib import Path

DL = Path(r"C:\Users\ADMIN\Downloads")
DL_TD = DL / "Telegram Desktop"
DEST_ROOT = Path(r"D:\3D_Tu_O_C")

EXTS_3D = {".3mf", ".stl", ".obj", ".mtl", ".glb", ".nom", ".gcode", ".step", ".stp"}
NON_3D_NAMES = {
    "7D98vHC.zip", "Archive.zip",
    "AULA_F75_Max_Gasket_Mechanical_Keyboard_Driver_1.0.0.5.zip",
    "AULA_F75_RGB.zip", "bt_driver_W11.zip", "epub_library.zip",
    "intel_chipset_600_700.zip", "intel_gna_scoring_accelerator.zip",
    "intel_me_adl_16.1.zip", "intel_Serial_IO_rpl.zip",
    "intel_vga_adl.zip", "intel_wifi_driver_W11.zip",
    "realtek_audio_R.zip", "realtek_pcielan_w11.zip",
    "Photos-1-001.zip", "SimpCAD-X-4.9.1.zip", "Tam_vn_king_world.zip",
    "ACSVH_280626.rar", "OnTapMoPhongSetup_v200_x64.rar",
    "Package.rar", "Patch VH QCBH v1.2.113.rar",
    "PWVH_300325.rar", "UpdateOnTap_v2.0.0_x64.rar",
    "Viet Hoa 1.7-162-1-7-0-1672173061.7z",
}


def is_3d_candidate(fp: Path) -> bool:
    if fp.name in NON_3D_NAMES:
        return False
    ext = fp.suffix.lower()
    if ext in EXTS_3D:
        return True
    if ext in (".zip", ".rar", ".7z"):
        low = fp.name.lower()
        if any(k in low for k in (
            "lineal cosplay", "keychain stl bundle", "keychain1000",
            "league of legends 28", "sonic_guildbook",
        )):
            return True
        if ext == ".zip":
            try:
                with zipfile.ZipFile(fp) as z:
                    return any(n.lower().endswith(tuple(EXTS_3D)) for n in z.namelist())
            except Exception:
                return False
    return False


def target_group(name: str, from_td: bool = False) -> str:
    low = name.lower()
    if low.startswith("lineal cosplay"):
        return "LINEAL_Cosplay_31parts"
    if low == "league of legends 28.rar":
        return "League_of_Legends_28"
    if low.startswith("keychain stl bundle -20260912"):
        return "Keychain_Stl_Bundle_0912_12parts"
    if low.startswith("keychain1000-20260912"):
        return "Keychain1000_0912_7parts"
    if from_td:
        return "Downloads_Telegram_3D"
    return "Other_3D"


def main() -> None:
    t0 = time.time()
    DEST_ROOT.mkdir(parents=True, exist_ok=True)
    moves: list[tuple[Path, Path]] = []

    for fp in sorted(DL.iterdir(), key=lambda x: x.name.lower()):
        if fp.is_file() and is_3d_candidate(fp):
            grp = target_group(fp.name, from_td=False)
            moves.append((fp, DEST_ROOT / grp / fp.name))

    if DL_TD.is_dir():
        for fp in sorted(DL_TD.iterdir(), key=lambda x: x.name.lower()):
            if fp.is_file() and fp.suffix.lower() in EXTS_3D | {".zip", ".rar", ".7z"}:
                grp = target_group(fp.name, from_td=True)
                moves.append((fp, DEST_ROOT / grp / fp.name))

    # Move the 2 extracted OBJ+texture folders too
    obj_folders = ["19043a8917b7fbfe757b91ac1038d6c7", "469229327db7cef04edc5dfabc14eb61"]
    total_bytes = sum(src.stat().st_size for src, _ in moves)
    for fn in obj_folders:
        d = DL / fn
        if d.is_dir():
            total_bytes += sum(f.stat().st_size for f in d.rglob("*") if f.is_file())

    free_d = shutil.disk_usage("D:\\").free
    print(f"Moving {len(moves)} files + OBJ folders = {total_bytes/(1024**3):.2f} GB -> {DEST_ROOT}")
    print(f"D:\\ free before move: {free_d/(1024**3):.2f} GB")
    if total_bytes > free_d - 5 * 1024**3:
        raise SystemExit("Aborting: insufficient free space on D:\\")

    done_bytes = 0
    for idx, (src, dst) in enumerate(moves, 1):
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            i = 2
            while (dst.parent / f"{dst.stem} ({i}){dst.suffix}").exists():
                i += 1
            dst = dst.parent / f"{dst.stem} ({i}){dst.suffix}"
        sz = src.stat().st_size
        shutil.move(str(src), str(dst))
        done_bytes += sz
        if idx % 10 == 0 or idx == len(moves):
            print(f"  Moved {idx}/{len(moves)} ({done_bytes/(1024**3):.2f} GB)")

    for fn in obj_folders:
        d = DL / fn
        if d.is_dir():
            dst_d = DEST_ROOT / "OBJ_Extracted_Folders" / fn
            dst_d.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(d), str(dst_d))
            print(f"  Moved folder {fn}")

    print(
        f"Done in {time.time() - t0:.1f}s! "
        f"C:\\ free={shutil.disk_usage('C:\\\\').free/(1024**3):.2f} GB, "
        f"D:\\ free={shutil.disk_usage('D:\\\\').free/(1024**3):.2f} GB"
    )


if __name__ == "__main__":
    main()
