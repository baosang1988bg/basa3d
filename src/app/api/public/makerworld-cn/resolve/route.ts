import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import {
  parseMakerWorldUrl,
  resolveMakerWorldUrl,
  MakerWorldResolverError,
  MakerWorldNotFoundError,
} from '@/lib/parsers/makerworld-resolver';
import { sanitizeMakerWorldImageUrl } from '@/lib/parsers/makerworld-image';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';
import {
  attachInstantEstimates,
  type MakerWorldCnProfile,
  type MakerWorldCnModelDetail,
} from '@/services/makerworld-cn-pricing.service';

export type { MakerWorldCnProfile, MakerWorldCnModelDetail };

const inputSchema = z.object({
  url: z.string().trim().min(5).max(2_000),
}).strict();

const isRateLimited = createDatabaseRateLimiter({
  scope: 'makerworld-cn-resolve',
  maxRequests: 30,
  windowMs: 10 * 60_000,
});

function isChinaHost(host: string): boolean {
  return host.endsWith('makerworld.com.cn') || host.endsWith('makerworld.cn');
}

/** Official Bambu Lab design API for both regions (China & Global). */
async function fetchFromBambuApi(
  modelId: string,
  isChina: boolean,
  sourceUrl: string
): Promise<MakerWorldCnModelDetail | null> {
  try {
    const base = isChina ? 'https://api.bambulab.cn' : 'https://api.bambulab.com';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(`${base}/v1/design-service/design/${modelId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      id?: number | string;
      title?: string;
      coverUrl?: string;
      summary?: string;
      license?: string;
      designCreator?: { name?: string };
      instances?: Array<{
        id?: number | string;
        profileId?: number | string;
        title?: string;
        cover?: string;
        prediction?: number;
        weight?: number;
        needAms?: boolean;
        extention?: {
          modelInfo?: {
            plates?: unknown[];
            compatibility?: { devProductName?: string };
          };
        };
        instanceFilaments?: Array<{
          type?: string;
          color?: string;
          usedG?: string | number;
        }>;
      }>;
    } | null;

    if (!data || !data.title) return null;

    const instances = Array.isArray(data.instances) ? data.instances : [];

    return {
      modelId: String(data.id ?? modelId),
      isChinaModel: isChina,
      title: data.title,
      coverImageUrl: sanitizeMakerWorldImageUrl(data.coverUrl),
      author: data.designCreator?.name || null,
      license: data.license || null,
      sourceUrl,
      summary: data.summary || null,
      profiles: instances.map((inst, index) => {
        const pId = String(inst.profileId ?? inst.id ?? index + 1);
        const minutes = Math.round(Number(inst.prediction ?? 0) / 60);
        const weightGrams = Math.round(Number(inst.weight ?? 0));
        const platesCount = Array.isArray(inst.extention?.modelInfo?.plates)
          ? inst.extention.modelInfo.plates.length
          : 1;
        const filaments = Array.isArray(inst.instanceFilaments)
          ? inst.instanceFilaments.map((f, fIdx) => ({
              name: f.type || `Màu ${fIdx + 1}`,
              colorHex: f.color
                ? f.color.startsWith('#')
                  ? f.color
                  : `#${f.color}`
                : '#666666',
              type: f.type || 'PLA',
              weightGrams: Math.round(Number(f.usedG ?? 0)),
            }))
          : [];

        return {
          profileId: pId,
          title: inst.title || `Bàn in ${index + 1}`,
          coverImageUrl: sanitizeMakerWorldImageUrl(inst.cover),
          printerTarget:
            inst.extention?.modelInfo?.compatibility?.devProductName ||
            'Bambu Lab',
          printTimeMinutes: minutes,
          weightGrams,
          platesCount,
          amsRequired: typeof inst.needAms === 'boolean' ? inst.needAms : null,
          filaments,
        };
      }),
    };
  } catch {
    return null;
  }
}

