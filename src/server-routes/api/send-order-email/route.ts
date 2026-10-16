import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { saveOrder, OrderItem } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

interface EmailBody {
  orderId?: string | null;
  name?: string;
  email: string;
  phone: string;
  items: OrderItem[];
  deliveryOption: string;
  deliveryAddress: string;
  totalPrice: number;
  totalMixQty: number;
  paymentLink?: string;
  paymentMethod?: string;
  discountCode?: string | null;
  discountAmount?: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log("Iniciando envío de email...");
    const body = (await request.json()) as EmailBody;
    const {
      orderId,
      name,
      email,
      phone,
      items,
      deliveryOption,
      deliveryAddress,
      totalPrice,
      totalMixQty,
      paymentLink,
      paymentMethod,
      discountCode,
      discountAmount,
    } = body;

    console.log("Datos recibidos:", {
      email,
      name,
      phone,
      itemsCount: items.length,
      deliveryOption,
      paymentMethod,
      totalPrice,
      discountCode,
      discountAmount,
    });

    // Validar datos requeridos
    if (!email || !phone || !items || items.length === 0) {
      console.error("Datos faltantes:", {
        email: !!email,
        phone: !!phone,
        items: items?.length,
      });
      return NextResponse.json(
        { error: "Hubo un error: Por favor intente nuevamente más tarde" },
        { status: 400 },
      );
    }

