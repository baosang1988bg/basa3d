import type { Metadata } from 'next';
import HingeBoxWorkbench from './hinge-box-workbench';
export const metadata: Metadata = {
  title: 'Hinge Box Studio — Hộp có bản lề liền khối | BaSa3D',
  description: 'Thiết kế hộp có bản lề in liền khối theo kích thước bạn chọn. Xem trước 3D, tải STL/3MF hoặc đặt in.',
};
export default function HingeBoxPage() { return <HingeBoxWorkbench />; }
