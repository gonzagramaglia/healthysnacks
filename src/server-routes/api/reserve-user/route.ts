import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildGenericEmailHtml } from "@/lib/emailTemplates";

export async function POST(request: NextRequest) {
  try {
    const { name, username, email } = await request.json();

    if (!name?.trim() || !username?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const supabase = createAdminClient();

    // Check if user already exists

    const { data: existingUser, error: queryError } = await supabase
      .from("customers")
      .select("id, is_verified")
      .or(`username.eq.${cleanUsername},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (queryError) {
      console.error("Supabase query error:", queryError);
      return NextResponse.json(
        { error: "El usuario y/o email ya están en uso por separado." },
        { status: 400 }
      );
    }

    if (existingUser && existingUser.is_verified) {
      return NextResponse.json(
        { error: "El usuario o email ya se encuentra registrado y verificado." },
        { status: 400 }
      );
    }

    const { randomUUID } = await import("node:crypto");
    const verificationToken = randomUUID();

    if (existingUser && !existingUser.is_verified) {
      // Update existing unverified record
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          name: name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          verification_token: verificationToken,
          last_updated: new Date().toISOString(),
        })
        .eq("id", existingUser.id);

      if (updateError) {
        console.error("Error updating customer:", updateError);
        return NextResponse.json({ error: "DB Error (update): " + updateError.message }, { status: 500 });
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from("customers")
        .insert({
          name: name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          is_verified: false,
          verification_token: verificationToken,
          purchases_count: 0,
        });

      if (insertError) {
        console.error("Error inserting customer:", insertError);
        return NextResponse.json({ error: "DB Error (insert): " + insertError.message }, { status: 500 });
      }
    }

    // Send email via Resend
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY no está configurada");
      return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://moovimiento.com";
    const confirmUrl = `${baseUrl}/api/users/confirm?token=${verificationToken}`;

    const contentHtml = `
      <h3 style="margin-top:0;">¡Ya casi sos parte! 🎉</h3>
      <p>Estás a un paso de reservar tu usuario <strong>@${cleanUsername}</strong>.</p>
      <p>Hacé click en el siguiente botón para confirmar que este es tu mail y activar tu usuario:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" style="display:inline-block; height:48px; line-height:48px; background-color:#fbbf24; color:#000; padding:0 24px; text-decoration:none; border-radius:8px; font-weight:700; font-size:16px;">
          Confirmar mi mail
        </a>
      </div>
      <p style="font-size: 13px; color: #666;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br><br>${confirmUrl}</p>
    `;

    const html = buildGenericEmailHtml({
      title: "Confirma tu mail ⚡",
      name: name.trim(),
      contentHtml
    });

    await resend.emails.send({
      from: "Moovimiento <hola@moovimiento.com>",
      to: cleanEmail,
      subject: "Confirma tu reserva de usuario",
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in reserve-user api:", error);
    return NextResponse.json(
      { error: "Hubo un error: Por favor intente nuevamente más tarde" },
      { status: 500 }
    );
  }
}
