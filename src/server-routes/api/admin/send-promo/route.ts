import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';
import buildGenericEmailHtml from '@/lib/emailTemplates';
import { isAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const body = await request.json();
  const { orderIds, emails, subject, title, html, headerImage } = body || {};
    if ((!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) && (!emails || !Array.isArray(emails) || emails.length === 0)) {
      return NextResponse.json({ error: 'Missing recipients (orderIds or emails)' }, { status: 400 });
    }
    if (!subject || !html) {
      return NextResponse.json({ error: 'Missing subject or html' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const results: Array<{ id?: string; email: string; ok: boolean; error?: unknown }> = [];

    // First, send to orderIds if provided (fetch names/emails)
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.from('orders').select('id,name,email').in('id', orderIds as string[]);
      if (error) {
        console.error('Error fetching orders for promo:', error);
        return NextResponse.json({ error: 'Error fetching orders' }, { status: 500 });
      }

      for (const row of data || []) {
        const to = row.email;
  const personalizedBody = (html || '').replace(/{{\s*name\s*}}/gi, row.name || '');
  const headerImageHtml = headerImage ? `<div style="text-align:center; margin:12px 0;"><img src="${headerImage}" alt="Portada" style="max-width:100%; height:auto; border-radius:8px;"/></div>` : undefined;
  const wrapped = buildGenericEmailHtml({ title: (title || subject), name: row.name || undefined, contentHtml: personalizedBody, headerImageHtml });
        try {
          await resend.emails.send({
            from: 'Gonza de Moovimiento <gonzagramaglia@gmail.com>',
            to,
            subject,
            html: wrapped,
          });
          results.push({ id: row.id, email: to, ok: true });
        } catch (err) {
          console.error('Error sending promo to', to, err);
          results.push({ id: row.id, email: to, ok: false, error: err as unknown });
        }
      }
    }

    // Then, send to raw emails if provided
    if (emails && Array.isArray(emails) && emails.length > 0) {
      for (const to of emails) {
  const personalizedBody = (html || '').replace(/{{\s*name\s*}}/gi, '');
  const headerImageHtml = headerImage ? `<div style="text-align:center; margin:12px 0;"><img src="${headerImage}" alt="Portada" style="max-width:100%; height:auto; border-radius:8px;"/></div>` : undefined;
  const wrapped = buildGenericEmailHtml({ title: (title || subject), contentHtml: personalizedBody, headerImageHtml });
        try {
          await resend.emails.send({ from: 'Gonza de Moovimiento <gonzagramaglia@gmail.com>', to, subject, html: wrapped });
          results.push({ email: to, ok: true });
        } catch (err) {
          console.error('Error sending promo to', to, err);
          results.push({ email: to, ok: false, error: err as unknown });
        }
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('send-promo error:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