async function fetchFromFallbackService(url: string, modelId: string): Promise<MakerWorldCnModelDetail | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch('https://mwc.3dhubvn.net/api/v1/makerworld/public/china/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://mwc.3dhubvn.net/makerworld-cn',
        'Origin': 'https://mwc.3dhubvn.net',
        'Accept': 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as {
      design?: {
        title?: string;
        coverUrl?: string;
        summary?: string;
        license?: string;
        designCreator?: { name?: string };
      };
      instances?: Array<{
        profileId?: string | number;
        title?: string;
        cover?: string;
        prediction?: number;
        weight?: number;
        needAms?: boolean;
        extention?: {
          modelInfo?: {
            plates?: unknown[];
            compatibility?: { devProductName?: string };
          };
        };
        instanceFilaments?: Array<{
          type?: string;
          color?: string;
          usedG?: string | number;
        }>;
      }>;
      model_id?: string | number;
    } | null;

    if (!data || !data.design) return null;

    const design = data.design;
    const instances = Array.isArray(data.instances) ? data.instances : [];

    return {
      modelId: String(data.model_id ?? modelId),
      isChinaModel: true,
      title: design.title || 'Mẫu MakerWorld China',
      coverImageUrl: sanitizeMakerWorldImageUrl(design.coverUrl),
      author: design.designCreator?.name || null,
      license: design.license || null,
      sourceUrl: url,
      summary: design.summary || null,
      profiles: instances.map((inst, index) => {
        const pId = String(inst.profileId ?? index + 1);
        const minutes = Math.round(Number(inst.prediction ?? 0) / 60);
        const weightGrams = Math.round(Number(inst.weight ?? 0));
        const platesCount = Array.isArray(inst.extention?.modelInfo?.plates)
          ? inst.extention.modelInfo.plates.length
          : 1;
        const filaments = Array.isArray(inst.instanceFilaments)
          ? inst.instanceFilaments.map((f, fIdx) => ({
              name: f.type || `Màu ${fIdx + 1}`,
              colorHex: f.color ? (f.color.startsWith('#') ? f.color : `#${f.color}`) : '#666666',
              type: f.type || 'PLA',
              weightGrams: Math.round(Number(f.usedG ?? 0)),
            }))
          : [];

        return {
          profileId: pId,
          title: inst.title || `Bàn in ${index + 1}`,
          coverImageUrl: sanitizeMakerWorldImageUrl(inst.cover),
          printerTarget: inst.extention?.modelInfo?.compatibility?.devProductName || 'Bambu Lab',
          printTimeMinutes: minutes,
          weightGrams,
          platesCount,
          amsRequired: typeof inst.needAms === 'boolean' ? inst.needAms : null,
          filaments,
        };
      }),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: 'INVALID_INPUT', message: 'Vui lòng cung cấp link MakerWorld hợp lệ.' }, { status: 400 });
    }

    const { url } = parsed.data;
    const ip = getClientIp(request.headers);
    if (process.env.DATABASE_URL && (await isRateLimited(ip))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau vài phút.' }, { status: 429 });
    }

    let parsedUrl;
    try {
      parsedUrl = parseMakerWorldUrl(url);
    } catch (e) {
      if (e instanceof MakerWorldNotFoundError) {
        return NextResponse.json({ code: 'INVALID_MAKERWORLD_URL', message: e.message }, { status: 400 });
      }
      throw e;
    }

    const isChina = isChinaHost(parsedUrl.url.hostname);

    // 1. Try official Bambu Lab design API for the appropriate region first
    const bambuDetail = await fetchFromBambuApi(parsedUrl.modelId, isChina, url);
    if (bambuDetail && bambuDetail.profiles.length > 0) {
      return NextResponse.json({ data: await attachInstantEstimates(bambuDetail) });
    }

    // 2. Try native BaSa3D web resolver
    try {
      const native = await resolveMakerWorldUrl(url);
      const detail: MakerWorldCnModelDetail = {
        modelId: native.modelId,
        isChinaModel: isChina,
        title: native.modelTitle,
        coverImageUrl: native.modelCoverImageUrl,
        author: null,
        license: native.license,
        sourceUrl: native.sourceUrl,
        summary: null,
        profiles: native.profiles.map((p) => ({
          profileId: p.profileId,
          title: p.profileTitle,
          coverImageUrl: p.profileCoverImageUrl,
          printerTarget: p.printerTarget,
          printTimeMinutes: p.printTimeMinutes,
          weightGrams: p.netWeightGrams,
          platesCount: p.platesCount,
          amsRequired: p.amsRequired,
          filaments: p.filaments.map((f) => ({
            name: f.name,
            colorHex: f.colorHex,
            type: f.materialType,
            weightGrams: f.netWeightGrams,
          })),
        })),
      };
      return NextResponse.json({ data: await attachInstantEstimates(detail) });
    } catch (nativeErr) {
      // 3. Fallback for China models ONLY (3DHubVN operates exclusively on MakerWorld China)
      if (isChina) {
        const fallbackDetail = await fetchFromFallbackService(url, parsedUrl.modelId);
        if (fallbackDetail && fallbackDetail.profiles.length > 0) {
          return NextResponse.json({ data: await attachInstantEstimates(fallbackDetail) });
        }
      }

      if (nativeErr instanceof MakerWorldResolverError) {
        return NextResponse.json({ code: nativeErr.kind, message: nativeErr.message }, { status: 422 });
      }
      throw nativeErr;
    }
  } catch (error) {
    return apiError(error);
  }
}
