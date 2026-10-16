import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { saveOrder, OrderItem } from "@/lib/orders";
import { validateCoupon } from "@/lib/discount-codes";

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

interface CheckoutItem {
  title: string;
  quantity: number;
  unit_price: number;
  // Opcional: categoría y descripción para mejorar la tasa de aprobación de Mercado Pago
  category_id?: string;
  description?: string;
}

interface CheckoutBody {
  items: CheckoutItem[];
  deliveryOption: string;
  deliveryAddress: string;
  email: string;
  name?: string;
  phone?: string;
  discountCode?: string | null;
}

interface PreferenceData {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
    category_id?: string;
    description?: string;
  }>;
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  // URL to receive Mercado Pago webhooks
  notification_url?: string;
  auto_return: string;
  statement_descriptor: string;
  external_reference: string;
  locale?: string;
  payer?: {
    email: string;
    name?: string;
    phone?: {
      area_code: string;
      number: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const {
      items,
      deliveryOption,
      deliveryAddress,
      email,
      name,
      phone,
      discountCode,
    } = body;

    console.log("Creating preference with items:", items);
    console.log("Discount info:", { discountCode });

    // Crear preferencia de pago
    const preference = new Preference(client);

    // Mapear items existentes
    const preferenceItems = items.map((item, index) => ({
      id: `item-${index}`,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unit_price,
      currency_id: "ARS",
      // Enviar category_id y description si están disponibles para mejorar la aprobación
      category_id: item.category_id,
      description: item.description,
    }));

    const subtotalBeforeCoupon = preferenceItems.reduce((sum, item) => {
      const up = Number(item.unit_price ?? 0);
      const q = Number(item.quantity ?? 0);
      return sum + up * q;
    }, 0);

    let appliedDiscountCode: string | null = null;
    let appliedDiscountAmount = 0;
    if (discountCode) {
      const couponResult = await validateCoupon({
        code: discountCode,
        subtotal: subtotalBeforeCoupon,
        email,
      });

      if (couponResult.valid && couponResult.discountAmount > 0) {
        appliedDiscountCode = couponResult.code;
        appliedDiscountAmount = couponResult.discountAmount;

        preferenceItems.push({
          id: `discount-${couponResult.code}`,
          title: `Descuento (${couponResult.code})`,
          quantity: 1,
          unit_price: -couponResult.discountAmount,
          currency_id: "ARS",
          category_id: undefined,
          description: `Descuento aplicado: ${couponResult.code}`,
        });
      }
    }

    const totalWithDiscount = preferenceItems.reduce((sum, it) => {
      const item = it as { unit_price?: number; quantity?: number };
      const up = Number(item.unit_price ?? 0) || 0;
      const q = Number(item.quantity ?? 0) || 0;
      return sum + up * q;
    }, 0);

    // 1. Calcular cuántos stickers corresponden (Lógica: Promos no suman)
    // Si compra 6, y 5 son promo, solo suma 1. 
    // Asumimos que cada 5 unidades es una promo que NO suma stickers adicionales.
    const totalItemsQty = (items || []).reduce(
      (sum, it) => sum + (Number(it.quantity) || 0),
      0,
    );
    
    // Calculamos los stickers elegibles:
    // Restamos paquetes de 5 (promos) de la cantidad total.
    // Ejemplo: 4 items -> 4 stickers. 6 items -> 1 sticker (6 - 5). 11 items -> 1 sticker (11 - 10).
    const promosCount = Math.floor(totalItemsQty / 5);
    const eligibleStamps = Math.max(0, totalItemsQty - (promosCount * 5));

    console.log(`Cálculo de lealtad: Total ${totalItemsQty}, Promos ${promosCount}, Stickers elegibles: ${eligibleStamps}`);

    // 2. Persistir el pedido en Supabase PRIMERO
    let savedOrderId: string | undefined = undefined;
    try {
      savedOrderId = await saveOrder({
        name,
        email,
        phone: phone ?? "",
        items: items as unknown as OrderItem[],
        deliveryOption,
        deliveryAddress,
        totalPrice: totalWithDiscount,
        totalMixQty: totalItemsQty,
        paymentMethod: "mercadopago",
        discountCode: appliedDiscountCode,
        discountAmount: appliedDiscountAmount,
      });
    } catch (err) {
      console.error("Error saving order before creating preference:", err);
    }

    const preferenceData: PreferenceData = {
      items: preferenceItems,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/failure`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/pending`,
      },
      notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`,
      auto_return: "approved",
      statement_descriptor: "MOOVIMIENTO",
      locale: "es-AR",
      external_reference: JSON.stringify({
        orderId: savedOrderId,
        eligibleStamps, // Pasamos el cálculo al webhook
        deliveryOption,
        deliveryAddress,
        name,
        email,
        phone,
        discountCode: appliedDiscountCode,
        discountAmount: appliedDiscountAmount,
        timestamp: Date.now(),
      }),
      payer: {
        email: email,
      },
    };

    console.log("Preference data:", JSON.stringify(preferenceData, null, 2));

    const response = await preference.create({
      body: preferenceData,
    });

    console.log("Preference created:", response.id);
    
    // Actualizar la orden con el link de pago si ya la teníamos
    if (savedOrderId && response.init_point) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        await supabase
          .from("orders")
          .update({ payment_link: response.init_point })
          .eq("id", savedOrderId);
      } catch (e) {
        console.error("Error updating order with payment link:", e);
      }
    }

    // Enviar automáticamente el email con el link de pago (servidor-side)
    try {
      if (response.init_point) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        // Construir el body igual que lo hace el cliente cuando envía el email
        // Recalcular totales en el servidor (misma lógica usada arriba)
        const serverTotalMixQty = (items || []).reduce(
          (sum, it) => sum + (Number(it.quantity) || 0),
          0,
        );
        const serverTotalPrice = (preferenceData.items || []).reduce(
          (sum, it) => {
            const item = it as { unit_price?: number; quantity?: number };
            const up = Number(item.unit_price ?? 0) || 0;
            const q = Number(item.quantity ?? 0) || 0;
            return sum + up * q;
          },
          0,
        );

        // Create a pay token for the order and send that in the email; the /pay route will redirect to existing init_point or create a fresh preference
        let paymentToken: string | undefined = undefined;
        try {
          const { createPayToken } = await import("@/lib/payToken");
          if (savedOrderId) paymentToken = createPayToken(savedOrderId);
        } catch (err) {
          console.error("Error creating payment token:", err);
        }

        const emailBody = {
          orderId: savedOrderId,
          name,
          email,
          phone: phone ?? "",
          items: items,
          deliveryOption,
          deliveryAddress,
          totalPrice: serverTotalPrice,
          totalMixQty: serverTotalMixQty,
          paymentMethod: "mercadopago",
          paymentLink: response.init_point,
          paymentToken,
          discountCode: appliedDiscountCode,
          discountAmount: appliedDiscountAmount,
        };

        if (baseUrl) {
          const sendResp = await fetch(
            `${baseUrl.replace(/\/$/, "")}/api/send-order-email`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(emailBody),
            },
          );
          if (!sendResp.ok) {
            const text = await sendResp.text().catch(() => "no body");
            console.error(
              "server send-order-email failed:",
              sendResp.status,
              text,
            );
          }
        } else {
          console.warn(
            "NEXT_PUBLIC_BASE_URL not set; skipping server-side send-order-email",
          );
        }
      }
    } catch (err) {
      console.error("Error sending order email from checkout route:", err);
      // no throw: prefer no-break the checkout
    }

    return NextResponse.json({
      id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      totalAmount: totalWithDiscount,
      discountCode: appliedDiscountCode,
      discountAmount: appliedDiscountAmount,
    });
  } catch (error) {
    console.error("Error creating preference:", error);
    if (error && typeof error === "object" && "message" in error) {
      console.error("Error message:", error.message);
    }
    if (error && typeof error === "object" && "cause" in error) {
      console.error("Error cause:", error.cause);
    }
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error al crear la preferencia de pago";
    return NextResponse.json(
      { error: errorMessage, details: error },
      { status: 500 },
    );
  }
}
