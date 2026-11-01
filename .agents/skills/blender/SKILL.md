---
name: blender
description: Create and render 3D assets, product mockups, studio lighting, materials, and organic models using Blender via mcp-for-blender.
---

# Blender Automation & Rendering (BaSa3D)

## Purpose
Use Blender for:
1. **Product Mockups & Studio Rendering**: Create high-quality, photorealistic renders of 3D printable products, filament textures (PLA, PETG, TPU), studio lighting setups, and camera angles for catalog & marketing.
2. **Organic & Aesthetic Modeling**: Model or adjust non-parametric shapes (figurines, keycaps, vases, decorative items, embossed reliefs) where CAD/solid modeling (`build123d`) is unsuited.

---

## Boundaries: Blender vs CAD Skill

| Nhiệm vụ | Dùng Skill nào? | Lý do |
| :--- | :--- | :--- |
| Chi tiết cơ khí, ren ốc, khớp nối, hộp lắp ghép, dung sai chính xác | `.agents/skills/cad` (`build123d`) | Mô hình Solid B-Rep chính xác đến micron, đảm bảo 100% kín nước và đúng kích thước cơ khí. |
| Render ảnh quảng cáo, phối cảnh studio, vật liệu nhựa/gỗ | `.agents/skills/blender` | Blender Cycles/EEVEE có shader và ánh sáng chân thực vượt trội. |
| Tượng decor, hình thể hữu cơ (organic), hoa văn mỹ thuật | `.agents/skills/blender` | Mesh modeling & sculpting linh hoạt hơn solid modeling. |

---

## 3D Printing Manifold Checklist (Bắt buộc khi xuất file in 3D)
Khi tạo mô hình bằng Blender để in 3D (FDM/SLA), agent phải tuân thủ nghiêm ngặt:
1. **Watertight / Manifold**: Không có cạnh hở, không có mặt trùng (coincident faces), không tự giao nhau (self-intersections).
2. **Face Normals**: Luôn tính toán lại pháp tuyến bề mặt hướng ra ngoài (`bpy.ops.mesh.normals_make_consistent(inside=False)`).
3. **Apply Transforms**: Áp dụng Rotation & Scale trước khi export (`bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)`).
4. **Đơn vị kích thước**: Luôn đặt hệ đo Metric, đơn vị mm.

---

## Setup & Kết nối với Blender qua MCP

1. **Yêu cầu hệ thống**:
   - Đã cài đặt **Blender (3.0+)** trên máy.
   - MCP Server đã được cấu hình trong `mcp_config.json` hoặc `.mcp.json`:
     ```json
     {
       "mcpServers": {
         "blender": {
           "command": "cmd",
           "args": ["/c", "uvx", "mcp-for-blender"]
         }
       }
     }
     ```

2. **Kích hoạt Addon trong Blender**:
   - Chạy lệnh cài addon tự động:
     ```bash
     uvx mcp-for-blender install-addon
     ```
   - Mở Blender -> Mở tab sidebar (phím tắt `N` trong 3D Viewport) -> chọn tab **MCP for Blender** -> bấm **Start MCP Server**.
   - Server lắng nghe mặc định tại `localhost:9876`.
