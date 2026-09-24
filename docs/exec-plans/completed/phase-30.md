# Phase 30 — Text-to-CAD Agent Skill (Internal Tooling)

> **Mục đích**: Cài `earthtojake/text-to-cad` (skill package cho Claude Code/Codex, MIT, 15.8k
> sao, cập nhật thường xuyên) ở cấp project, để bất kỳ agent nào làm việc trong repo BaSa3D có thể
> sinh file CAD thật (STEP/STL/3MF) từ mô tả tự nhiên — dùng để phác thảo nhanh ý tưởng sản phẩm
> mới, hoặc xử lý custom-print order đặc biệt không khớp 8 tool parametric hiện có
> (`src/lib/3d-tools/*`, Phase 17/20-26). Đây **không phải** tính năng public trên website — đây
> là dev tool nội bộ, không đụng schema/route/khách hàng.
>
> Nghiên cứu nền: skill này thực chất là gói Python "agent skills" (không phải thư viện JS nhúng
> browser) — một LLM agent (Claude Code) đọc skill rồi tự gọi các Python tool để dựng hình học,
> xuất file. Không cần LLM API riêng/trả phí thêm — dùng chính suy luận của agent đang chạy
> (Claude Code). Máy dev đã có Python 3.11.4 và npx 10.9.8 sẵn sàng.

---

## 1. Goal

1. Cài `earthtojake/text-to-cad` ở **project level** (commit vào repo, không phải cài cá nhân
   `~/.claude`) để Codex và các session Claude Code khác trong BaSa3D đều dùng được — cần thiết vì
   phase này sẽ giao cho Codex qua `codex-handoff`.
2. Cài đúng theo hướng dẫn cài đặt mà chính package tự sinh ra sau bước 1 (VD: nếu nó yêu cầu
   `pip install` thêm dependency Python nào, cài đúng cái đó — không đoán trước tên package).
3. Chạy smoke test tối thiểu: nhờ agent (qua skill vừa cài) sinh 1 chi tiết đơn giản (VD: khối hộp
   20mm có 1 lỗ tròn xuyên tâm) và xuất được STL, xác nhận toolchain thật sự chạy được trên máy
   dev, không chỉ cài xong rồi bỏ đó.
4. Ghi tài liệu ngắn gọn trong `AGENTS.md` (mục mới cạnh "Review/quality-gate skills") mô tả skill
   này dùng để làm gì, khi nào nên dùng, và 1 câu ví dụ prompt gọi nó.

## 2. Non-goals

- Không có tính năng public/customer-facing nào — không route mới, không đổi
  `custom-request-form.tsx`, không đổi bất kỳ file dưới `src/app/[locale]/(tools)/` hay
  `src/lib/3d-tools/`.
- Không đụng schema/DB, không đụng pricing/checkout.
- Không cam kết sẽ dùng skill này cho 1 tool `/tools/*` cụ thể nào trong tương lai — đó là quyết
  định riêng, để khi nào có nhu cầu thực tế mới brainstorm phase mới.
- Không tích hợp LLM API trả phí/billing nào vào flow khách hàng.

## 3. Inputs

- Không có input từ domain docs (không liên quan business rule/schema).
- Môi trường: Python 3.11.4 (`/Library/Frameworks/Python.framework/Versions/3.11/bin/python3`),
  `npx` 10.9.8 — đã xác nhận có sẵn trên máy dev lúc research (2026-09-15).
- Nguồn: `https://github.com/earthtojake/text-to-cad` (MIT license, "100% open source + free, runs
  locally" theo texttocad.dev), cài qua `npx skills add earthtojake/text-to-cad` (hoặc phương án
  plugin marketplace nếu Codex thấy phù hợp hơn — xem README lúc cài thật để chọn đúng cách).

## 4. Outputs

- Skill được cài, commit vào git, nằm ở đúng vị trí mà lệnh cài thực tế tạo ra (Codex kiểm tra và
  báo lại chính xác đường dẫn — không giả định trước là `.claude/skills/` hay `.claude/plugins/`).
- Mọi dependency Python bổ sung mà chính bước cài yêu cầu, được cài và ghi lại (VD nếu sinh ra
  `requirements.txt`/`pyproject.toml`, commit luôn file đó).
