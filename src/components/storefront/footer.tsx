import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">{SITE_CONFIG.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{SITE_CONFIG.description}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Hotline/Zalo:{' '}
            <a href={SITE_CONFIG.zaloUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
              {SITE_CONFIG.zaloPhone}
            </a>
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Cam kết</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Bảo mật tuyệt đối file thiết kế khách hàng gửi</li>
            <li>Đổi trả trong 7 ngày nếu lỗi sản xuất</li>
            <li>Báo giá minh bạch, không phát sinh chi phí ẩn</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Liên kết</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/products" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Sản phẩm</Link></li>
            <li><Link href="/custom-print" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Đặt in theo yêu cầu</Link></li>
            <li><Link href="/blog" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Blog</Link></li>
            <li><Link href="/admin/login" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Đăng nhập quản trị</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Chính sách</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/privacy-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Bảo mật</Link></li>
            <li><Link href="/shipping-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Vận chuyển</Link></li>
            <li><Link href="/return-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Đổi trả</Link></li>
            <li><Link href="/file-confidentiality-policy" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Bảo mật file thiết kế</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} BaSa3D. All rights reserved.</div>
    </footer>
  );
}
