import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ContractTable } from "@/components/contracts/contract-table";
import { NewContractDialog } from "@/components/contracts/new-contract-dialog";

export default async function ContractsPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*, client:clients(id, company_name)")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  return (
    <>
      <Header title="Contracts" userName={profile?.full_name} userEmail={session?.user?.email}>
        <NewContractDialog userId={session!.user.id} />
      </Header>
      <div className="p-4 md:p-6">
        <ContractTable
          contracts={contracts ?? []}
          userId={session!.user.id}
        />
      </div>
    </>
  );
}
