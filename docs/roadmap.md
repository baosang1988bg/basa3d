# BaSa3D Roadmap — Phase Entry Order

Phase 0: project foundation & product decisions
Phase 1: database/domain model
Phase 2: backend/service layer
Phase 3: admin + inventory
Phase 4: public storefront
Phase 5: cart + checkout + orders
Phase 6: custom print + quote + production
Phase 7: SEO/content/launch
Phase 8: operations/optimization/scale
Phase 9: pricing engine + slicer/.3mf quoting
Phase 10: GA4 full event tracking + Cloudflare domain setup
Phase 11: admin dashboard analytics, charts & visual process pipelines
Phase 12: filament spool inventory tracking + workshop expense accounting
Phase 13: 5-minute fast quoting flow (MakerWorld URL resolver + Smart AMS waste estimator + public shareable quote)
Phase 14: RBAC & route-auth coverage hardening (no new feature — closes an existing test gap)
Phase 15: staff operational notifications (Resend email on new custom request/order) — code done; Gemini challenge + Owner domain/volume follow-up tracked in Phase 22
Phase 16: deposit/payment reconciliation (bank transfer webhook matching) — not started, blocked on Owner picking a webhook provider
Phase 17: public 3D text/keychain generator (browser-side) → custom request with advisory server-side price range — code done; ADR + Owner physical print follow-up tracked in Phase 22
Phase 18: storefront i18n (VI/EN, VI default) — nav/footer/home/products list & detail/4 policy pages translated; cart/checkout/custom-print/blog/quotes deferred to a later phase

Phase 19: 3D tools roadmap and shared `(tools)` architecture — closed
Phase 20: Flex Organizer tray generator, shared tool price estimate, STL → custom request — closed; Owner accepted risk on skipping physical print validation
Phase 21: Flex Keychain (block-style), multi-color 3MF export — closed
Phase 22: Flex Dual Text (Chữ ảo ảnh 2 góc nhìn) — code done, marked PENDING / deferred by Owner (non-essential for MVP launch)
Phase 23: Flex Car (multi-angle text car interior) — closed
Phase 24: Flex Lamp (lathe geometry & cutout patterns) — closed
Phase 25: Hinge Box Studio (parametric living hinge box) — closed; physical validation pending
Phase 26: Jigsaw Studio (STL/OBJ mesh grid interlock cutter) — closed; Web Worker & Voronoi pending/deferred; physical validation pending
Phase 27: Flex Sculpt — dropped/canceled by Owner
Phase 28: admin performance & findability — implementation complete; disposable local DB/Supabase integration, RBAC and E2E verification pending
Phase 29: copyright/IP compliance controls — code slices implemented; standing operational/legal checklist remains active by design
Phase 30: Text-to-CAD agent skill — project-level internal CAD/STL/3MF drafting tooling; closed
Phase 31: storefront/tools loading UX & request-waterfall cleanup — closed
Phase 33: `/bao-gia` instant multi-file quote, 1 item = 1 Quote, versioned VAT, direct-to-Storage uploads — S0–S8 code done (2026-10-13; up to 50 files per request, 3D preview with on-model dimensions and a resize toolbar); `/bao-gia` behind `NEXT_PUBLIC_BAO_GIA_ENABLED` until the S0 calibration runs on real sliced files; awaiting review
Phase 34: pre-launch security hardening — implementation in progress (dependency patches, headers/CSP report-only, public abuse controls, checkout idempotency, private-upload capabilities)
Phase 35: go-live hardening (admin page auth, JSON-LD/analytics leaks, .3mf caps, public order guards, DB hardening) — code committed; OWNER infra checklist pending
Phase 36: post-audit data integrity — order/inventory/print-job/quote state guards, history-delete guards, timezone-correct timestamps & reports, purpose-bound tokens, phone-suffix budget, server-action arg parsing — code done 2026-10-15, awaiting OWNER review
Phase 37: brand identity on storefront (logo header/footer, favicon/app icons, default OG image, home banner, footer contact card) — first feature via Spec Kit (`specs/001-brand-assets/`), code done 2026-10-20; build + E2E smoke pending on Vercel/Mac
Phase 38: hotfix — every public upload (/custom-print, /bao-gia) returned 500 because Production lacked `UPLOAD_CLAIM_SECRET` (never synced by the release script); script + guard test fixed 2026-10-20, OWNER must set the Vercel env var and redeploy
Phase 39: storefront 404 hotline — added "Call hotline" button to the 404 page using `SITE_CONFIG.hotline` and i18n messages; code done 2026-10-20
Phase 40: transparent instant quote + AMS purge estimate for unsliced multi-color .3mf (ADR-0043; server-side slicing rejected) — code done 2026-10-21; needs a real exported project to calibrate (±30% target)
Phase 41: admin executive business dashboard (Tab Kinh doanh & Tài chính 30 ngày cho riêng OWNER, biểu đồ highlight cuối tuần, doanh thu danh mục, tồn kho nhựa có vạch ngưỡng; ADR-0044: chỉ doanh thu đơn shop, loại CANCELLED/REFUNDED, nhựa theo sổ kho PRODUCTION_OUT) — code done 2026-10-21; chờ OWNER kiểm tra giao diện trên `npm run dev` trước khi close-phase

Phase 42: storefront caching — pass-through root layout (no request read), Home ISR 60 s, policy/tools/custom-print/cart/checkout static, catalog data cache with tag invalidation after commit in services, build still works without a DB (ADR-0045) — code done + verified in sandbox 2026-10-21; OWNER smoke on Vercel Preview + DB test suite pending
Phase 43: storefront motion (CSS-only) — scroll reveal bằng CSS scroll-driven animation, nút tactile nhấn như phím, FAQ accordion, gallery sản phẩm, menu mobile trượt (sửa bug menu bị kẹt trong header), chuyển trang mềm — code done + verified in sandbox 2026-10-21; OWNER xem thử pending

Do not start a phase by coding immediately. Follow the Phase Start Protocol in the main project plan.
