import type { Metadata } from 'next';
import CarNameplateWorkbench from './car-nameplate-workbench';
export const metadata: Metadata = { title: 'Flex Car — Bảng tên xe ảo ảnh | BaSa3D' };
export default function CarNameplatePage() { return <CarNameplateWorkbench />; }
