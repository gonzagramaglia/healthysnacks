import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const payload = {
      code: String(body.code || "")
        .trim()
        .toUpperCase(),
      type: body.type,
      value: Number(body.value || 0),
      max_discount:
        body.max_discount === null || body.max_discount === undefined
          ? null
          : Number(body.max_discount),
      min_subtotal:
        body.min_subtotal === null || body.min_subtotal === undefined
          ? null
          : Number(body.min_subtotal),
      active: Boolean(body.active),
      usage_limit:
        body.usage_limit === null || body.usage_limit === undefined
          ? null
          : Number(body.usage_limit),
      allowed_email: body.allowed_email
        ? String(body.allowed_email).trim()
        : null,
    };

    const { data, error } = await supabase
      .from("discount_codes")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ coupon: data });
  } catch (err) {
    console.error("Error updating coupon:", err);
    return NextResponse.json(
      { error: "Error updating coupon" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase.from("discount_codes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting coupon:", err);
    return NextResponse.json(
      { error: "Error deleting coupon" },
      { status: 500 },
    );
  }
}
