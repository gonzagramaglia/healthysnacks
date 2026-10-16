import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";

export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("loyalty_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    if (!await isAdmin()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { steps = 1, amount = 1 } = await request.json();
    const supabase = createAdminClient();
    
    const codes = [];
    const { randomBytes } = await import("node:crypto");

    for (let i = 0; i < amount; i++) {
      const code = randomBytes(4).toString("hex").toUpperCase();
      codes.push({
        code,
        steps,
        is_used: false,
      });
    }

    const { data, error } = await supabase.from("loyalty_codes").insert(codes).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