- 1 file/script hoặc log smoke test xác nhận đã sinh được 1 file STL thật (không cần giữ file STL
  demo trong git — chỉ cần Codex mô tả lại đã chạy gì, kết quả gì trong phần "Behavior" khi báo
  cáo).
- Mục mới trong `AGENTS.md` mô tả skill.
- 1 dòng trong `docs/roadmap.md` ghi nhận Phase 30 (tooling nội bộ, không phải feature sản phẩm).

## 5. Quyết định đã chốt

### 5.1 Phạm vi — Chốt: dev tool nội bộ, không phải tính năng public
Đã research và xác nhận với Owner (2026-09-15): `earthtojake/text-to-cad` là skill package cho AI
coding agent (không phải SDK nhúng browser), phù hợp nhất để dùng làm công cụ nội bộ giúp
Codex/Claude Code dựng CAD nhanh, không phải để khách hàng gõ mô tả trên website.

### 5.2 Cấp độ cài đặt — Chốt: project-level (commit vào repo)
Vì phase này giao cho Codex thực hiện (không phải Owner tự cài cá nhân), skill phải được cài ở
cấp project và commit vào git để mọi agent làm việc trong BaSa3D đều thấy được, giống cách
`.claude/skills/{close-phase,codex-handoff,database-review,...}` đang được commit sẵn trong repo.

### 5.3 Không cần Gemini challenge
Task không đụng domain rule, schema, hay bất kỳ quyết định kiến trúc ảnh hưởng sản phẩm — bỏ qua
Step 3 (Ask AI for challenge) của `PHASE_START_PROTOCOL.md`, theo đúng tinh thần "chỉ dùng khi
phase đụng domain rule".

## 6. Risks & Mitigations

- **Không rõ trước dependency Python chính xác** (docs của package không nêu tên CAD kernel cụ
  thể) — chấp nhận: Codex cài đúng theo hướng dẫn mà chính bước `npx skills add` sinh ra, báo cáo
  lại chính xác đã cài gì, không đoán trước.
- **Chất lượng/khả năng in được của model do skill sinh ra không được đảm bảo** (đây là AI-driven
  generation) — chấp nhận vì phạm vi chỉ nội bộ, con người review trước khi dùng cho bất kỳ mục
  đích thực tế nào (không tự động gửi cho khách hoặc đưa vào production pricing).
- **Rủi ro duy trì gói bên thứ ba** (dependency vào 1 repo GitHub ngoài) — chấp nhận, rủi ro thấp
  vì không nằm trong critical path sản phẩm; nếu package ngừng bảo trì, chỉ cần gỡ, không ảnh
  hưởng website.

## 7. Checklist

### Trước khi giao Codex
- [x] Owner xác nhận phạm vi: dev tool nội bộ only (mục 5.1).
- [x] Chốt cấp độ cài đặt: project-level, commit repo (mục 5.2).
- [x] Xác nhận không cần Gemini challenge (mục 5.3).

### Việc cần làm
- [x] Cài `earthtojake/text-to-cad` ở project level, commit vào repo.
- [x] Cài đúng dependency bổ sung mà bước cài thực tế yêu cầu (nếu có).
- [x] Chạy smoke test: sinh 1 chi tiết đơn giản, xuất STL, xác nhận toolchain hoạt động thật.
- [x] Thêm mục mới vào `AGENTS.md` mô tả skill (mục đích, khi nào dùng, ví dụ prompt).
- [x] Thêm 1 dòng vào `docs/roadmap.md` cho Phase 30.

### Definition of Done
1. [x] Skill đã cài, commit vào git, vị trí thực tế được ghi lại đúng.
2. [x] Smoke test sinh STL thành công, có bằng chứng (log/mô tả) trong báo cáo của Codex.
3. [x] `AGENTS.md` có mục mô tả skill.
4. [x] `docs/roadmap.md` có dòng Phase 30.
5. [x] Không có file/route/schema nào ngoài phạm vi trên bị đụng tới.


## 8. Implementation evidence (2026-09-15; awaiting review)

### Installation

- Command: `npx skills add earthtojake/text-to-cad --skill cad --agent codex claude-code -y`
  (Skills CLI 1.5.26). Upstream offers 11 skills; selected `cad` for this phase's
  CAD/STEP/STL/3MF scope.
