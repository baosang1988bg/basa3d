import type { Metadata } from 'next';
import OrganizerWorkbench from './organizer-workbench';

export const metadata: Metadata = { title: 'Trình tạo khay & hộp chia | BaSa3D' };
export default function OrganizerPage() { return <OrganizerWorkbench />; }
