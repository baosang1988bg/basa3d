"""Công cụ cho agent (function calling) — giới hạn trong worktree, không có shell tuỳ ý.

Rào chắn (BaSa3D):
- Đường dẫn phải nằm trong worktree; cấm `.git/`, file secret, `node_modules/`, `.next*/`, `.vercel/`.
- Cấm ghi vùng bảo vệ: CI (`.github/`), swarm (`tools/swarm/`), cấu hình agent, attestation
  (`.vnx-attest/`), deploy (`scripts/deploy/`, `vercel.json`), `package.json`/lock (chặn chèn lệnh vào
  npm scripts + thêm dependency lén), và các file cô lập test (`tests/helpers/test-environment.ts`,
  `tests/helpers/test-runner.ts`, `playwright.config.ts`) — chúng là chốt chặn "chỉ DB local".
- Migration: chỉ được TẠO file mới trong `supabase/migrations/`, không sửa migration đã có.
- Chỉ chạy được các cổng kiểm tra cố định (CHECKS). Tiến trình con nhận biến môi trường đã lọc
  (không API key / token Vercel / Supabase app) và HOME trỏ vào thư mục tạm. Chỉ các biến `TEST_*`
  trỏ tới localhost được truyền qua (DB/Supabase dùng-một-lần cho `npm test` và E2E).
LƯU Ý: chạy test = chạy code do agent viết. Đây là phòng thủ nhiều lớp, không thay
cho việc bạn review diff trước khi push.
"""
from __future__ import annotations

import fnmatch
import os
import re
import shutil
import site
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

MAX_RESULT_CHARS = 20_000
MAX_READ_LINES = 800
CHECK_TIMEOUT_S = 1200   # next build + npm test có DB có thể mất vài phút

SECRET_NAMES = {
    ".env", ".env.swarm", ".env.local", ".dev.vars", "credentials.json", "token.json",
    ".npmrc", ".pypirc", "id_rsa", "id_ed25519", ".mcp.json",
}
DENY_ALL_PREFIXES = (".git/", "node_modules/", ".swarm/", ".next/", ".next-test/", ".vercel/",
                     ".vnx-data/", ".local-backups/", ".model-previews/", ".claude/worktrees/")
DENY_WRITE_PREFIXES = (".github/", "tools/swarm/", ".claude/", ".agents/", ".specify/", ".vnx/",
                       ".vnx-attest/", "scripts/deploy/", "supabase/seed")
DENY_WRITE_FILES = {
    "package.json", "package-lock.json", "vercel.json", ".vercelignore", "codeowners",
    "agents.md", "claude.md", "gemini.md", "playwright.config.ts",
    "tests/helpers/test-environment.ts", "tests/helpers/test-runner.ts",
}
CREATE_ONLY_PREFIXES = ("supabase/migrations/",)   # migration cũ là bất biến

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
TEST_ENV_KEYS = ("TEST_DATABASE_URL", "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY",
                 "TEST_SUPABASE_SERVICE_ROLE_KEY")


class SandboxError(Exception):
    pass


def _is_secret(rel: str) -> bool:
    name = PurePosixPath(rel).name.lower()  # FS macOS/Windows không phân biệt hoa/thường (.ENV == .env)
    if name in SECRET_NAMES:
        return True
    # .env.local, .env.production … (nhưng cho phép *.example)
    return name.startswith(".env.") and not name.endswith(".example")


def _is_local_url(value: str) -> bool:
    try:
        host = (urlparse(value).hostname or "").strip("[]").lower()
    except ValueError:
        return False
    return host in LOCAL_HOSTS


def test_env() -> dict[str, str]:
    """Biến TEST_* cho DB/Supabase local. Bỏ hết nếu URL nào không phải localhost.

    `tests/helpers/test-environment.ts` cũng chặn host không phải local — đây là lớp thứ hai,
    để key của một Supabase hosted không bao giờ lọt vào tiến trình chạy code do agent viết.
    """
    vals = {k: os.environ[k] for k in TEST_ENV_KEYS if os.environ.get(k)}
    for k in ("TEST_DATABASE_URL", "TEST_SUPABASE_URL"):
        if k in vals and not _is_local_url(vals[k]):
            return {}
    return vals


def has_db_test_env() -> bool:
    return "TEST_DATABASE_URL" in test_env()


def has_e2e_env() -> bool:
    return all(k in test_env() for k in TEST_ENV_KEYS)


def _playwright_browsers() -> str:
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        return os.environ["PLAYWRIGHT_BROWSERS_PATH"]
    home = Path.home()
    if sys.platform == "darwin":
        return str(home / "Library/Caches/ms-playwright")
    if os.environ.get("LOCALAPPDATA"):
        return str(Path(os.environ["LOCALAPPDATA"]) / "ms-playwright")
    return str(home / ".cache/ms-playwright")


