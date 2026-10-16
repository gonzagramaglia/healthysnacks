import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface ConfirmationBody {
  name?: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  deliveryOption: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ConfirmationBody;
    const { name, email, phone, deliveryAddress, deliveryOption } = body;

    const resend = new Resend(process.env.RESEND_API_KEY);

    const deliveryText = deliveryOption === "ciudad"
      ? "Ciudad Universitaria (Envío gratuito)"
      : "Córdoba";

    const whatsappLink = `https://wa.me/5493513239624?text=${encodeURIComponent(`Hola! Soy ${name || 'un cliente'}, acabo de confirmar mi pago y quiero coordinar la entrega.`)}`;

    const emailSubject = `✅ ¡Pago confirmado ${name}! Ya nos ponemos en contacto`;

    await resend.emails.send({
      from: "Gonza de Moovimiento <gonzagramaglia@gmail.com>",
      to: email,
      bcc: ["gonzagramaglia@gmail.com"],
      subject: emailSubject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .success-box { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px; }
              .whatsapp-btn { display: inline-block; background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0; }
              .whatsapp-btn:hover { background-color: #059669; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0; color: white; font-size: 20px; text-align: left;">⚡ Moovimiento</h2>
              </div>
              <div class="content">
                <h1 style="font-size: 28px; color: #10b981;">✅ ¡Pago confirmado!</h1>
                <p style="font-size: 18px;">¡Hola${name ? ` ${name}` : ''}! 🤝</p>
                
                <div class="success-box">
                  <p style="margin: 0; font-size: 16px;">
                    <strong>Tu pago fue procesado exitosamente.</strong><br>
                    Ya estamos preparando tu pedido de Frutos Secos personalizados.
                  </p>
                </div>

                <h3>Próximos pasos:</h3>
                <p>
                  Nos vamos a poner en contacto por el celular <strong>${phone}</strong> que proporcionaste para coordinar la entrega.
                </p>

                <h3>Información de entrega:</h3>
                <p><strong>Delivery en:</strong> ${deliveryText}</p>
                <p><strong>Dirección:</strong> ${deliveryAddress}</p>
                <p><strong>Celular de contacto:</strong> ${phone}</p>

                <div style="text-align: center; margin: 30px 0;">
                  <p style="margin-bottom: 12px; font-size: 16px;">
                    <strong>¿Querés tomar la iniciativa?</strong><br>
                    Hablanos directamente por WhatsApp:
                  </p>
                  <a href="${whatsappLink}" class="whatsapp-btn" style="display:inline-flex; align-items:center; gap:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path fill="#ffffff" d="M20.52 3.48A11.86 11.86 0 0012 .99 11.96 11.96 0 00.99 12c0 2.11.55 4.09 1.51 5.82L.01 24l6.36-1.68A11.93 11.93 0 0012 23.01c6.63 0 11.99-5.36 11.99-11.99 0-3.2-1.25-6.2-3.48-8.54zM12 21.28c-1.35 0-2.68-.36-3.84-1.03l-.27-.16-3.8 1.01 1.02-3.7-.18-.3A9.17 9.17 0 012.79 12 9.21 9.21 0 1112 21.28zM17.18 14.37c-.29-.14-1.7-.84-1.96-.94-.27-.1-.45-.15-.64.16-.19.31-.73 1.02-.89 1.22-.16.2-.32.22-.59.08-.27-.14-1.15-.44-2.19-1.38-.81-.72-1.36-1.61-1.51-1.88-.15-.27-.02-.41.12-.58.11-.12.24-.32.36-.48.11-.16.15-.27.23-.45.07-.18.04-.34-.02-.48-.06-.14-.56-1.54-.77-2.1-.2-.54-.4-.47-.55-.48-.14-.01-.29-.01-.45-.01-.16 0-.42.06-.64.36-.22.3-.84 1.02-.84 2.48 0 1.44.93 2.83 1.06 3.03.13.21 1.85 2.95 4.49 4.14.63.27 1.12.44 1.5.56.57.18 1.09.16 1.5.09.46-.07 1.42-.57 1.62-1.12.2-.55.2-1.03.14-1.12-.07-.1-.24-.16-.47-.28z"/>
                    </svg>
                    Coordinar ahora por WhatsApp
                  </a>
                </div>

                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                  ¿Tenés alguna duda? Escribinos a <a href="mailto:gonzagramaglia@gmail.com">gonzagramaglia@gmail.com</a> o visitá nuestras <a href="https://www.moovimiento.com/#faq">Preguntas Frecuentes</a>
                </p>

                <p style="margin-top: 20px; font-size: 14px; color: #666;">
                  ¡Gracias por confiar en nosotros! ⚡<br>
                  Gonza
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return NextResponse.json(
      { error: "Error al enviar el email de confirmación" },
      { status: 500 }
    );
  }
}
