import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { requireAdmin } from '../../../../../lib/auth/require-admin';
import { DEFAULT_PRINTER_TARGET_ID, isPrinterProfileId } from '../../../../../lib/pricing/printer-profiles';
import { buildThreeMfPricingDraft } from '../../../../../services/threemf-pricing-draft.service';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// STAFF/OWNER only — never public. Parses a staff-uploaded .3mf entirely server-side (never in the
// browser) so the numbers feeding pricing.service come from re-parsing the source file, not from
// whatever a client-side script happened to compute (phase-9.md decision #5).
// An unsliced project no longer fails with 3MF_MISSING_SLICE_INFO: it returns a PROJECT_ESTIMATE draft
// (geometry grams + purge/prime tower for the chosen `printerTarget`, default Snapmaker U1).
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ code: 'FILE_REQUIRED', message: 'Vui lòng chọn một file .3mf.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ code: 'FILE_TOO_LARGE', message: 'File .3mf vượt quá giới hạn 10MB.' }, { status: 400 });
    }
    const rawPrinter = formData.get('printerTarget');
    const printerId = isPrinterProfileId(rawPrinter) ? rawPrinter : DEFAULT_PRINTER_TARGET_ID;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = buildThreeMfPricingDraft(bytes, printerId);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    return apiError(error);
  }
}