def sanitized_env(sandbox_home: Path) -> dict[str, str]:
    keep = {
        "PATH", "PATHEXT", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "OS",
        "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "LANG", "LC_ALL", "TZ",
        "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "COMMONPROGRAMFILES",
        "NVM_HOME", "NVM_SYMLINK", "NVM_DIR", "VOLTA_HOME", "FNM_DIR", "USER", "LOGNAME", "SHELL",
        # Mạng công ty / sandbox: thiếu proxy + CA nội bộ thì `npm ci` không tới được registry.
        "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "ALL_PROXY",
        "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE",
    }
    env = {k: v for k, v in os.environ.items() if k.upper() in keep}
    for k in ("npm_config_proxy", "npm_config_https_proxy", "npm_config_noproxy", "npm_config_cafile"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    real_home = Path.home()
    npm_cache = os.environ.get("npm_config_cache") or (
        str(Path(os.environ["LOCALAPPDATA"]) / "npm-cache") if os.environ.get("LOCALAPPDATA")
        else str(real_home / ".npm")
    )
    home = str(sandbox_home)
    env.update({
        "HOME": home, "USERPROFILE": home, "APPDATA": home, "LOCALAPPDATA": home,
        "XDG_CONFIG_HOME": home, "TEMP": home, "TMP": home, "TMPDIR": home,
        "npm_config_cache": npm_cache,                    # giữ cache npm để cài nhanh
        "PLAYWRIGHT_BROWSERS_PATH": _playwright_browsers(),  # dùng browser đã cài, không tải lại
        "PYTHONUSERBASE": site.getuserbase() or "",
        "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1",
        "CI": "1", "FORCE_COLOR": "0", "NO_COLOR": "1",
        "NEXT_TELEMETRY_DISABLED": "1",
    })
    env.update(test_env())
    return env


def _which(cmd: str) -> str:
    path = shutil.which(cmd)
    if not path:
        raise SandboxError(f"Không tìm thấy '{cmd}' trong PATH")
    return path


def _checks() -> dict[str, dict]:
    return {
        "lint": {"desc": "ESLint toàn repo (npm run lint)",
                 "argv": lambda: [_which("npm"), "run", "lint"], "needs": ["root"]},
        "typecheck": {"desc": "TypeScript tsc --noEmit (npm run typecheck)",
                      "argv": lambda: [_which("npm"), "run", "typecheck"], "needs": ["root"]},
        "test": {"desc": "npm test (node --test qua tsx; có TEST_DATABASE_URL thì chạy cả test DB + next build)",
                 "argv": lambda: [_which("npm"), "test"], "needs": ["root"]},
        "build": {"desc": "next build production (npm run build)",
                  "argv": lambda: [_which("npm"), "run", "build"], "needs": ["root"]},
        "e2e": {"desc": "Playwright E2E (cần TEST_* trỏ tới Supabase local)",
                "argv": lambda: [_which("npx"), "playwright", "test"], "needs": ["root"],
                "requires": has_e2e_env,
                "skip_msg": "Bỏ qua: chưa đặt đủ TEST_DATABASE_URL/TEST_SUPABASE_* (localhost) trong .env.swarm"},
    }


CHECK_NAMES = tuple(_checks().keys())


class Sandbox:
    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self._home = Path(tempfile.mkdtemp(prefix="swarm-home-"))
        self.changed: set[str] = set()
        self.created: set[str] = set()   # file do agent tạo trong run này (được sửa tiếp)

    # ------------------------------------------------------------ paths
    def rel(self, path: str) -> str:
        if not path or "\x00" in path:
            raise SandboxError("Đường dẫn rỗng/không hợp lệ")
        p = Path(path)
        full = (p if p.is_absolute() else self.root / p).resolve()
        try:
            rel = full.relative_to(self.root).as_posix()
        except ValueError:
            raise SandboxError(f"Ngoài worktree: {path}") from None
        if rel == ".":
            return ""
        check = (rel + ("/" if full.is_dir() else "")).lower()
        if any(check.startswith(pfx.lower()) or ("/" + pfx.lower()) in "/" + check for pfx in DENY_ALL_PREFIXES):
            raise SandboxError(f"Cấm truy cập: {rel}")
        if _is_secret(rel):
            raise SandboxError(f"Cấm truy cập file secret: {rel}")
        return rel

    def _writable(self, path: str) -> Path:
        rel = self.rel(path)
        if not rel:
            raise SandboxError("Không ghi được vào thư mục gốc")
        low = rel.lower()
        name = PurePosixPath(low).name
        if (any(low.startswith(p.lower()) for p in DENY_WRITE_PREFIXES) or low in DENY_WRITE_FILES
                or (name in DENY_WRITE_FILES and "/" not in low)):
            raise SandboxError(f"Cấm ghi: {rel} (vùng được bảo vệ)")
        full = self.root / rel
        if any(low.startswith(p) for p in CREATE_ONLY_PREFIXES) and full.exists() and rel not in self.created:
            raise SandboxError(f"Cấm sửa migration đã có: {rel} — hãy tạo migration MỚI")
        return full

    # ------------------------------------------------------------ git file list
    def tracked_files(self) -> list[str]:
        # -z: không bị git "quote" đường dẫn có ký tự tiếng Việt/Trung.
        out = subprocess.run(
            [_which("git"), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=self.root, capture_output=True, text=True, encoding="utf-8", errors="replace",
        ).stdout
        files = []
        for f in dict.fromkeys(x for x in out.split("\0") if x):
            try:
                self.rel(f)
            except SandboxError:
                continue
            files.append(f)
        return files

    # ------------------------------------------------------------ tools
    def list_files(self, path: str = "", glob: str | None = None) -> str:
        base = self.rel(path) if path else ""
        files = [f for f in self.tracked_files() if not base or f.startswith(base.rstrip("/") + "/") or f == base]
        if glob:
            files = [f for f in files if fnmatch.fnmatch(f, glob) or fnmatch.fnmatch(PurePosixPath(f).name, glob)]
        head = files[:400]
        more = f"\n…và {len(files) - 400} file nữa" if len(files) > 400 else ""
        return "\n".join(head) + more if head else "(không có file)"

    def read_file(self, path: str, start_line: int = 1, end_line: int | None = None) -> str:
        rel = self.rel(path)
        full = self.root / rel
        if not full.is_file():
            return f"LỖI: không có file {rel}"
        lines = full.read_text(encoding="utf-8", errors="replace").splitlines()
        start = max(1, int(start_line or 1))
        end = min(len(lines), int(end_line) if end_line else start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1)
        body = "\n".join(f"{i:>5}\t{lines[i - 1]}" for i in range(start, end + 1))
        tail = f"\n(file có {len(lines)} dòng; đọc tiếp bằng start_line={end + 1})" if end < len(lines) else ""
        return f"{rel} (dòng {start}-{end})\n{body}{tail}"

    def search(self, pattern: str, glob: str | None = None) -> str:
        try:
            rx = re.compile(pattern)
        except re.error as e:
            return f"LỖI regex: {e}"
        hits = []
        for f in self.tracked_files():
            if glob and not (fnmatch.fnmatch(f, glob) or fnmatch.fnmatch(PurePosixPath(f).name, glob)):
                continue
            full = self.root / f
            try:
                if full.stat().st_size > 1_000_000:
                    continue
                for n, line in enumerate(full.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                    if rx.search(line):
                        hits.append(f"{f}:{n}: {line.strip()[:200]}")
                        if len(hits) >= 100:
                            return "\n".join(hits) + "\n…(dừng ở 100 kết quả)"
            except OSError:
                continue
        return "\n".join(hits) or "(không tìm thấy)"

    def write_file(self, path: str, content: str) -> str:
        full = self._writable(path)
        existed = full.exists()
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8", newline="\n")
        rel = self.rel(path)
        self.changed.add(rel)
        if not existed:
            self.created.add(rel)
        return f"Đã ghi {rel} ({len(content.splitlines())} dòng)"

    def edit_file(self, path: str, old_string: str, new_string: str) -> str:
        full = self._writable(path)
        if not full.is_file():
            return f"LỖI: không có file {path}"
        text = full.read_text(encoding="utf-8")
        n = text.count(old_string) if old_string else 0
        if n != 1:
            return f"LỖI: old_string xuất hiện {n} lần (cần đúng 1). Đọc lại file và lấy đoạn dài hơn."
        full.write_text(text.replace(old_string, new_string, 1), encoding="utf-8", newline="\n")
        rel = self.rel(path)
        self.changed.add(rel)
        return f"Đã sửa {rel}"

    def ensure_deps(self, needs: list[str]) -> str:
        notes = []
        if "root" in needs and not (self.root / "node_modules").is_dir():
            npm = _which("npm")
            r = self._run([npm, "ci", "--no-audit", "--no-fund"])
            notes.append(f"npm ci → exit {r[0]}")
            if r[0] != 0 and "EUSAGE" in r[1]:
                # Lock lệch package.json (vd optional peer mà npm 10 coi là thiếu). Không sửa lock thay
                # người dùng: cài theo lock hiện có nhưng không ghi lại file nào (package-lock.json bị khoá).
                r = self._run([npm, "install", "--no-audit", "--no-fund", "--no-save", "--package-lock=false"])
                notes.append(f"lock lệch → npm install --no-save → exit {r[0]} "
                             "(nên chạy `npm install` để cập nhật package-lock.json)")
        return "; ".join(notes)

    def _run(self, argv: list[str]) -> tuple[int, str]:
        try:
            p = subprocess.run(
                argv, cwd=self.root, env=sanitized_env(self._home), capture_output=True,
                text=True, encoding="utf-8", errors="replace", timeout=CHECK_TIMEOUT_S,
            )
            return p.returncode, (p.stdout or "") + (p.stderr or "")
        except subprocess.TimeoutExpired:
            return 124, f"Quá thời gian {CHECK_TIMEOUT_S}s"
        except OSError as e:
            return 127, f"Không chạy được: {e}"

    def run_check(self, name: str) -> tuple[bool, str]:
        checks = _checks()
        if name not in checks:
            return False, f"LỖI: check '{name}' không tồn tại. Chọn: {', '.join(checks)}"
        c = checks[name]
        if c.get("requires") and not c["requires"]():
            return True, f"[{name}] SKIP — {c.get('skip_msg', 'thiếu điều kiện chạy')}"
        try:
            prep = self.ensure_deps(c["needs"])
            code, out = self._run(c["argv"]())
        except SandboxError as e:
            return False, f"LỖI: {e}"
        tail = out[-6000:]
        head = f"[{name}] exit {code}" + (f" ({prep})" if prep else "")
        return code == 0, f"{head}\n{tail}"

    # ------------------------------------------------------------ dispatch
    def execute(self, name: str, args: dict) -> str:
        try:
            if name == "list_files":
                res = self.list_files(args.get("path", ""), args.get("glob"))
            elif name == "read_file":
                res = self.read_file(args["path"], args.get("start_line", 1), args.get("end_line"))
            elif name == "search":
                res = self.search(args["pattern"], args.get("glob"))
            elif name == "write_file":
                res = self.write_file(args["path"], args["content"])
            elif name == "edit_file":
                res = self.edit_file(args["path"], args["old_string"], args["new_string"])
            elif name == "run_check":
                ok, out = self.run_check(args.get("name", ""))
                res = ("PASS\n" if ok else "FAIL\n") + out
            else:
                res = f"LỖI: công cụ '{name}' không tồn tại"
        except SandboxError as e:
            res = f"BỊ CHẶN: {e}"
        except KeyError as e:
            res = f"LỖI: thiếu tham số {e}"
        if len(res) > MAX_RESULT_CHARS:
            res = res[:MAX_RESULT_CHARS] + "\n…(cắt bớt)"
        return res


def _fn(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {
        "name": name, "description": desc,
        "parameters": {"type": "object", "properties": props, "required": required},
    }}


TOOL_DEFS = {
    "list_files": _fn("list_files", "Liệt kê file trong repo (đã lọc file secret).",
                      {"path": {"type": "string", "description": "Thư mục con, mặc định gốc"},
                       "glob": {"type": "string", "description": "Mẫu glob, vd '*.tsx'"}}, []),
    "read_file": _fn("read_file", f"Đọc file kèm số dòng (tối đa {MAX_READ_LINES} dòng/lần).",
                     {"path": {"type": "string"}, "start_line": {"type": "integer"}, "end_line": {"type": "integer"}},
                     ["path"]),
    "search": _fn("search", "Tìm regex trong các file của repo.",
                  {"pattern": {"type": "string"}, "glob": {"type": "string"}}, ["pattern"]),
    "write_file": _fn("write_file", "Ghi TOÀN BỘ nội dung file (tạo mới hoặc ghi đè).",
                      {"path": {"type": "string"}, "content": {"type": "string"}}, ["path", "content"]),
    "edit_file": _fn("edit_file", "Thay đúng 1 lần old_string bằng new_string (old_string phải duy nhất).",
                     {"path": {"type": "string"}, "old_string": {"type": "string"}, "new_string": {"type": "string"}},
                     ["path", "old_string", "new_string"]),
    "run_check": _fn("run_check", "Chạy một cổng kiểm tra cố định. Không có shell tuỳ ý.",
                     {"name": {"type": "string", "enum": list(CHECK_NAMES)}}, ["name"]),
    "finish": _fn("finish", "Báo đã xong phần việc, kèm tóm tắt thay đổi.",
                  {"summary": {"type": "string"}}, ["summary"]),
}


def tool_defs(names: list[str]) -> list[dict]:
    return [TOOL_DEFS[n] for n in names]