- Canonical installed path: `.agents/skills/cad/`; Claude Code link:
  `.claude/skills/cad -> ../../.agents/skills/cad`. Both are project-local and
  committed in `2b8795d`, together with upstream MIT LICENSE and installer-owned
  `skills-lock.json` (installation metadata, within the skill-install scope).
- Installed requirement from the skill's own Setup and `requirements.txt`:
  `cadgen[snapshot]==0.5.1`. No guessed kernel package or JS app dependency added.
- Python 3.11.4 virtual environment: `/private/tmp/basa3d-phase30-venv`.
  Setup: `/Library/Frameworks/Python.framework/Versions/3.11/bin/python3 -m venv /private/tmp/basa3d-phase30-venv`,
  then `/private/tmp/basa3d-phase30-venv/bin/python -m pip install -r .agents/skills/cad/requirements.txt`.
- Skill additionally instructs `python -m playwright install chromium` for
  rendering; invoked with `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/basa3d-phase30-browsers`.
- Runtime and demo artifacts are temporary, uncommitted machine-local files.
  After temporary-directory cleanup or on a fresh clone, create a Python virtual
  environment and rerun the installed skill's Setup; skill files remain in git.
- `cadgen doctor .agents/skills/cad` reports pin OK (0.5.1); `python -m pip check`
  reports no broken requirements.

Resolved Python packages installed by that requirements command (pip freeze;
all transitive packages were selected by pip, not manually installed):

```text
anytree==2.13.0
asttokens==3.0.2
build123d==0.11.1
cadgen==0.5.1
cadquery-ocp==7.9.3.1.1
cadquery-ocp-novtk==7.9.3.1.1
cadquery-ocp-proxy==7.9.3.1.1
certifi==2026.7.22
charset-normalizer==3.5.1
cloudpickle==3.1.2
contourpy==1.3.3
cycler==0.12.1
executing==2.2.1
ezdxf==1.4.4
fonttools==4.65.0
greenlet==3.5.6
idna==3.19
ipython==9.17.1
ipython_pygments_lexers==1.1.1
jedi==0.20.0
joblib==1.6.0
kiwisolver==1.5.1
lib3mf==2.5.0
matplotlib==3.11.2
matplotlib-inline==0.2.2
mpmath==1.3.0
narwhals==2.26.0
numpy==2.4.6
ocp_gordon==0.2.2
ocpsvg==0.6.0
packaging==26.3
parso==0.8.7
pexpect==4.9.0
pillow==12.3.0
playwright==1.62.0
prompt_toolkit==3.0.53
psutil==7.2.2
ptyprocess==0.7.0
pure_eval==0.2.4
pyee==13.0.1
Pygments==2.21.0
pyparsing==3.3.2
python-dateutil==2.9.0.post0
requests==2.34.2
scikit-learn==1.9.1
scipy==1.17.1
shapely==2.1.2
six==1.17.0
stack-data==0.6.3
svgelements==1.9.6
svgpathtools==1.8.0
svgwrite==1.4.3
sympy==1.14.0
threadpoolctl==3.6.0
traitlets==5.16.1
trianglesolver==1.2
typing_extensions==4.16.0
urllib3==2.7.0
vtk==9.6.2
wcwidth==0.8.3
webcolors==24.8.0
```

### Smoke test

Agent applied the installed `.agents/skills/cad/SKILL.md` and its brief,
modeling, export, inspection and snapshot references to this prompt:
"Use the cad skill to draft a 20 mm cube with a centered 6 mm through-hole
along Z, and export STEP and STL for internal review."

The agent authored `/private/tmp/basa3d-phase30-smoke/cube.py` using the skill's
`cadgen` model contract (`@step`, `@stl`, `bd.Box` minus `bd.Cylinder`).
Named constants: side 20 mm, bore diameter 6 mm, cutter overshoot 1 mm per end.
Origin centered, XY base plane, Z bore axis. Model source for reproduction:

