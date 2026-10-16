import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/discount-codes";

type ValidateBody = {
  code?: string;
  subtotal?: number;
  email?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidateBody;
    const code = typeof body.code === "string" ? body.code : "";
    const subtotal = Number(body.subtotal ?? 0);
    const email = typeof body.email === "string" ? body.email : undefined;

    const result = await validateCoupon({ code, subtotal, email });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error validating coupon:", error);
    return NextResponse.json(
      { valid: false, code: "", discountAmount: 0, reason: "server_error" },
      { status: 500 },
    );
  }
}
