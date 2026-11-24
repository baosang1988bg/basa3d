import type { Metadata } from 'next';
import CarNameplateWorkbench from './car-nameplate-workbench';
export const metadata: Metadata = {
  title: 'Flex Car — Bảng tên xe ảo ảnh | BaSa3D',
  description: 'Thiết kế bảng tên xe ảo ảnh 3D theo tên của bạn, xem trước 3D, tải STL/3MF hoặc đặt BaSa3D in sẵn.',
};
export default function CarNameplatePage() { return <CarNameplateWorkbench />; }
