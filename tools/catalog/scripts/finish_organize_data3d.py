#!/usr/bin/env python3
r"""
Organizes all files currently in D:\Telegram Desktop into D:\data3D\<Category>\,
then removes D:\Telegram Desktop if empty and unlocked.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from migrate_to_data3d import OLD_TD_DIR, DATA_3D_DIR, classify_file

def main() -> None:
    if not OLD_TD_DIR.exists():
        raise SystemExit(f"Missing {OLD_TD_DIR}")
    DATA_3D_DIR.mkdir(parents=True, exist_ok=True)

    folder_counts: dict[str, int] = {}
    locked_files: list[tuple[str, str]] = []

    items = [p for p in OLD_TD_DIR.iterdir()]
    for p in items:
        if p.is_file():
            folder = classify_file(p)
            dest_dir = DATA_3D_DIR / folder
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / p.name
            if dest.exists():
                stem, ext = p.stem, p.suffix
                i = 2
                while (dest_dir / f"{stem} ({i}){ext}").exists():
                    i += 1
                dest = dest_dir / f"{stem} ({i}){ext}"
            try:
                p.rename(dest)
                folder_counts[folder] = folder_counts.get(folder, 0) + 1
            except Exception as exc:
                locked_files.append((p.name, str(exc)))
        elif p.is_dir():
            # Move any unexpected subfolder cleanly into Chưa phân loại
            dest_dir = DATA_3D_DIR / "Chưa phân loại"
            dest_dir.mkdir(parents=True, exist_ok=True)
            try:
                shutil.move(str(p), str(dest_dir / p.name))
                folder_counts["Chưa phân loại (folders)"] = folder_counts.get("Chưa phân loại (folders)", 0) + 1
            except Exception as exc:
                locked_files.append((p.name, str(exc)))

    print("Organized into D:\\data3D:")
    for k in sorted(folder_counts):
        print(f"  {k}: {folder_counts[k]}")

    if locked_files:
        print(f"Locked/skipped items ({len(locked_files)}):", locked_files[:10])

    # Try removing empty D:\Telegram Desktop
    remaining = list(OLD_TD_DIR.iterdir())
    if not remaining:
        try:
            OLD_TD_DIR.rmdir()
            print("Removed empty D:\\Telegram Desktop.")
        except Exception as exc:
            print(f"D:\\Telegram Desktop is now EMPTY, but still open in another app (could not remove folder): {exc}")
    else:
        print(f"Remaining items in D:\\Telegram Desktop: {len(remaining)}")


if __name__ == "__main__":
    main()
