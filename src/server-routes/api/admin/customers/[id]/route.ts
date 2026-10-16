import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface UpdateBody {
  name?: string;
  email?: string;
  username?: string;
  purchases_count?: number;
  is_verified?: boolean;
  purchase_dates?: string[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const adminPass = request.headers.get("x-admin-password") || "";
    if (
      !process.env.ADMIN_PASSWORD ||
      adminPass !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) throw new Error("Missing ID in params");

    const body: UpdateBody = await request.json();
    const { name, email, username, purchases_count, is_verified, purchase_dates } = body;

    const supabase = createAdminClient();

    // 1. Get current state to detect difference in purchases
    const { data: oldData } = await supabase
      .from("customers")
      .select("purchases_count")
      .eq("id", id)
      .single();
    
    const oldCount = oldData?.purchases_count || 0;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = String(username).toLowerCase();
    
    let newCount = oldCount;
    if (purchases_count !== undefined) {
      const parsedCount = parseInt(String(purchases_count));
      newCount = isNaN(parsedCount) ? 0 : Math.max(0, parsedCount);
      updateData.purchases_count = newCount;
    }
    
    if (is_verified !== undefined) updateData.is_verified = is_verified;
    if (purchase_dates !== undefined) updateData.purchase_dates = purchase_dates;
    updateData.last_updated = new Date().toISOString();

    // 2. Perform the update
    const { data: customer, error: updateError } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Supabase Update Error:", updateError);
      return NextResponse.json({ 
        error: "Database Update Failed", 
        details: updateError.message,
        code: updateError.code
      }, { status: 500 });
    }

    // 3. Smart history recording: insert multiple records if diff > 0
    const diff = newCount - oldCount;
    if (diff > 0) {
      try {
        const historyRecords = [];
        const baseDate = new Date();
        for (let i = 0; i < diff; i++) {
          const currentPurchaseIndex = oldCount + i;
          const cardNumber = Math.floor(currentPurchaseIndex / 10) + 1;
          
          // Add 1 second offset to each so they are distinct timestamps
          const pDate = new Date(baseDate.getTime() + (i * 1000));
          
          historyRecords.push({
            customer_id: id,
            purchase_date: pDate.toISOString(),
            card_number: cardNumber
          });
        }
        
        if (historyRecords.length > 0) {
          await supabase.from("customer_loyalty_purchases").insert(historyRecords);
        }
      } catch (hErr) {
        console.error("Non-critical history error:", hErr);
      }
    }

    return NextResponse.json({ customer });
  } catch (err: unknown) {
    console.error("Critical PATCH Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: message
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminPass = request.headers.get("x-admin-password") || "";
    if (
      !process.env.ADMIN_PASSWORD ||
      adminPass !== process.env.ADMIN_PASSWORD
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createAdminClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error deleting customer:", err);
    return NextResponse.json(
      { error: "Error deleting customer" },
      { status: 500 },
    );
  }
}
