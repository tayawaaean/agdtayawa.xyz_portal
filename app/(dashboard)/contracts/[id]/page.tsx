import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ContractDetail } from "@/components/contracts/contract-detail";
import { notFound } from "next/navigation";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const supabase = createClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, client:clients(id, company_name)")
    .eq("id", id)
    .single();

  if (!contract) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name")
    .eq("status", "active")
    .order("company_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, client:clients(company_name)")
    .eq("contract_id", id)
    .order("issue_date", { ascending: false });

  return (
    <>
      <Header
        title={contract.name}
        userName={profile?.full_name}
        userEmail={session?.user?.email}
      />
      <div className="p-4 md:p-6">
        <ContractDetail
          contract={contract}
          clients={clients ?? []}
          invoices={invoices ?? []}
          userId={session!.user.id}
        />
      </div>
    </>
  );
}
