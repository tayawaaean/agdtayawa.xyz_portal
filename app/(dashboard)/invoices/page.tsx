import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";

export default async function InvoicesPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, client:clients(company_name), project:projects(name), milestone:project_milestones(name), contract:contracts(name)")
    .order("issue_date", { ascending: false });

  return (
    <>
      <Header title="Invoices" userName={profile?.full_name} userEmail={session?.user?.email}>
        <NewInvoiceDialog userId={session!.user.id} />
      </Header>
      <div className="p-4 md:p-6">
        <InvoiceTable invoices={invoices ?? []} />
      </div>
    </>
  );
}
