import type { Metadata } from 'next';
import OrganizerWorkbench from './organizer-workbench';

export const metadata: Metadata = {
  title: 'Trình tạo khay & hộp chia | BaSa3D',
  description: 'Thiết kế khay chia ngăn theo kích thước ngăn kéo. Xem trước 3D, tải STL/3MF hoặc đặt BaSa3D in.',
};
export default function OrganizerPage() { return <OrganizerWorkbench />; }
