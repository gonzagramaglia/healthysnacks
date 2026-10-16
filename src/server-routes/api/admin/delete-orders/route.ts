import { NextRequest, NextResponse } from 'next/server';
import { deleteOrders } from '@/lib/orders';
import { isAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body || {};
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing ids' }, { status: 400 });
    }

    await deleteOrders(ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error deleting orders:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