```python
from cadgen import build123d as bd
from cadgen import step, stl

SIDE_MM = 20.0
HOLE_DIAMETER_MM = 6.0
CUT_OVERSHOOT_MM = 1.0

@step
@stl
def cube():
    body = bd.Box(SIDE_MM, SIDE_MM, SIDE_MM)
    cutter = bd.Cylinder(HOLE_DIAMETER_MM / 2, SIDE_MM + 2 * CUT_OVERSHOOT_MM)
    result = body - cutter
    result.label = "cube_20mm_through_hole_6mm"
    return result

if __name__ == "__main__":
    cube()
```

Commands (from `/private/tmp/basa3d-phase30-smoke`, with the venv's `bin/` on PATH):

```bash
export CADGEN_DAEMON=0
export CADGEN_CACHE_DIR=/private/tmp/basa3d-phase30-cache
export PLAYWRIGHT_BROWSERS_PATH=/private/tmp/basa3d-phase30-browsers
python cube.py --json
cadgen step inspect refs cube.step --facts --planes --positioning
cadgen step inspect validate cube.step
cadgen step inspect measure cube.step --from '#f1' --to '#f6' --axis x
cadgen step inspect measure cube.step --from '#f2' --to '#f4' --axis y
cadgen step inspect measure cube.step --from '#f5' --to '#f3' --axis z
cadgen step inspect refs cube.step '#f7' --detail --positioning
cadgen step snapshot cube.step cube.png --json
```

Results:

- Build: `ok: true`, `outcome: built`, `kind: part`.
- `/private/tmp/basa3d-phase30-smoke/cube.stl`: 12,384 bytes, 246 triangles;
  binary STL length matches its triangle-count header.
- `/private/tmp/basa3d-phase30-smoke/cube.step`: 20,623 bytes.
- Geometry validation: `ok: true`, one occurrence/prototype, zero failures.
- Measured X/Y/Z distances: exactly 20 mm each. Bounds centered at origin
  (kernel bounding tolerance approximately 1e-7 mm per face).
- Bore `#f7`: cylindrical radius 3 mm, axis +Z, centered on X/Y=0,
  trimmed Z bounds -10 to +10 mm: through the full cube height.
- Snapshot `/private/tmp/basa3d-phase30-smoke/cube.png`: 94,963 bytes;
  rendered successfully and visually reviewed: cube with centered circular bore.
- `cad-viewer` is not installed; used the skill's documented CLI inspection
  and snapshot fallback. No viewer server or printer job was started.
- Browser installer downloaded Chrome for Testing 151.0.7922.34 (Chromium
  v1234), matching Chrome Headless Shell v1234, and FFmpeg v1011.
- Initial sandbox run could not bind the local worker socket; rerun with
  sandbox escalation succeeded. No runtime/package source changes were needed.

### Project checks and scope

- `npm run typecheck`: PASS.
- `npm run lint`: FAIL, 15 existing errors in unrelated nested worktrees:
  `.claude/worktrees/{ai-pipeline,public-pricing-tab}` and
  `.vnx-data/worktrees/pool-basa3d-P7296-0` (`next-env.d.ts` triple-slash
  references and `next.config.mjs` undefined `process`/`URL`).
- `npm run lint -- --ignore-pattern '.claude/worktrees/**' --ignore-pattern '.vnx-data/**'`:
  PASS. No ESLint configuration changes made.
- `npm run build`: initial sandbox attempt could not fetch Google Fonts;
  rerun with network access PASS (compile, type validation, page generation).
- `git diff --check`: PASS for local documentation changes.
- Changed repo paths only: `AGENTS.md`, `docs/roadmap.md`, this active plan,
  `.agents/skills/cad/**`, `.claude/skills/cad`, and installer-owned
  `skills-lock.json`. No application source, `/tools/*` engine, schema,
  migration, package manifest or app lockfile changes. Standard checks also
  write ignored build/cache artifacts; demo/runtime files live under `/private/tmp`.
- Existing unrelated untracked files were left untouched and uncommitted.
- Commits: installation `2b8795d`, AGENTS documentation `2950a94`, roadmap
  `905a81e`; evidence recorded in a separate documentation commit.
- Phase remains in `active/` for human/Claude review; this is not phase closure.
  Accepted drafting quality/printability and third-party maintenance risks
  remain unchanged. Fresh sessions can discover the installed skill; follow
  its Setup when the temporary runtime is no longer available.
