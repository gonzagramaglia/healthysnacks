import { NextResponse } from 'next/server';
import { verifyPayToken } from '@/lib/payToken';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { OrderRecord, OrderItem } from '@/lib/orders';

// Small helper to convert snake_case DB rows returned by Supabase into camelCase fields
function toCamelRow(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const parts = key.split('_');
    if (parts.length === 1) {
      out[key] = obj[key];
      continue;
    }
    const camel = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    out[camel] = obj[key];
  }
  return out;
}

// Mercado Pago client
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
});

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const payload = verifyPayToken(token);
    if (!payload || !payload.orderId) {
      return NextResponse.redirect('/?error=invalid_token');
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('orders').select('*').eq('id', payload.orderId).single();
    if (error || !data) {
      console.error('Order not found for pay token:', payload.orderId, error);
      return NextResponse.redirect('/?error=order_not_found');
    }

  const order = (toCamelRow(data as Record<string, unknown>) as unknown) as OrderRecord;

    // If we already have a payment link saved, redirect to it
    if (order.paymentLink) {
      return NextResponse.redirect(order.paymentLink as string);
    }

    // Otherwise create a preference now and persist it
    const items = (order.items || []) as OrderItem[];
    const preference = new Preference(mpClient);

    const preferenceItems = items.map((it: OrderItem, idx: number) => ({
      id: `item-${idx}`,
      title: it.title ?? 'Mix',
      quantity: Number(it.quantity ?? 1),
      unit_price: Number(it.unit_price ?? 0),
      currency_id: 'ARS',
    }));

    // If there is a discount amount saved, push as negative item
    if (order.discountAmount && Number(order.discountAmount) > 0) {
      // Avoid double-applying discount: only add a discount item if the saved items
      // don't already include a negative item representing the discount.
      const hasDiscountItem = preferenceItems.some(pi => {
        const up = Number((pi as Record<string, unknown>).unit_price ?? 0);
        const id = (pi as Record<string, unknown>).id as string | undefined;
        const title = (pi as Record<string, unknown>).title as string | undefined;
        if (up < 0) {
          if (id && id.toString().toLowerCase().startsWith('discount-')) return true;
          if (title && title.toLowerCase().includes('descuento')) return true;
        }
        return false;
      });
      if (!hasDiscountItem) {
        preferenceItems.push({
          id: `discount-${order.discountCode || 'disc'}`,
          title: `Descuento (${order.discountCode || ''})`,
          quantity: 1,
          unit_price: -Number(order.discountAmount),
          currency_id: 'ARS',
        });
      }
    }

    const backBase = process.env.NEXT_PUBLIC_BASE_URL || '';
    const preferenceData: Record<string, unknown> = {
      items: preferenceItems,
      back_urls: {
        success: `${backBase}/checkout/success`,
        failure: `${backBase}/checkout/failure`,
        pending: `${backBase}/checkout/pending`,
      },
      notification_url: `${backBase}/api/webhooks/mercadopago`,
      auto_return: 'approved',
      statement_descriptor: 'MOOVIMIENTO',
      external_reference: JSON.stringify({ orderId: order.id }),
      payer: {
        email: order.email,
        name: order.name,
      },
      locale: 'es-AR',
    };

  // preference.create expects the library's request shape; cast here to `any`
  // Call the external SDK (typed loosely) and normalize response as a record to avoid `any`.
  const resp = await (preference as unknown as { create: (opts: unknown) => Promise<unknown> }).create({ body: preferenceData });
  const respRecord = resp as unknown as Record<string, unknown>;
  const initPoint = respRecord.init_point as string | undefined;

    // Persist init_point in order
    try {
  await supabase.from('orders').update({ payment_link: initPoint, preference_id: respRecord.id as string | undefined, pref_created_at: new Date().toISOString() }).eq('id', payload.orderId);
    } catch (e) {
      console.error('Error updating order with preference', e);
    }

    return NextResponse.redirect(initPoint as string);
  } catch (e) {
    console.error('Error in /pay route:', e);
    return NextResponse.redirect('/?error=server_error');
  }
}
