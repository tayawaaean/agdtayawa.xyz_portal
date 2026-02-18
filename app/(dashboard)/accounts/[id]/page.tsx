import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AccountDetail } from "@/components/accounts/account-detail";
import { notFound } from "next/navigation";

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const supabase = createClient();

  const [{ data: profile }, { data: account }, { data: balanceHistory }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session!.user.id)
        .single(),
      supabase.from("accounts").select("*").eq("id", id).single(),
      supabase
        .from("account_balance_history")
        .select("*")
        .eq("account_id", id)
        .order("balance_date", { ascending: false })
        .limit(100),
    ]);

  if (!account) {
    notFound();
  }

  return (
    <>
      <Header
        title={account.account_name}
        userName={profile?.full_name}
        userEmail={session?.user?.email}
      />
      <div className="p-4 md:p-6">
        <AccountDetail
          account={account}
          balanceHistory={balanceHistory ?? []}
          userId={session!.user.id}
        />
      </div>
    </>
  );
}
