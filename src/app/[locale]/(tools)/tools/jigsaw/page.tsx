import type { Metadata } from 'next';
import JigsawWorkbench from './jigsaw-workbench';
export const metadata: Metadata = {
  title: 'Jigsaw Studio — Cắt mảnh ghép 3D | BaSa3D',
  description: 'Cắt mảnh ghép 3D từ hình khối của bạn. Xem trước, tải file in hoặc đặt BaSa3D in.',
};
export default function JigsawPage() { return <JigsawWorkbench />; }
