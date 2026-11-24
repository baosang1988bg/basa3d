import type { Metadata } from 'next';
import DualTextWorkbench from './dual-text-workbench';
export const metadata: Metadata = {
  title: 'Flex Dual Text — Chữ ảo ảnh 2 góc nhìn | BaSa3D',
  description: 'Tạo khối chữ ảo ảnh hiện 2 chữ khác nhau ở 2 góc nhìn. Xem trước 3D, tải file in hoặc đặt BaSa3D in.',
};
export default function DualTextPage() { return <DualTextWorkbench />; }
