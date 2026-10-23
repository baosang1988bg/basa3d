import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { createDatabaseRateLimiter, getClientIp } from '@/lib/rate-limit';

const inputSchema = z.object({
  modelId: z.string().trim().regex(/^\d+$/).max(30),
  profileId: z.string().trim().regex(/^\d+$/).max(30),
}).strict();

const isRateLimited = createDatabaseRateLimiter({
  scope: 'makerworld-cn-download',
  maxRequests: 20,
  windowMs: 10 * 60_000,
});

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ code: 'INVALID_INPUT', message: 'Mã model hoặc profile không hợp lệ.' }, { status: 400 });
    }

    const { modelId, profileId } = parsed.data;
    const ip = getClientIp(request.headers);
    if (process.env.DATABASE_URL && (await isRateLimited(ip))) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đang tải quá nhanh, vui lòng thử lại sau vài phút.' }, { status: 429 });
    }

    // 1. Direct Bambu Lab API download (if token is provided in environment)
    const chinaToken = process.env.BAMBU_CHINA_TOKEN;
    if (chinaToken) {
      try {
        const iotRes = await fetch(`https://api.bambulab.cn/v1/iot-service/api/user/profile/${profileId}`, {
          headers: {
            'Authorization': `Bearer ${chinaToken}`,
            'User-Agent': 'BambuStudio/01.09.03.50',
          },
        });
        if (iotRes.ok) {
          const iotData = (await iotRes.json().catch(() => null)) as { url?: string } | null;
          if (iotData?.url) {
            const fileRes = await fetch(iotData.url);
            if (fileRes.ok) {
              const body = await fileRes.arrayBuffer();
              return new Response(body, {
                status: 200,
                headers: {
                  'Content-Type': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
                  'Content-Disposition': `attachment; filename="makerworld-${modelId}-${profileId}.3mf"`,
                  'Cache-Control': 'no-store',
                },
              });
            }
          }
        }
      } catch {
        // Fall back to 3DHubVN proxy
      }
    }

    // 2. Upstream proxy via 3DHubVN community bridge
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    let upstream: Response;
    try {
      upstream = await fetch('https://mwc.3dhubvn.net/api/v1/makerworld/public/china/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://mwc.3dhubvn.net/makerworld-cn',
          'Origin': 'https://mwc.3dhubvn.net',
          'Accept': '*/*',
        },
        body: JSON.stringify({ model_id: Number(modelId), profile_id: Number(profileId) }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch {
      return NextResponse.json(
        {
          code: 'UPSTREAM_UNREACHABLE',
          message: 'Không thể kết nối đến máy chủ tải 3DHubVN (mwc.3dhubvn.net). Vui lòng thử lại sau ít phút.',
          fallbackUrl: 'https://mwc.3dhubvn.net/makerworld-cn',
        },
        { status: 502 }
      );
    }

    if (!upstream.ok) {
      const is502 = upstream.status === 502;
      return NextResponse.json(
        {
          code: is502 ? 'UPSTREAM_SERVER_OFFLINE' : 'UPSTREAM_DOWNLOAD_FAILED',
          message: is502
            ? 'Máy chủ tải file dự phòng (mwc.3dhubvn.net) hiện đang gặp sự cố 502 Bad Gateway (máy chủ trung gian ngoại vi tạm gián đoạn). Vui lòng thử lại sau ít phút.'
            : 'Không thể tải file trực tiếp từ nguồn. Bạn có thể mở công cụ dự phòng để tải file.',
          fallbackUrl: 'https://mwc.3dhubvn.net/makerworld-cn',
        },
        { status: 502 }
      );
    }

    const filename = `makerworld-${modelId}-${profileId}.3mf`;
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
