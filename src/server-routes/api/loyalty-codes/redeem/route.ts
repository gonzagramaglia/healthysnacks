import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { code, customerId } = await request.json();

    if (!code || !customerId) {
      return NextResponse.json({ error: "Missing code or customerId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Check if the code exists and is not used
    const { data: loyaltyCode, error: codeError } = await supabase
      .from("loyalty_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (codeError || !loyaltyCode) {
      return NextResponse.json({ error: "Código inválido o no encontrado" }, { status: 404 });
    }

    if (loyaltyCode.is_used) {
      return NextResponse.json({ error: "Este código ya fue utilizado" }, { status: 400 });
    }

    // 2. Mark code as used
    const { error: updateCodeError } = await supabase
      .from("loyalty_codes")
      .update({
        is_used: true,
        used_by_customer_id: customerId,
        used_at: new Date().toISOString(),
      })
      .eq("id", loyaltyCode.id);

    if (updateCodeError) {
      return NextResponse.json({ error: "Error al procesar el código" }, { status: 500 });
    }

    // 3. Add entries to customer_loyalty_purchases
    const entries = [];
    for (let i = 0; i < loyaltyCode.steps; i++) {
      entries.push({
        customer_id: customerId,
        purchase_date: new Date().toISOString(),
      });
    }

    const { error: insertError } = await supabase
      .from("customer_loyalty_purchases")
      .insert(entries);

    if (insertError) {
      console.error("Error inserting loyalty purchases:", insertError);
    }

    // 4. Update customers.purchases_count
    const { data: customer } = await supabase
      .from("customers")
      .select("purchases_count")
      .eq("id", customerId)
      .single();

    if (customer) {
      await supabase
        .from("customers")
        .update({
          purchases_count: customer.purchases_count + loyaltyCode.steps,
          last_updated: new Date().toISOString(),
        })
        .eq("id", customerId);
    }

    return NextResponse.json({ 
      success: true, 
      stepsAdded: loyaltyCode.steps 
    });

  } catch (err) {
    console.error("Redeem error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
