"use client";

interface DemoOrder {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  delivery_option: string;
  delivery_address: string;
  total_price: number;
  payment_method: string;
  payment_status: "approved" | "pending" | "delivered";
  items_summary: string;
}

const INITIAL_DEMO_ORDERS: DemoOrder[] = [
  {
    id: "ord-101",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    name: "Gonzalo Gramaglia",
    email: "gonza@example.com",
    phone: "3511234567",
    delivery_option: "ciudad",
    delivery_address: "Pabellón Argentina, UNC",
    total_price: 6500,
    payment_method: "mercadopago",
    payment_status: "approved",
    items_summary: "1x Mix Personalizado (Nueces, Almendras, Castañas, Arándanos)",
  },
  {
    id: "ord-102",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    name: "Lucía Fernández",
    email: "lucia@example.com",
    phone: "3517654321",
    delivery_option: "envio",
    delivery_address: "Nueva Córdoba, Obispo Trejo 1200",
    total_price: 7500,
    payment_method: "efectivo",
    payment_status: "delivered",
    items_summary: "1x Mix Energía (Almendras, Pasas, Maní, Semillas de Zapallo)",
  },
];

function getStoredOrders(): DemoOrder[] {
  if (typeof window === "undefined") return INITIAL_DEMO_ORDERS;
  try {
    const raw = localStorage.getItem("moovimiento_demo_orders");
    if (!raw) {
      localStorage.setItem("moovimiento_demo_orders", JSON.stringify(INITIAL_DEMO_ORDERS));
      return INITIAL_DEMO_ORDERS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_ORDERS;
  }
}

function saveStoredOrders(orders: DemoOrder[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("moovimiento_demo_orders", JSON.stringify(orders));
  } catch {
    // Ignore
  }
}

export function setupMockApi() {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __MOCK_API_INITIALIZED__?: boolean }).__MOCK_API_INITIALIZED__) return;
  (window as unknown as { __MOCK_API_INITIALIZED__?: boolean }).__MOCK_API_INITIALIZED__ = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (rawUrl.includes("/api/")) {
      const parsedUrl = new URL(rawUrl, window.location.origin);
      // Strip repo basePath if present (e.g. /snack-builder/api/... -> /api/...)
      const apiPath = parsedUrl.pathname.replace(/^(\/[^/]+)?(?=\/api\/)/, "");
      const method = (init?.method || "GET").toUpperCase();

      let body: Record<string, unknown> = {};
      if (init?.body && typeof init.body === "string") {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = {};
        }
      }

      // 1. Coupon validation
      if (apiPath === "/api/discount-codes/validate" && method === "POST") {
        const code = String(body.code || "").trim().toUpperCase();
        const coupons: Record<string, { type: "percentage" | "fixed"; value: number }> = {
          OFF10: { type: "percentage", value: 10 },
          OFF20: { type: "percentage", value: 20 },
          MOOVIMIENTO: { type: "percentage", value: 15 },
          PROMO10: { type: "percentage", value: 10 },
          BIENVENIDA: { type: "fixed", value: 1500 },
        };

        if (coupons[code]) {
          return new Response(
            JSON.stringify({
              valid: true,
              code,
              coupon: {
                type: coupons[code].type,
                value: coupons[code].value,
                maxDiscount: null,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ valid: false, error: "Cupón no válido. Probá con OFF10 o MOOVIMIENTO" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // 2. Checkout preference creation (Mercado Pago simulation)
      if (apiPath === "/api/checkout" && method === "POST") {
        const orders = getStoredOrders();
        const newOrder: DemoOrder = {
          id: `ord-${Date.now().toString().slice(-4)}`,
          created_at: new Date().toISOString(),
          name: String(body.name || "Cliente Demo"),
          email: String(body.email || "demo@example.com"),
          phone: String(body.phone || ""),
          delivery_option: String(body.deliveryOption || "ciudad"),
          delivery_address: String(body.deliveryAddress || "Ciudad Universitaria"),
          total_price: Array.isArray(body.items)
            ? (body.items as Array<{ unit_price?: number; quantity?: number }>).reduce(
                (sum, it) => sum + (it.unit_price || 0) * (it.quantity || 1),
                0
              )
            : 6500,
          payment_method: "mercadopago",
          payment_status: "approved",
          items_summary: "Mix personalizado (Demo)",
        };
        orders.unshift(newOrder);
        saveStoredOrders(orders);

        // Store checkout info for success page
        localStorage.setItem("moovimiento_name", newOrder.name);
        localStorage.setItem("moovimiento_email", newOrder.email);
        localStorage.setItem("moovimiento_phone", newOrder.phone);
        localStorage.setItem("moovimiento_deliveryAddress", newOrder.delivery_address);
        localStorage.setItem("moovimiento_deliveryOption", newOrder.delivery_option);

        const currentBase = window.location.pathname.startsWith("/healthysnacks")
          ? "/healthysnacks"
          : window.location.pathname.startsWith("/snack-builder")
          ? "/snack-builder"
          : "";
        return new Response(
          JSON.stringify({
            init_point: `${window.location.origin}${currentBase}/checkout/success/`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 3. Send order email (Cash / Bank transfer checkout)
      if (apiPath === "/api/send-order-email" && method === "POST") {
        const orders = getStoredOrders();
        const newOrder: DemoOrder = {
          id: `ord-${Date.now().toString().slice(-4)}`,
          created_at: new Date().toISOString(),
          name: String(body.name || "Cliente Demo"),
          email: String(body.email || "demo@example.com"),
          phone: String(body.phone || ""),
          delivery_option: String(body.deliveryOption || "ciudad"),
          delivery_address: String(body.deliveryAddress || "Ciudad Universitaria"),
          total_price: Number(body.totalPrice || 6500),
          payment_method: String(body.paymentMethod || "efectivo"),
          payment_status: "pending",
          items_summary: "Mix personalizado (Demo)",
        };
        orders.unshift(newOrder);
        saveStoredOrders(orders);

        return new Response(
          JSON.stringify({ success: true, message: "Pedido confirmado en modo demo" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 4. Payment confirmation email
      if (apiPath === "/api/send-payment-confirmation" && method === "POST") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 5. Loyalty code redemption
      if (apiPath === "/api/loyalty-codes/redeem" && method === "POST") {
        return new Response(JSON.stringify({ success: true, stepsAdded: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 6. Admin orders
      if (apiPath === "/api/admin/orders") {
        const orders = getStoredOrders();
        return new Response(JSON.stringify({ orders }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 7. Admin customers
      if (apiPath.startsWith("/api/admin/customers")) {
        const mockCustomers = [
          {
            id: "1",
            name: "Gonzalo Gramaglia",
            username: "gonza",
            email: "gonza@example.com",
            phone: "3511234567",
            is_verified: true,
            purchases_count: 8,
            last_updated: new Date().toISOString(),
            purchase_dates: [new Date().toISOString()],
          },
          {
            id: "2",
            name: "Cliente Demo",
            username: "demo",
            email: "demo@example.com",
            phone: "3519876543",
            is_verified: true,
            purchases_count: 3,
            last_updated: new Date().toISOString(),
            purchase_dates: [new Date().toISOString()],
          },
        ];
        return new Response(JSON.stringify({ customers: mockCustomers }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 8. Admin discount codes
      if (apiPath.startsWith("/api/admin/discount-codes")) {
        const mockCodes = [
          { id: "1", code: "OFF10", type: "percentage", value: 10, is_active: true },
          { id: "2", code: "OFF20", type: "percentage", value: 20, is_active: true },
          { id: "3", code: "MOOVIMIENTO", type: "percentage", value: 15, is_active: true },
          { id: "4", code: "BIENVENIDA", type: "fixed", value: 1500, is_active: true },
        ];
        return new Response(JSON.stringify({ discountCodes: mockCodes }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 9. Admin loyalty codes
      if (apiPath.startsWith("/api/admin/loyalty-codes")) {
        const mockLoyalty = [
          { id: "1", code: "GIFT-7871", is_redeemed: false, created_at: new Date().toISOString() },
          { id: "2", code: "MOOV-STEP-5", is_redeemed: false, created_at: new Date().toISOString() },
        ];
        return new Response(JSON.stringify({ loyaltyCodes: mockLoyalty }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fallback for any other /api route: return a clean 200 success
      return new Response(JSON.stringify({ success: true, mode: "demo_static" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch.apply(window, [input, init]);
  };
}
