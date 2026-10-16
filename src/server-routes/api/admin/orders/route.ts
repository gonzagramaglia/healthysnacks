import { NextResponse } from 'next/server';
import { getOrders } from '@/lib/orders';
import { isAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    console.error('Error fetching orders:', err);
    return NextResponse.json({ error: 'Error fetching orders' }, { status: 500 });
  }
}
