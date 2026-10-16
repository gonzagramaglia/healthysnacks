import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token no proporcionado" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: user, error: fetchError } = await supabase
      .from("customers")
      .select("id, username, is_verified")
      .eq("verification_token", token)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "Link de confirmación inválido o expirado." }, { status: 400 });
    }

    if (user.is_verified) {
      return NextResponse.redirect(new URL(`/u/${user.username}?verified=1`, request.url));
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        is_verified: true,
        verification_token: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error confirmando usuario:", updateError);
      return NextResponse.json({ error: "Error interno al confirmar tu usuario." }, { status: 500 });
    }

    // Redirect to their profile page showing success
    return NextResponse.redirect(new URL(`/u/${user.username}?verified=1`, request.url));

  } catch (err) {
    console.error("Error en endpoint confirmacion:", err);
    return NextResponse.json({ error: "Ocurrió un error inesperado." }, { status: 500 });
  }
}
