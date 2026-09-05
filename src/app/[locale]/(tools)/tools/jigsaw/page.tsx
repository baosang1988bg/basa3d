import type { Metadata } from 'next';
import JigsawWorkbench from './jigsaw-workbench';
export const metadata: Metadata = { title: 'Jigsaw Studio — Cắt mảnh ghép 3D | BaSa3D' };
export default function JigsawPage() { return <JigsawWorkbench />; }
