import { NextRequest, NextResponse } from 'next/server';
import { markOrderDelivered } from '@/lib/orders';
import { isAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body || {};
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await markOrderDelivered(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error marking delivered:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
