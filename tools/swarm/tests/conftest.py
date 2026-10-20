import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]   # gốc repo BaSa3D
if str(ROOT) not in sys.path:                # cho phép `pytest tools/swarm/tests` từ bất kỳ đâu
    sys.path.insert(0, str(ROOT))


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


@pytest.fixture
def tmp_repo(tmp_path):
    """Repo git tạm mô phỏng BaSa3D tối thiểu (Next.js app, migration, templates Spec Kit…)."""
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "AGENTS.md").write_text("# Agent rules\n", encoding="utf-8")
    (repo / "package.json").write_text('{"name": "demo", "scripts": {"lint": "eslint ."}}\n', encoding="utf-8")
    (repo / "src/app").mkdir(parents=True)
    (repo / "src/app/page.tsx").write_text("export default function Page() { return null }\n", encoding="utf-8")
    (repo / "supabase/migrations").mkdir(parents=True)
    (repo / "supabase/migrations/20260101000000_init.sql").write_text("create table t (id int);\n", encoding="utf-8")
    (repo / "tests/helpers").mkdir(parents=True)
    (repo / "tests/helpers/test-environment.ts").write_text("// guard\n", encoding="utf-8")
    (repo / ".env").write_text("SUPABASE_SERVICE_ROLE_KEY=secret\n", encoding="utf-8")
    (repo / ".env.local").write_text("RESEND_API_KEY=secret\n", encoding="utf-8")
    (repo / ".gitignore").write_text(".env\n.env.local\n.swarm/\n", encoding="utf-8")
    tpl = repo / ".specify/templates"
    (tpl / "overrides").mkdir(parents=True)
    for name in ("spec-template.md", "plan-template.md", "tasks-template.md"):
        src = ROOT / ".specify/templates" / name
        if src.is_file():
            shutil.copy(src, tpl / name)
        else:
            (tpl / name).write_text(f"# {name}\n", encoding="utf-8")
        ov = ROOT / ".specify/templates/overrides" / name
        if ov.is_file():
            shutil.copy(ov, tpl / "overrides" / name)
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "add", "-A")
    _git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init")
    return repo
