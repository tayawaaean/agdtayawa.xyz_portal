import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AccountTable } from "@/components/accounts/account-table";
import { NewAccountDialog } from "@/components/accounts/new-account-dialog";
import { getExchangeRates } from "@/lib/currency";

export default async function AccountsPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("account_name");

  const exchangeRates = await getExchangeRates("PHP");

  return (
    <>
      <Header
        title="Accounts"
        userName={profile?.full_name}
        userEmail={session?.user?.email}
      >
        <NewAccountDialog userId={session!.user.id} />
      </Header>
      <div className="p-4 md:p-6">
        <AccountTable
          accounts={accounts ?? []}
          userId={session!.user.id}
          exchangeRates={exchangeRates}
        />
      </div>
    </>
  );
}
