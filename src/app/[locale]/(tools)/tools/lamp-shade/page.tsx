import type { Metadata } from 'next';
import LampShadeWorkbench from './lamp-shade-workbench';
export const metadata: Metadata = {
  title: 'Flex Lamp — Chụp đèn hoa văn | BaSa3D',
  description: 'Thiết kế chụp đèn hoa văn (tròn, lục giác, sóng…) vừa đế socket. Xem trước 3D, tải STL/3MF hoặc đặt in.',
};
export default function LampShadePage() { return <LampShadeWorkbench />; }
