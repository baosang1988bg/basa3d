import { NextResponse } from "next/server";
import { apiError } from "../../../../lib/api";
import { requireAdmin } from "../../../../lib/auth/require-admin";
import {
  customRequestStatusUpdateSchema,
  uuidSchema,
} from "../../../../domain/schemas";
import { updateCustomRequestStatus } from "../../../../services/custom-request.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const id = uuidSchema.parse((await params).id);
    const { status, overrideReason } = customRequestStatusUpdateSchema.parse(
      await request.json(),
    );
    return NextResponse.json(
      await updateCustomRequestStatus(id, status, session.actorId, { role: session.role, overrideReason }),
    );
  } catch (error) {
    return apiError(error);
  }
}
