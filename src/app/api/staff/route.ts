import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireOwner } from '../../../lib/auth/require-admin';
import { staffCreateInputSchema } from '../../../domain/schemas';
import { createStaffAccount, listStaff } from '../../../services/staff.service';

export async function GET() { try { await requireOwner(); return NextResponse.json(await listStaff()); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { const { actorId } = await requireOwner(); return NextResponse.json(await createStaffAccount(staffCreateInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