    // Verificar que la API key de Resend esté configurada
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY no está configurada");
      return NextResponse.json(
        { error: "Hubo un error: Por favor intente nuevamente más tarde" },
        { status: 500 },
      );
    }

    // Inicializar Resend solo cuando se necesita
    console.log("Inicializando Resend...");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const currency = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });

    // Función para detectar ingredientes que difieren entre mixes
    const getIngredientDifferences = (items: OrderItem[]) => {
      const differences = new Map<number, Set<string>>();

      items.forEach((item, index) => {
        const match = (item.title ?? "").match(/^(.*?)\s*\((.*)\)$/);
        if (!match) return;

        const composition = match[2];
        const currentIngredients = new Map<string, number>();

        // Parsear ingredientes del mix actual
        composition.split(",").forEach((ing) => {
          const ingMatch = ing.trim().match(/^(.+?)\s+(\d+)%$/);
          if (ingMatch) {
            currentIngredients.set(ingMatch[1].trim(), parseInt(ingMatch[2]));
          }
        });

        const itemDifferences = new Set<string>();

        // Comparar con otros Mixes
        items.forEach((otherItem, otherIndex) => {
          if (otherIndex !== index) {
            const otherMatch = (otherItem.title ?? "").match(
              /^(.*?)\s*\((.*)\)$/,
            );
            if (!otherMatch) return;

            const otherComposition = otherMatch[2];
            const otherIngredients = new Map<string, number>();

            // Parsear ingredientes del otro mix
            otherComposition.split(",").forEach((ing) => {
              const ingMatch = ing.trim().match(/^(.+?)\s+(\d+)%$/);
              if (ingMatch) {
                otherIngredients.set(ingMatch[1].trim(), parseInt(ingMatch[2]));
              }
            });

            // Comparar ingredientes
            currentIngredients.forEach((percent, ingredient) => {
              const otherPercent = otherIngredients.get(ingredient);
              if (otherPercent !== undefined && percent !== otherPercent) {
                itemDifferences.add(ingredient);
              }
            });
          }
        });

        differences.set(index, itemDifferences);
      });

      return differences;
    };

    const ingredientDifferences = getIngredientDifferences(items);

    // Generar HTML del resumen
    const itemsHTML = items
      .map((item, index) => {
        // Extraer composición del título (ej: "Mix personalizado (Pera 20%, ...)")
        const match = (item.title ?? "").match(/^(.*?)\s*\((.*)\)$/);
        const productName = match ? match[1] : (item.title ?? "");
        let composition = match ? match[2] : "";

        // Destacar ingredientes que difieren
        if (composition && ingredientDifferences.has(index)) {
          const differentIngredients = ingredientDifferences.get(index)!;
          composition = composition
            .split(",")
            .map((ing) => {
              const ingMatch = ing.trim().match(/^(.+?)\s+(\d+)%$/);
              if (ingMatch) {
                const ingredient = ingMatch[1].trim();
                const percent = ingMatch[2];
                if (differentIngredients.has(ingredient)) {
                  return `<strong style="color: #fbbf24;">${ingredient} ${percent}%</strong>`;
                }
              }
              return ing.trim();
            })
            .join(", ");
        }

        const qty = Number(item.quantity ?? 0);
        const unit = Number(item.unit_price ?? 0);
        const displayPrice = unit * qty;
        const isSavingRow = displayPrice < 0;

        return `
        <tr ${isSavingRow ? 'style="background-color: #f0fdf4;"' : ""}>
          <td style="padding: 8px; border-bottom: 1px solid #eee; ${isSavingRow ? "color: #16a34a;" : ""}">
            <strong>${productName}</strong>
            ${composition ? `<br><span style="font-size: 13px; color: #666; line-height: 1.6;">${composition}</span>` : ""}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; ${isSavingRow ? "color: #16a34a;" : ""}">${qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; white-space:nowrap; ${isSavingRow ? "color: #16a34a;" : ""}">${currency.format(displayPrice)}</td>
        </tr>
      `;
      })
      .join("");

    // Generar filas de ahorros
    let ahorrosHTML = "";
    const hasDeliveryLine = items.some((it) => {
      const title = (it.title ?? "").toLowerCase();
      return title.includes("envío") || title.includes("envio");
    });

    const hasDiscountLine = items.some((it) => {
      const amount = Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
      if (amount >= 0) return false;

      if (
        discountCode &&
        (it.title ?? "").toUpperCase().includes(discountCode.toUpperCase())
      ) {
        return true;
      }

      if (discountAmount && discountAmount > 0) {
        return Math.round(Math.abs(amount)) === Math.round(discountAmount);
      }

      return false;
    });

    // Promos vigentes: 1 mix = 4700, pack de 5 = 22000, pack de 10 = 43000
    const PRICE_SINGLE = 4700;
    const PRICE_PACK5 = 22000;
    const PRICE_PACK10 = 43000;

    let rem = Number(totalMixQty ?? 0);
    const n10 = Math.floor(rem / 10);
    rem -= n10 * 10;
    const n5 = Math.floor(rem / 5);
    rem -= n5 * 5;
    const n1 = rem;

    const precioSinPromo = Number(totalMixQty ?? 0) * PRICE_SINGLE;
    const precioConPromo =
      n10 * PRICE_PACK10 + n5 * PRICE_PACK5 + n1 * PRICE_SINGLE;
    const descuentoPromo = precioSinPromo - precioConPromo;

    const hasPromoLine = items.some((it) => {
      const amount = Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
      if (amount >= 0) return false;
      return /promo/i.test(it.title ?? "");
    });

    const totalMixesEnItems = items.reduce((sum, it) => {
      const title = (it.title ?? "").toLowerCase();
      if (!title.includes("mix personalizado")) return sum;

      const amount = Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
      if (amount <= 0) return sum;
      return sum + amount;
    }, 0);

    // Si los mixes ya vienen con precio promocional prorrateado, no agregar fila extra de ahorro.
    const promoYaEmbebida =
      descuentoPromo > 0 && Math.abs(totalMixesEnItems - precioConPromo) <= 2;

    // Ahorro por descuento por código
    if (
      discountCode &&
      discountAmount &&
      discountAmount > 0 &&
      !hasDiscountLine
    ) {
      // Aplicar tope por seguridad (en caso de que venga mayor desde el cliente)
      const DISCOUNT_CAP = 787;
      const displayDiscountAmount = Math.min(discountAmount, DISCOUNT_CAP);

      // Detectar si el descuento es porcentual (para mostrar "(- 7%)") o fijo
      let discountIsPercentage = false;
      let discountPercent = 0;
      try {
        const mapEnv = process.env.NEXT_PUBLIC_DISCOUNT_MAP || "";
        if (mapEnv) {
          const parsed = JSON.parse(mapEnv) as Record<
            string,
            { type: "percentage" | "fixed"; value: number }
          >;
          const mapped = parsed[(discountCode || "").toUpperCase()];
          if (mapped) {
            if (mapped.type === "percentage") {
              discountIsPercentage = true;
              discountPercent = mapped.value;
            }
          }
        }
      } catch {
        // ignore parse errors
      }

      // Fallback heurística si no viene en el mapa
      if (!discountIsPercentage) {
        const numberMatch = (discountCode || "").toUpperCase().match(/(\d+)$/);
        if (numberMatch) {
          const num = parseInt(numberMatch[1]);
          if (numberMatch[1].length <= 2 && num > 0 && num <= 100) {
            discountIsPercentage = true;
            discountPercent = num;
          }
        }
      }

      const leftLabel = discountIsPercentage
        ? `🎉 Ahorro por el código de descuento ${discountCode} (- ${discountPercent}%)`
        : `🎉 Ahorro por el código de descuento ${discountCode}`;

      ahorrosHTML += `
        <tr style="background-color: #f0fdf4;">
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #16a34a;">
            <strong>${leftLabel}</strong>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; color: #16a34a;">1</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #16a34a; white-space:nowrap;">- ${currency.format(displayDiscountAmount)}</td>
        </tr>
      `;
    }

    if (descuentoPromo > 0 && !hasPromoLine && !promoYaEmbebida) {
      const promoParts: string[] = [];
      if (n10 > 0) promoParts.push(`${n10} de 10 Mixes`);
      if (n5 > 0) promoParts.push(`${n5} de 5 Mixes`);
      const promoLabel =
        promoParts.length > 0 ? ` (${promoParts.join(" + ")})` : "";

      ahorrosHTML += `
        <tr style="background-color: #f0fdf4;">
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #16a34a;">
            <strong>🎉 Ahorro por promos${promoLabel}</strong>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; color: #16a34a;">1</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #16a34a; white-space:nowrap;">- ${currency.format(descuentoPromo)}</td>
        </tr>
      `;
    }

    const deliveryRowHTML =
      deliveryOption === "envio" && !hasDeliveryLine
        ? `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    <strong>Envío a Córdoba</strong>
                  </td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">1</td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; white-space:nowrap;">${currency.format(1000)}</td>
                </tr>
                `
        : "";

    const deliveryText =
      deliveryOption === "ciudad"
        ? "Ciudad Universitaria (Envío gratuito)"
        : deliveryOption === "sagrada"
          ? "Punto de encuentro (Envío gratuito)"
          : `Córdoba (${currency.format(1000)})`;

    // Auto-create customer if doesn't exist
    const supabase = createAdminClient();
    let verificationToken = "";
    let customerUsername = "";

    try {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (!existingCustomer) {
        console.log(`Creando cliente automático inicial para ${email}...`);
        customerUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        verificationToken = crypto.randomBytes(32).toString("hex");

        await supabase.from("customers").insert({
          name: name || customerUsername,
          email: email,
          username: customerUsername,
          purchases_count: 0,
          purchase_dates: Array(10).fill(""),
          is_verified: false,
          verification_token: verificationToken,
          last_updated: new Date().toISOString(),
        });
      } else {
        customerUsername = existingCustomer.username;
        verificationToken = existingCustomer.verification_token;
      }
    } catch (err) {
      console.error("Error ensuring customer exists:", err);
    }

    console.log("Enviando email...");

    let result;
    try {
      const emailSubject =
        paymentMethod === "efectivo"
          ? `📱 ¡${name ? name + ", " : ""}tu pedido está confirmado! Te contactaremos por WhatsApp`
          : `🎉 ¡${name ? name + ", " : ""}tu pedido de Frutos Secos está casi listo!`;

      // Persist order to orders datastore (Supabase) and generate pay token
      // Only if not already saved (passed via orderId)
      let savedOrderId: string | null = orderId || null;
      if (!savedOrderId) {
        try {
          const id = await saveOrder({
            name,
            email,
            phone,
            items,
            deliveryOption,
            deliveryAddress,
            totalPrice,
            totalMixQty,
            paymentMethod: paymentMethod || "unknown",
            paymentLink,
            discountCode,
            discountAmount,
          });
          savedOrderId = id;
        } catch (err) {
          console.error("Error persisting order:", err);
        }
      }

      // If no direct paymentLink provided, create a pay token so the email can include /pay/{token}
      let paymentToken: string | undefined = undefined;
      if (!paymentLink && savedOrderId) {
        try {
          const { createPayToken } = await import("@/lib/payToken");
          paymentToken = createPayToken(savedOrderId);
        } catch (err) {
          console.error("Error creating payment token:", err);
        }
      }

      // Build action block (WhatsApp + optional Mercado Pago button)
      // Use block display and padding for better mobile compatibility in email clients
      const whatsappButton = `
        <a href="https://wa.me/5493513239624" style="display:block; padding:12px 20px; background-color:#25d366; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:700; text-align:center; margin:8px auto; max-width:280px;">
          <span style="font-size:18px; margin-right:8px; vertical-align:middle;">📱</span>
          <span style="vertical-align:middle;">Coordinar por WhatsApp</span>
        </a>
      `;

      // If we have a direct paymentLink prefer it; otherwise use pay token link that will create/redirect on-demand
      const payHref = paymentLink
        ? paymentLink
        : paymentToken && process.env.NEXT_PUBLIC_BASE_URL
          ? `${process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/pay/${paymentToken}`
          : "";
      const payButton = payHref
        ? `
        <a href="${payHref}" style="display:block; padding:12px 20px; background-color:#fbbf24; color:#000000; text-decoration:none; border-radius:8px; font-weight:700; text-align:center; margin:8px auto; max-width:280px;">
          <span style="font-size:18px; margin-right:8px; vertical-align:middle;">💳</span>
          <span style="vertical-align:middle;">Pagar con Mercado Pago</span>
        </a>
      `
        : "";

      const buttonsRow = `<div style="text-align:center; margin-top:16px;">${whatsappButton}${payButton}</div>`;

      // Small hint shown below buttons when a Mercado Pago button is available
      const mpNote = payButton
        ? `<p style="margin-top:8px; font-size:14px; color:#333;">Si preferís pagar ahora, usá el botón de Mercado Pago (pago seguro y rápido).</p>`
        : "";

      const efectivoBlock = `
        <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>📱 ¡Te contactaremos por WhatsApp!</strong></p>
          <p style="margin: 0;">Tu pedido está confirmado. Te vamos a contactar para coordinar la entrega y el pago en efectivo. Si querés tomar la iniciativa, podés escribirnos directamente:</p>
          <div style="text-align: center;">${buttonsRow}${mpNote}</div>
        </div>
      `;

      const nonEfectivoBlock = `
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>⚠️ Último paso: completá el pago</strong></p>
          <p style="margin: 0;">Tu pedido está reservado. <strong>Si todavía no lo abonaste</strong> hacé click en el botón de abajo:</p>
          <div style="text-align: center;">${buttonsRow}${mpNote}</div>
        </div>
      `;

      const actionBlock =
        paymentMethod === "efectivo" ? efectivoBlock : nonEfectivoBlock;

      // Add a loyalty card preview or verification link
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
      const verificationLink = (baseUrl && verificationToken)
        ? `${baseUrl.replace(/\/$/, "")}/api/users/confirm?token=${verificationToken}`
        : "";

      const loyaltyBlock = verificationLink ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; color: #166534;"><strong>⚡ ¡Conseguí stickers gratis!</strong></p>
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #166534;">Por cada mix que compres, acumulás stickers para canjearlos por envases gratis.</p>
          <a href="${verificationLink}" style="display:inline-block; padding:10px 16px; background-color:#16a34a; color:white; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;">
            Verificar mi cuenta y ver mis stickers
          </a>
        </div>
      ` : "";

      result = await resend.emails.send({
        from: "Gonza de Moovimiento <gonzagramaglia@gmail.com>",
        to: email,
        bcc: ["gonzagramaglia@gmail.com"],
        subject: emailSubject,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fbbf24; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; color: white; font-size: 20px;">⚡ Moovimiento</h2>
          </div>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <h1 style="font-size: 28px; color: #fbbf24;">🤩 ¡Pedido casi listo!</h1>
            <p style="font-size: 18px;">¡Hola${name ? ` ${name}` : ""}! 👋</p>
            <p>Gracias por armar tu mix personalizado con nosotros. Acá te dejamos el resumen de tu pedido:</p>

            <h3>Detalle del pedido:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; border-radius: 4px;">
              <thead>
                <tr>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: left;">Producto</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: center;">Cantidad</th>
                  <th style="background-color: #f3f4f6; padding: 12px; text-align: right;">Precio</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
                ${deliveryRowHTML}
                ${ahorrosHTML}
              </tbody>
            </table>

            <div style="background-color: #fff; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px 0;"><strong>Total de Mixes:</strong> ${totalMixQty} 📦</p>
              <p style="margin: 0;"><strong>Gramos:</strong> ${totalMixQty * 220}g ⚡</p>
            </div>
            
            <h3>Información de entrega:</h3>
            <div style="background-color: #fff; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px 0;"><strong>Delivery en:</strong> ${deliveryText}</p>
              <p style="margin: 0 0 8px 0;"><strong>Dirección:</strong> ${deliveryAddress || "No especificada"}</p>
              <p style="margin: 0;"><strong>Celular:</strong> ${phone}</p>
            </div>

            

            

            <table style="width:100%; background-color: #f3f4f6; padding: 12px; margin: 20px 0; border-radius: 4px; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px; vertical-align: middle;">
                  <strong style="font-size: 20px;">${paymentMethod === "efectivo" ? "Total a pagar en efectivo:" : "Total a pagar:"}</strong>
                </td>
                <td style="padding: 12px; text-align: right; vertical-align: middle; white-space:nowrap; font-size: 20px; font-weight: bold;">${currency.format(totalPrice)}</td>
              </tr>
            </table>
            
            ${loyaltyBlock}

            ${actionBlock}
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Una vez que confirmes el pago, te vamos a enviar otro email con todos los detalles de la entrega 📦
            </p>
            
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              ¿Tenés alguna duda? Escribinos a <a href="mailto:gonzagramaglia@gmail.com">gonzagramaglia@gmail.com</a> o visitá nuestras <a href="https://www.moovimiento.com/#faq">Preguntas Frecuentes</a>
            </p>

            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              ¡Gracias por confiar en nosotros! ⚡<br>
              Gonza
            </p>
          </div>
        </div>
      `,
      });
    } catch (resendError) {
      console.error("Error específico de Resend:", resendError);
      throw resendError;
    }

    console.log("Email enviado exitosamente:", result);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);

    return NextResponse.json(
      { error: "Hubo un error: Por favor intente nuevamente más tarde" },
      { status: 500 },
    );
  }
}
