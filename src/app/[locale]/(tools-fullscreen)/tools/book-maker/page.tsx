import type { Metadata } from 'next';
import BookMakerWorkbench from './book-maker-workbench';

export const metadata: Metadata = {
  title: 'Photo Book Studio — Tùy biến Sách ảnh in 3D | BaSa3D',
  description:
    'Thiết kế và cấu hình sách ảnh 3D cho ảnh Instax Mini, Square, Wide, Polaroid Go, 600, 6x9, 10x15. Xuất file 3MF nhiều màu tương thích Bambu Studio AMS.',
};

export default function BookMakerPage() {
  return <BookMakerWorkbench />;
}
