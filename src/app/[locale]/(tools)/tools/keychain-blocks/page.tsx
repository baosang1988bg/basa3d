import type { Metadata } from 'next';
import KeychainBlocksWorkbench from './keychain-blocks-workbench';
export const metadata: Metadata = {
  title: 'Flex Keychain — Móc khoá khối | BaSa3D',
  description: 'Tạo móc khoá khối chữ nhiều màu theo tên. Xem trước 3D, tải STL/3MF hoặc đặt BaSa3D in.',
};
export default function KeychainBlocksPage() { return <KeychainBlocksWorkbench />; }
