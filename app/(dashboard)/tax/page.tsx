import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { TaxPage as TaxPageClient } from "@/components/tax/tax-page";
import { getExchangeRates, convertAmount, sumConverted } from "@/lib/currency";

export default async function TaxPage() {
  const session = await auth();
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, tax_regime")
    .eq("id", session!.user.id)
    .single();

  const year = new Date().getFullYear();
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Fetch paid invoices for revenue
  const { data: paidInvoices } = await supabase
    .from("invoices")
    .select("total, currency, issue_date")
    .eq("status", "paid")
    .gte("issue_date", startOfYear)
    .lte("issue_date", endOfYear);

  // Fetch deductible expenses
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, currency, date, is_tax_deductible")
    .gte("date", startOfYear)
    .lte("date", endOfYear);

  // Fetch saved tax estimates
  const { data: taxEstimates } = await supabase
    .from("tax_estimates")
    .select("*")
    .eq("year", year)
    .order("quarter");

  // Fetch exchange rates for currency conversion (base = PHP for tax purposes)
  const rates = await getExchangeRates("PHP");

  const grossRevenue = sumConverted(
    (paidInvoices ?? []).map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
    rates
  );
  const totalExpenses = sumConverted(
    (expenses ?? [])
      .filter((e) => e.is_tax_deductible)
      .map((exp) => ({ amount: exp.amount || 0, currency: exp.currency || "PHP" })),
    rates
  );

  // Group revenue by quarter
  const quarterlyRevenue = [0, 0, 0, 0];
  const quarterlyExpenses = [0, 0, 0, 0];

  paidInvoices?.forEach((inv) => {
    const month = new Date(inv.issue_date).getMonth();
    const q = Math.floor(month / 3);
    quarterlyRevenue[q] += convertAmount(inv.total || 0, inv.currency || "PHP", rates);
  });

  expenses?.forEach((exp) => {
    if (exp.is_tax_deductible) {
      const month = new Date(exp.date).getMonth();
      const q = Math.floor(month / 3);
      quarterlyExpenses[q] += convertAmount(exp.amount || 0, exp.currency || "PHP", rates);
    }
  });

  return (
    <>
      <Header title="Tax" userName={profile?.full_name} userEmail={session?.user?.email} />
      <div className="p-4 md:p-6">
        <TaxPageClient
          grossRevenue={grossRevenue}
          totalExpenses={totalExpenses}
          quarterlyRevenue={quarterlyRevenue}
          quarterlyExpenses={quarterlyExpenses}
          taxEstimates={taxEstimates ?? []}
          taxRegime={profile?.tax_regime ?? "eight_percent"}
          year={year}
          userId={session!.user.id}
        />
      </div>
    </>
  );
}
