import { MainContent } from "@/components/MainContent";
import { CustomerPurchase } from "@/lib/customers";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export function generateStaticParams() {
  return [
    { customerName: "demo" },
    { customerName: "gonza" },
    { customerName: "cliente" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ customerName: string }>;
}): Promise<Metadata> {
  const { customerName } = await params;
  const targetId = customerName.toLowerCase();

  let name = targetId.charAt(0).toUpperCase() + targetId.slice(1);

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("username", targetId)
      .eq("is_verified", true)
      .maybeSingle();
    if (data?.name) {
      name = data.name;
    }
  } catch {
    // Ignore
  }

  return {
    title: `Beneficios de ${name} ⚡ | Moovimiento`,
    description: "Consultá tus beneficios y compras realizadas en Moovimiento.",
  };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerName: string }>;
}) {
  const { customerName } = await params;
  const targetId = customerName.toLowerCase();

  let customer: CustomerPurchase | null = null;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("customers")
      .select("id, name, username, is_verified, purchases_count, last_updated, purchase_dates")
      .eq("username", targetId)
      .maybeSingle();

    if (data && data.is_verified) {
      customer = {
        id: data.id,
        name: data.name,
        username: data.username,
        purchasesCount: data.purchases_count,
        lastUpdated: data.last_updated,
        isVerified: data.is_verified,
        purchaseDates: data.purchase_dates,
      };
    }
  } catch {
    // Ignore
  }

  // Fallback to demo/empty state
  if (!customer) {
    customer = {
      id: "demo",
      name:
        customerName.charAt(0).toUpperCase() +
        customerName.slice(1).toLowerCase(),
      username: targetId,
      purchasesCount: 7,
      lastUpdated: new Date().toISOString(),
    };
  }

  return (
    <MainContent lang="es" customerData={customer} benefitsMode="coupon" />
  );
}
