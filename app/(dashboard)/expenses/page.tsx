import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { NewExpenseDialog } from "@/components/expenses/new-expense-dialog";
import { ImportDialog } from "@/components/import/import-dialog";
import { expenseImportConfig } from "@/lib/import/configs/expenses";
import { getExchangeRates } from "@/lib/currency";

export default async function ExpensesPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  const { data: categories } = await supabase
    .from("expense_categories")
    .select("name")
    .eq("user_id", session!.user.id);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("status", ["not_started", "in_progress"])
    .order("name");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, account_name, account_type, currency")
    .eq("user_id", session!.user.id)
    .eq("status", "active")
    .order("account_name");

  const exchangeRates = await getExchangeRates("PHP");

  return (
    <>
      <Header title="Expenses" userName={profile?.full_name} userEmail={session?.user?.email}>
        <ImportDialog
          config={expenseImportConfig}
          userId={session!.user.id}
          fkData={[
            {
              tableName: "expense_categories",
              entries: (categories ?? []).map((c) => ({
                display: c.name,
                id: c.name,
              })),
            },
            {
              tableName: "projects",
              entries: (projects ?? []).map((p) => ({
                display: p.name,
                id: p.id,
              })),
            },
          ]}
        />
        <NewExpenseDialog userId={session!.user.id} />
      </Header>
      <div className="p-4 md:p-6">
        <ExpenseTable
          expenses={expenses ?? []}
          categories={categories?.map((c) => c.name) ?? []}
          exchangeRates={exchangeRates}
          accounts={accounts ?? []}
        />
      </div>
    </>
  );
}
