"""Rào chắn của công cụ agent: đường dẫn, secret, vùng cấm ghi, env đã lọc."""
import pytest

from tools.swarm.context import pack_context, repo_map
from tools.swarm.sandbox import Sandbox, has_e2e_env, sanitized_env
from tools.swarm.workspace import next_feature_number, slugify


@pytest.fixture
def sb(tmp_repo):
    return Sandbox(tmp_repo)


@pytest.mark.parametrize("path", ["../outside.txt", "/etc/passwd", ".git/config", ".env", ".env.local",
                                  "src/.env.production", "credentials.json", ".env.swarm", ".ENV", ".GIT/config",
                                  ".mcp.json", ".vercel/project.json", ".next/BUILD_ID"])
def test_read_blocked(sb, path):
    assert sb.execute("read_file", {"path": path}).startswith("BỊ CHẶN")


@pytest.mark.parametrize("path", ["tools/swarm/pipeline.py", ".github/workflows/ci.yml", ".claude/settings.json",
                                  ".agents/skills/x/SKILL.md", ".specify/memory/constitution.md",
                                  ".vnx-attest/allowed_signers", "scripts/deploy/x.sh", "vercel.json",
                                  "package.json", "package-lock.json", "AGENTS.md", "CODEOWNERS",
                                  "playwright.config.ts", "tests/helpers/test-environment.ts",
                                  "tests/helpers/test-runner.ts", "TOOLS/Swarm/x.py", "Package.JSON"])
def test_write_blocked(sb, path):
    assert sb.execute("write_file", {"path": path, "content": "x"}).startswith("BỊ CHẶN")


def test_migrations_are_create_only(sb):
    old = "supabase/migrations/20260101000000_init.sql"
    assert sb.execute("write_file", {"path": old, "content": "drop table t;"}).startswith("BỊ CHẶN")
    assert sb.execute("edit_file", {"path": old, "old_string": "int", "new_string": "bigint"}).startswith("BỊ CHẶN")
    new = "supabase/migrations/20261020000000_add_x.sql"
    assert sb.execute("write_file", {"path": new, "content": "alter table t add x int;\n"}).startswith("Đã ghi")
    # File migration do chính agent tạo trong run này thì được sửa tiếp.
    assert sb.execute("edit_file", {"path": new, "old_string": "x int", "new_string": "x bigint"}).startswith("Đã sửa")


def test_env_example_readable(sb, tmp_repo):
    (tmp_repo / ".env.example").write_text("A=\n", encoding="utf-8")
    assert "A=" in sb.execute("read_file", {"path": ".env.example"})


def test_write_edit_read_roundtrip(sb):
    assert sb.execute("write_file", {"path": "src/lib/x.ts", "content": "a\nb\na\n"}).startswith("Đã ghi")
    assert "xuất hiện 2 lần" in sb.execute("edit_file", {"path": "src/lib/x.ts", "old_string": "a", "new_string": "c"})
    assert sb.execute("edit_file", {"path": "src/lib/x.ts", "old_string": "b", "new_string": "B"}).startswith("Đã sửa")
    assert "B" in sb.execute("read_file", {"path": "src/lib/x.ts"})
    assert "src/lib/x.ts" in sb.changed


def test_list_and_search_hide_secrets(sb):
    listing = sb.execute("list_files", {})
    assert "page.tsx" in listing and ".env" not in listing.split() and ".env.local" not in listing.split()
    assert "page.tsx" in sb.execute("search", {"pattern": "export default"})
    assert sb.execute("search", {"pattern": "SUPABASE_SERVICE_ROLE_KEY"}) == "(không tìm thấy)"


def test_unknown_tool_and_check(sb):
    assert sb.execute("shell", {"cmd": "npm run deploy"}).startswith("LỖI")
    assert "không tồn tại" in sb.execute("run_check", {"name": "deploy"})


def test_sanitized_env_strips_keys(tmp_path, monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "VERCEL_TOKEN", "GITHUB_TOKEN",
              "RESEND_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.setenv(k, "secret")
    env = sanitized_env(tmp_path)
    assert not any(v == "secret" for v in env.values())
    assert env["HOME"] == str(tmp_path) and env["APPDATA"] == str(tmp_path) and env["CI"] == "1"
    assert env["NEXT_TELEMETRY_DISABLED"] == "1" and env.get("PLAYWRIGHT_BROWSERS_PATH")


def test_test_env_passes_only_local_urls(tmp_path, monkeypatch):
    monkeypatch.setenv("TEST_DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:54322/postgres")
    monkeypatch.setenv("TEST_SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("TEST_SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("TEST_SUPABASE_SERVICE_ROLE_KEY", "svc")
    env = sanitized_env(tmp_path)
    assert env["TEST_DATABASE_URL"].startswith("postgres://") and env["TEST_SUPABASE_SERVICE_ROLE_KEY"] == "svc"
    assert has_e2e_env()
    # Một URL hosted → bỏ HẾT biến TEST_* (không để key hosted lọt vào code do agent viết).
    monkeypatch.setenv("TEST_SUPABASE_URL", "https://abc.supabase.co")
    env = sanitized_env(tmp_path)
    assert not any(k.startswith("TEST_") for k in env) and not has_e2e_env()


def test_e2e_check_skips_without_env(sb, monkeypatch):
    for k in ("TEST_DATABASE_URL", "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"):
        monkeypatch.delenv(k, raising=False)
    ok, out = sb.run_check("e2e")
    assert ok and "SKIP" in out


def test_context_packing_respects_budget_and_skips_secrets(sb):
    ctx, used = pack_context(sb, "Page component", 2000)
    assert "AGENTS.md" in used and ".env" not in used
    assert len(ctx) <= 2000 * 3
    assert "src/app/page.tsx" in repo_map(sb)


def test_slugify_vietnamese_and_numbering(tmp_repo):
    assert slugify("Thêm nút chia sẻ chương lên Zalo/Facebook!", 60) == "them-nut-chia-se-chuong-len-zalo-facebook"
    assert len(slugify("x" * 100)) == 40
    assert slugify("Đổi màu") == "doi-mau"
    (tmp_repo / "specs/007-x").mkdir(parents=True)
    assert next_feature_number(tmp_repo) == 8


def test_sanitized_env_keeps_proxy_and_ca(tmp_path, monkeypatch):
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.local:3128")
    monkeypatch.setenv("no_proxy", "localhost")
    monkeypatch.setenv("NODE_EXTRA_CA_CERTS", "/etc/ca.pem")
    env = sanitized_env(tmp_path)
    assert env["HTTPS_PROXY"] == "http://proxy.local:3128" and env["no_proxy"] == "localhost"
    assert env["NODE_EXTRA_CA_CERTS"] == "/etc/ca.pem"


def test_context_prioritizes_explicitly_named_files(sb, tmp_repo):
    from tools.swarm.context import mentioned_files
    (tmp_repo / "messages").mkdir()
    for n in ("vi", "en"):
        (tmp_repo / f"messages/{n}.json").write_text("{}", encoding="utf-8")
    (tmp_repo / "docs/exec-plans/active").mkdir(parents=True)
    (tmp_repo / "docs/exec-plans/active/old.md").write_text("logo banner footer header " * 50, encoding="utf-8")
    q = "Sửa `src/app/page.tsx` và `messages/{vi,en}.json`, thêm logo banner footer header"
    files = sb.tracked_files()
    assert mentioned_files(q, files) == ["messages/vi.json", "messages/en.json", "src/app/page.tsx"]
    _, used = pack_context(sb, q, 50_000)
    assert used.index("src/app/page.tsx") < used.index("docs/exec-plans/active/old.md")
