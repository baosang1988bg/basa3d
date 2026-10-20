"""Phần riêng của BaSa3D: cầu nối exec-plan, template override, chọn cổng kiểm tra, --from-file."""
import argparse
from pathlib import Path

import pytest

from tools.swarm.cli import _request_from
from tools.swarm.tests.test_swarm_pipeline import make_pipeline

FEATURE = "001-them-nut-chia-se-chuong"


def test_bridge_exec_plan_written_and_committed(tmp_repo):
    pipe, bus, _ = make_pipeline(tmp_repo)
    pipe.run()
    s = bus.snapshot()
    assert s["status"] == "completed", s["result"]
    wt = Path(s["result"]["worktree"])
    bridge = wt / f"docs/exec-plans/active/feature-{FEATURE}.md"
    text = bridge.read_text(encoding="utf-8")
    assert f"specs/{FEATURE}/spec.md" in text and "close-phase" in text
    # Phase Bridge trích từ plan.md (demo có mục này) + DoD tick theo kết quả cổng kiểm tra
    assert "Phase brief" in text
    assert "- [x] `npm run lint`" in text and "- [x] `npm run typecheck`" in text
    assert "- [ ] `npm run build`" in text      # demo chỉ đổi specs/ → không cần build
    assert "exec-plan.md" in s["artifacts"]


def test_read_template_prefers_overrides(tmp_repo):
    pipe, _, _ = make_pipeline(tmp_repo)
    pipe.prepare()
    ov = pipe.ws.path / ".specify/templates/overrides/plan-template.md"
    ov.parent.mkdir(parents=True, exist_ok=True)
    ov.write_text("# OVERRIDE\n", encoding="utf-8")
    assert pipe.read_template("plan-template.md") == "# OVERRIDE\n"
    assert pipe.read_template("spec-template.md")  # không có override → bản core


@pytest.mark.parametrize("files, expect, absent", [
    (["specs/001-x/demo.md", "docs/roadmap.md"], ["lint", "typecheck", "test"], ["build", "e2e"]),
    (["src/app/page.tsx"], ["lint", "typecheck", "test", "build"], []),
    (["src/services/order.ts"], ["build"], []),
    (["tests/order.test.ts"], ["test"], ["build", "e2e"]),
])
def test_needed_checks(tmp_repo, monkeypatch, files, expect, absent):
    for k in ("TEST_DATABASE_URL", "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"):
        monkeypatch.delenv(k, raising=False)
    pipe, _, _ = make_pipeline(tmp_repo)
    pipe.prepare()
    monkeypatch.setattr(pipe.ws, "changed_files", lambda: files)
    checks = pipe.needed_checks()
    assert all(c in checks for c in expect) and not any(c in checks for c in absent)
    assert "e2e" not in checks  # chưa có TEST_* → không chạy E2E (chỉ cảnh báo)


def test_needed_checks_e2e_when_local_env(tmp_repo, monkeypatch):
    monkeypatch.setenv("TEST_DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:54322/postgres")
    monkeypatch.setenv("TEST_SUPABASE_URL", "http://127.0.0.1:54321")
    monkeypatch.setenv("TEST_SUPABASE_ANON_KEY", "a")
    monkeypatch.setenv("TEST_SUPABASE_SERVICE_ROLE_KEY", "s")
    pipe, _, _ = make_pipeline(tmp_repo)
    pipe.prepare()
    monkeypatch.setattr(pipe.ws, "changed_files", lambda: ["src/app/checkout/page.tsx"])
    assert "e2e" in pipe.needed_checks()
    pipe.cfg.run.e2e = "never"
    assert "e2e" not in pipe.needed_checks()


def test_request_from_file(tmp_repo):
    plan = tmp_repo / "docs/exec-plans/active/phase-37.md"
    plan.parent.mkdir(parents=True)
    plan.write_text("# Phase 37 — Mã giảm giá\n\n- Quyết định đã chốt: giảm theo VND nguyên\n", encoding="utf-8")
    args = argparse.Namespace(request=[], from_file="docs/exec-plans/active/phase-37.md")
    req = _request_from(args, tmp_repo)
    assert req.splitlines()[0] == "Phase 37 — Mã giảm giá"
    assert "Nguồn: docs/exec-plans/active/phase-37.md" in req and "VND nguyên" in req
    with pytest.raises(SystemExit):
        _request_from(argparse.Namespace(request=[], from_file="../../etc/passwd"), tmp_repo)
