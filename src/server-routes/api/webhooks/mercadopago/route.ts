import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

interface PaymentMetadata {
  orderId?: string;
  email?: string;
  name?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export async function POST(request: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  try {
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};

    // Verificación HMAC-SHA256 si existe secret
    if (secret) {
      const signature = request.headers.get("x-hub-signature") || "";
      if (!signature) {
        console.warn("Mercado Pago webhook: signature header missing");
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
      }

      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (expected !== signature) {
        console.warn("Mercado Pago webhook: invalid signature", { expected, signature });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    console.log("Mercado Pago webhook received:", JSON.stringify(body, null, 2));

    // Procesar notificación de pago
    if (body.type === "payment" && body.data?.id) {
      const payment = new Payment(client);
      const paymentId = body.data.id;

      // Obtener detalles del pago directamente desde MP
      const paymentResponse = await payment.get({ id: paymentId });
      
      if (paymentResponse.status === "approved") {
        // En el checkout guardamos info útil en external_reference
        let metadata: PaymentMetadata = {};
        try {
          metadata = JSON.parse(paymentResponse.external_reference || "{}");
        } catch (e) {
          console.error("Error parsing external_reference metadata:", e);
        }

        const email = metadata.email || (paymentResponse.payer && typeof paymentResponse.payer === 'object' && 'email' in paymentResponse.payer ? (paymentResponse.payer as { email: string }).email : undefined);
        
        // Cantidad de stickers a sumar (según la lógica de promos del checkout)
        // Por defecto sumamos 1 si no viene el dato
        const stampsToAdd = typeof metadata.eligibleStamps === 'number' ? metadata.eligibleStamps : 1;
        
        if (email && stampsToAdd > 0) {
          console.log(`Pago aprobado para ${email}. Sumando ${stampsToAdd} stickers.`);
          const supabase = createAdminClient();

          // 1. Buscar al cliente en la base de datos
          const { data: customer, error: fetchError } = await supabase
            .from("customers")
            .select("*")
            .eq("email", email)
            .maybeSingle();

          if (fetchError) {
            console.error("Error fetching customer from Supabase:", fetchError);
          } else if (customer) {
            // Lógica existente para cliente ya registrado
            const oldCount = customer.purchases_count || 0;
            const newCount = oldCount + stampsToAdd;
            const today = new Date();
            const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
            
            const newDates = [...(customer.purchase_dates || [])];
            while (newDates.length < 10) newDates.push("");
            
            // Marcar los slots necesarios
            for (let i = 0; i < stampsToAdd; i++) {
              const slotIdx = oldCount + i;
              if (slotIdx < 10) {
                newDates[slotIdx] = dateStr;
              }
            }

            await supabase
              .from("customers")
              .update({
                purchases_count: newCount,
                purchase_dates: newDates,
                last_updated: today.toISOString(),
              })
              .eq("id", customer.id);

            // Registrar en el historial detallado de lealtad
            const historyRecords = Array.from({ length: stampsToAdd }).map((_, i) => ({
              customer_id: customer.id,
              purchase_date: today.toISOString(),
              card_number: Math.floor((oldCount + i) / 10) + 1,
            }));
            await supabase.from("customer_loyalty_purchases").insert(historyRecords);

            // Marcar la orden como pagada si tenemos el orderId
            if (metadata.orderId) {
               await supabase.from("orders").update({ status: "paid" }).eq("id", metadata.orderId);
            }

            console.log(`Cupón actualizado para ${customer.name || email}`);
            
            // Enviar email de confirmación de pago (para cliente existente)
            try {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
              if (baseUrl) {
                await fetch(`${baseUrl}/api/send-payment-confirmation`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: email,
                    name: customer.name || metadata.name,
                    phone: metadata.phone || "",
                    deliveryAddress: metadata.deliveryAddress || "",
                    deliveryOption: metadata.deliveryOption || "ciudad",
                  }),
                });
              }
            } catch (emailErr) {
              console.error("Error sending payment confirmation for existing customer:", emailErr);
            }
          } else {
            // --- NUEVA LÓGICA: CREACIÓN AUTOMÁTICA ---
            console.log(`Creando nuevo cliente para ${email}...`);
            
            // Generar un username amigable desde el email
            const emailPrefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
            const today = new Date();
            const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
            const verificationToken = crypto.randomBytes(32).toString("hex");

            // Slots de compra: la primera completada, el resto vacío
            const initialDates = Array(10).fill("");
            for (let i = 0; i < stampsToAdd && i < 10; i++) {
              initialDates[i] = dateStr;
            }

            const { data: newCustomer, error: insertError } = await supabase
              .from("customers")
              .insert({
                name: metadata.name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1),
                email: email,
                username: emailPrefix,
                purchases_count: stampsToAdd,
                purchase_dates: initialDates,
                is_verified: false,
                verification_token: verificationToken,
                last_updated: today.toISOString(),
              })
              .select()
              .single();

            if (insertError) {
              console.error("Error creating auto-customer:", insertError);
            } else if (newCustomer) {
              const historyRecords = Array.from({ length: stampsToAdd }).map((_, i) => ({
                customer_id: newCustomer.id,
                purchase_date: today.toISOString(),
                card_number: Math.floor(i / 10) + 1,
              }));
              await supabase.from("customer_loyalty_purchases").insert(historyRecords);

              if (metadata.orderId) {
                 await supabase.from("orders").update({ status: "paid" }).eq("id", metadata.orderId);
              }

              console.log(`Cliente automático creado: ${emailPrefix}`);

              // Enviar email de bienvenida y verificación
              try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
                if (baseUrl) {
                  await fetch(`${baseUrl}/api/admin/send-promo`, {
                    method: "POST",
                    headers: { 
                      "Content-Type": "application/json",
                      "x-admin-password": process.env.ADMIN_PASSWORD || ""
                    },
                    body: JSON.stringify({
                      email: email,
                      name: newCustomer.name,
                      username: newCustomer.username,
                      isAutoCreated: true,
                      subject: "¡Bienvenido a Moovimiento! Sumaste tus stickers ⚡",
                      html: `<p>Hola ${newCustomer.name}!</p><p>Gracias por tu compra. Ya tenés tus stickers en tu cupón digital.</p><p><strong>Verificá tu cuenta en el siguiente link para ver tu progreso:</strong></p><p><a href="${baseUrl}/api/users/confirm?token=${verificationToken}">${baseUrl}/api/users/confirm?token=${verificationToken}</a></p>`,
                    }),
                  });
                }
              } catch (emailErr) {
                console.error("Error sending welcome email:", emailErr);
              }

              // Enviar TAMBIÉN el email de confirmación de pago (para nuevo cliente)
              try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
                if (baseUrl) {
                  await fetch(`${baseUrl}/api/send-payment-confirmation`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: email,
                      name: newCustomer.name,
                      phone: metadata.phone || "",
                      deliveryAddress: metadata.deliveryAddress || "",
                      deliveryOption: metadata.deliveryOption || "ciudad",
                    }),
                  });
                }
              } catch (emailErr) {
                console.error("Error sending payment confirmation for new customer:", emailErr);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing Mercado Pago webhook:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
