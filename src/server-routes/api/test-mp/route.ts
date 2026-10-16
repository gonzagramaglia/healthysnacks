import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function GET() {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
    
    // Verificar si el token existe
    if (!accessToken) {
      return NextResponse.json({
        error: "No se encontró MERCADOPAGO_ACCESS_TOKEN",
      }, { status: 500 });
    }

    // Verificar si es token de prueba o producción
    const isTestToken = accessToken.startsWith("TEST-") || accessToken.includes("APP_USR");
    
    const client = new MercadoPagoConfig({
      accessToken: accessToken,
    });

    const preference = new Preference(client);

    // Crear una preferencia de prueba simple
    const response = await preference.create({
      body: {
        items: [
          {
            id: "test-item",
            title: "Test Item",
            quantity: 1,
            unit_price: 100,
            category_id: "general",
            description: "Preferencia de prueba - Test Item",
            currency_id: "ARS",
          },
        ],
        payer: {
          email: "test@test.com",
        },
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/failure`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/pending`,
        },
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`,
      },
    });

    return NextResponse.json({
      success: true,
      tokenType: isTestToken ? "Test/Sandbox" : "Production",
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
      message: "Preferencia de prueba creada exitosamente",
    });
  } catch (error) {
    console.error("Error en test:", error);
    return NextResponse.json({
      error: "Error al crear preferencia de prueba",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
