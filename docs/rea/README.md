# REA — hướng dẫn dùng trong BaSa3D

REA (`morluto/rea`, gói npm `rea-agents@6.7.0`, MIT) là MCP server dịch ngược: phân tích website, app
Electron/JS, APK, binary, file HAR. Trong BaSa3D, REA chỉ dùng để **quan sát hành vi các tool tham khảo**
(xem `targets.md`), không dùng để phân tích source của chính repo.

## Đã cài gì
| Thành phần | Vị trí |
|---|---|
| MCP server `rea` | `.mcp.json` → `npx -y rea-agents@6.7.0 mcp` (file này bị `.gitignore`, chỉ có hiệu lực trên máy local) |
| Skill `reverse-engineer-anything` | `.claude/skills/` và `.agents/skills/` (giữ 2 bản giống nhau) |
| Kịch bản + script | `docs/rea/<tool>/scenario.json`, `scripts/rea/run-<tool>.sh` |
| Evidence REA | `docs/rea/<tool>/evidence/scenario-<timestamp>.json` |
| Kết quả khảo sát | `docs/exec-plans/active/phase-NN-<tool>-rea.md` |

Yêu cầu: Node ≥ 22.19, Google Chrome. Không cần Hopper/Ghidra/IDA cho website.

## Cách gọi

### 1. Trong Claude Code (MCP + skill)
```bash
cd BaSa3D && claude      # approve server "rea" khi được hỏi; kiểm tra bằng /mcp
```
Gọi skill bằng `/reverse-engineer-anything …` hoặc viết prompt có nhắc "Dùng REA (capture_browser_scenario) …".
Prompt mẫu cho từng tool: `targets.md`.

### 2. Bằng CLI (không cần agent)
```bash
./scripts/rea/run-flex-keychain.sh
# hoặc trực tiếp:
npx -y rea-agents@6.7.0 capture-browser-scenario docs/rea/flex-keychain/scenario.json --format json
```
Trong `scenario.json`, `browser.executable_path` là placeholder; script sẽ tự thay bằng `CHROME_PATH`
(mặc định là Chrome trên macOS).

Kịch bản gồm `start_url`, `actions` (`wait_for`, `fill`, `click`, `wait_for_timeout`…) và `capture`
(`at_end`: screenshot/dom/accessibility; `events`: network/console/downloads). Xem schema đầy đủ:
`npx -y rea-agents@6.7.0 mcp` → `tools/list` → `capture_browser_scenario`.

## Quy tắc
1. Chỉ phân tích các trang trong `targets.md`; owner đã xác nhận được chủ trang cho phép (2026-10-21).
2. Mức mặc định là **quan sát hành vi**: UI, ràng buộc, network, cấu trúc file export. Không commit mã nguồn
   hay asset (STL, font, JS bundle) của trang vào repo.
3. Kết quả ghi theo dạng **Observations / Inferences / Unknowns** + Evidence ID:
   `R-xx` (REA), `C-xx` (quan sát qua trình duyệt), `B-xx` (code BaSa3D).
4. Không sao chép bug của trang tham khảo; ghi chúng vào mục Inferences để tránh.

## Giới hạn đã biết
- REA **huỷ download** và chỉ ghi `suggested_filename`. Muốn biết cấu trúc 3MF/zip thì phải chặn blob trong
  trình duyệt, hoặc lưu file export thủ công rồi chạy `rea inspect-artifact <file>`.
- Sandbox của agent Cowork bị proxy chặn `*.workers.dev`, nên phải chạy REA trên Mac. Khi đó agent dùng
  Claude in Chrome để quan sát, với Evidence ID `C-xx`.
- `.mcp.json` không vào git: máy khác cần tự thêm entry `rea`, hoặc chạy `npx rea-agents@6.7.0 setup`.

## Nâng cấp
Đổi version trong `.mcp.json`, các `scripts/rea/*.sh` và file này. Sau đó chép lại skill từ đúng gói npm
(`npm pack rea-agents@<ver>` → `package/skills/reverse-engineer-anything`) vào cả `.claude/skills/` và `.agents/skills/`.
