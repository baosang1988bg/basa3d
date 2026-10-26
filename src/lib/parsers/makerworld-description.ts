export interface ParsedMakerWorldDescription {
  isMakerWorld: boolean;
  modelTitle: string | null;
  sourceUrl: string | null;
  author: string | null;
  profileTitle: string | null;
  profileId: string | null;
  printTimeText: string | null;
  printMinutes: number | null;
  weightText: string | null;
  weightGrams: number | null;
  platesText: string | null;
  platesCount: number | null;
  printerTarget: string | null;
  amsText: string | null;
  amsRequired: boolean | null;
  fileColors: string | null;
  requestedColor: string | null;
  material: string | null;
  tierLabel: string | null;
  tier: 'ASSEMBLED' | 'KIT' | null;
  estimatedPriceText: string | null;
  estimatedPriceVnd: number | null;
  customerNote: string | null;
  cleanDescription: string;
}

/**
 * Parses MakerWorld metadata and customer note embedded in a custom request description string.
 * Used to gracefully map structured fields in admin UI and API fallbacks.
 */
export function parseMakerWorldDescription(description: string | null | undefined): ParsedMakerWorldDescription {
  const result: ParsedMakerWorldDescription = {
    isMakerWorld: false,
    modelTitle: null,
    sourceUrl: null,
    author: null,
    profileTitle: null,
    profileId: null,
    printTimeText: null,
    printMinutes: null,
    weightText: null,
    weightGrams: null,
    platesText: null,
    platesCount: null,
    printerTarget: null,
    amsText: null,
    amsRequired: null,
    fileColors: null,
    requestedColor: null,
    material: null,
    tierLabel: null,
    tier: null,
    estimatedPriceText: null,
    estimatedPriceVnd: null,
    customerNote: null,
    cleanDescription: description?.trim() ?? '',
  };

  if (!description) return result;

  const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return result;

  const firstLine = lines[0];
  if (!firstLine.includes('[MakerWorld]')) {
    return result;
  }

  result.isMakerWorld = true;
  result.modelTitle = firstLine.replace(/^\[MakerWorld\]\s*/i, '').trim() || null;

  const remainingNotes: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (/^Nguồn mẫu:\s*(.+)$/i.test(line)) {
      result.sourceUrl = line.replace(/^Nguồn mẫu:\s*/i, '').trim();
    } else if (/^Tác giả:\s*(.+)$/i.test(line)) {
      result.author = line.replace(/^Tác giả:\s*/i, '').trim();
    } else if (/^Bàn in \(Profile\):\s*(.+)$/i.test(line)) {
      const val = line.replace(/^Bàn in \(Profile\):\s*/i, '').trim();
      const idMatch = val.match(/\(ID:\s*([^)]+)\)$/i);
      if (idMatch) {
        result.profileId = idMatch[1].trim();
        result.profileTitle = val.replace(/\(ID:\s*[^)]+\)$/i, '').trim() || null;
      } else {
        result.profileTitle = val;
      }
    } else if (/^Profile:\s*(.+)$/i.test(line)) {
      result.profileTitle = line.replace(/^Profile:\s*/i, '').trim();
    } else if (/^Thông số in:\s*(.+)$/i.test(line)) {
      const val = line.replace(/^Thông số in:\s*/i, '').trim();
      // Format: "13h 47p · 378g · 3 bàn in"
      const parts = val.split(/[·•]/).map((p) => p.trim());
      for (const part of parts) {
        if (/(\d+)\s*(?:h|hr|giờ)/i.test(part) || /(\d+)\s*(?:p|m|phút|min)/i.test(part)) {
          result.printTimeText = part;
          const hMatch = part.match(/(\d+)\s*(?:h|hr|giờ)/i);
          const mMatch = part.match(/(\d+)\s*(?:p|m|phút|min)/i);
          const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
          const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
          result.printMinutes = hours * 60 + mins;
        } else if (/(\d+(?:[.,]\d+)?)\s*g/i.test(part)) {
          result.weightText = part;
          const gMatch = part.match(/(\d+(?:[.,]\d+)?)\s*g/i);
          if (gMatch) result.weightGrams = parseFloat(gMatch[1].replace(',', '.'));
        } else if (/(\d+)\s*(?:bàn in|plates?)/i.test(part)) {
          result.platesText = part;
          const pMatch = part.match(/(\d+)\s*(?:bàn in|plates?)/i);
          if (pMatch) result.platesCount = parseInt(pMatch[1], 10);
        }
      }
    } else if (/^Máy in:\s*(.+)$/i.test(line)) {
      const val = line.replace(/^Máy in:\s*/i, '').trim();
      // Format: "P2S · AMS: Cần AMS (Đa màu)"
      const parts = val.split(/[·•]/).map((p) => p.trim());
      result.printerTarget = parts[0]?.replace(/^Máy in:\s*/i, '').trim() || null;
      for (const part of parts) {
        if (/AMS:\s*(.+)/i.test(part)) {
          result.amsText = part.replace(/^AMS:\s*/i, '').trim();
          result.amsRequired = /cần|có|true|yes/i.test(result.amsText) && !/không/i.test(result.amsText);
        }
      }
    } else if (/^Màu sắc file:\s*(.+)$/i.test(line)) {
      result.fileColors = line.replace(/^Màu sắc file:\s*/i, '').trim();
      const matMatches = result.fileColors.match(/\b(PLA\+?|PETG|ABS|TPU|ASA|PC|PA|PVA)\b/gi);
      if (matMatches && matMatches.length > 0) {
        result.material = Array.from(new Set(matMatches.map((m) => m.toUpperCase()))).join(', ');
      }
    } else if (/^Màu khách yêu cầu:\s*(.+)$/i.test(line)) {
      result.requestedColor = line.replace(/^Màu khách yêu cầu:\s*/i, '').trim();
    } else if (/^Phương án:\s*(.+)$/i.test(line)) {
      result.tierLabel = line.replace(/^Phương án:\s*/i, '').trim();
      if (/kit/i.test(result.tierLabel)) result.tier = 'KIT';
      else result.tier = 'ASSEMBLED';
    } else if (/^Báo giá ước tính hiển thị:\s*(.+)$/i.test(line)) {
      result.estimatedPriceText = line.replace(/^Báo giá ước tính hiển thị:\s*/i, '').trim();
      const priceMatch = line.match(/(?:~|)\s*([\d.]+)\s*đ/i);
      if (priceMatch) {
        result.estimatedPriceVnd = parseInt(priceMatch[1].replace(/\./g, ''), 10);
      }
    } else if (/^(?:Ghi chú khách hàng|Ghi chú):\s*(.+)$/i.test(line)) {
      const note = line.replace(/^(?:Ghi chú khách hàng|Ghi chú):\s*/i, '').trim();
      if (note) {
        remainingNotes.push(note);
      }
    } else {
      remainingNotes.push(line);
    }
  }

  result.customerNote = remainingNotes.join('\n').trim() || null;
  result.cleanDescription = result.customerNote || 'Yêu cầu đặt in theo mẫu MakerWorld (thông số kỹ thuật đã tổng hợp ở trên).';

  return result;
}
