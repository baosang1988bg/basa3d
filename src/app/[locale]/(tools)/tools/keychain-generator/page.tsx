import type { Metadata } from 'next';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';
import KeychainGeneratorWorkbench from './keychain-generator-workbench';

export const metadata: Metadata = {
  title: 'Tạo móc khoá khắc tên 3D | BaSa3D',
  description: 'Nhập nội dung, chọn màu và xem trước mẫu móc khoá 3D trực tiếp trên trình duyệt. Tải STL hoặc gửi yêu cầu báo giá tới xưởng BaSa3D.',
};

export default async function KeychainGeneratorPage({ params }: { params: LocaleParams }) {
  await applyRequestLocale(params);
  return <KeychainGeneratorWorkbench />;
}
