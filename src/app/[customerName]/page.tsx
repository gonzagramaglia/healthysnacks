import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [
    { customerName: "demo" },
    { customerName: "gonza" },
    { customerName: "cliente" },
  ];
}

export default async function LegacyCustomerPage({
  params,
}: {
  params: Promise<{ customerName: string }>;
}) {
  const { customerName } = await params;
  redirect(`/u/${customerName.toLowerCase()}`);
}
