import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  FileText,
  Clock,
  Receipt,
  TrendingUp,
  TrendingDown,
  FolderKanban,
  Inbox,
  Landmark,
  CreditCard,
  ArrowRightLeft,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { getExchangeRates, sumConverted, convertAmount } from "@/lib/currency";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { QuickActions } from "@/components/dashboard/quick-actions";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "overdue":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
          Overdue
        </Badge>
      );
    case "sent":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
          Sent
        </Badge>
      );
    case "viewed":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
          Viewed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const supabase = createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .split("T")[0];
  const startOfYear = new Date(now.getFullYear(), 0, 1)
    .toISOString()
    .split("T")[0];

  // Build last 6 months date ranges for chart
  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const start = d.toISOString().split("T")[0];
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    const label = d.toLocaleString("default", { month: "short" });
    return { start, end, label };
  });

  const [
    { data: paidInvoicesMonth },
    { data: paidInvoicesYear },
    { data: paidInvoicesPrevMonth },
    { data: outstandingInvoices },
    { data: expensesMonth },
    { data: expensesPrevMonth },
    { data: activeProjects },
    { data: chartRevenue },
    { data: chartExpenses },
    { data: activeAccountsData },
    { data: allActiveAccounts },
    { data: recentTransfers },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, currency")
      .eq("status", "paid")
      .gte("issue_date", startOfMonth),
    supabase
      .from("invoices")
      .select("total, currency")
      .eq("status", "paid")
      .gte("issue_date", startOfYear),
    supabase
      .from("invoices")
      .select("total, currency")
      .eq("status", "paid")
      .gte("issue_date", startOfPrevMonth)
      .lte("issue_date", endOfPrevMonth),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total, currency, due_date, status, client:clients(company_name)"
      )
      .in("status", ["sent", "viewed", "overdue"])
      .order("due_date", { ascending: true })
      .limit(5),
    supabase.from("expenses").select("amount, currency").gte("date", startOfMonth),
    supabase
      .from("expenses")
      .select("amount, currency")
      .gte("date", startOfPrevMonth)
      .lte("date", endOfPrevMonth),
    supabase
      .from("projects")
      .select("id, name, status, client:clients(company_name)")
      .eq("status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(5),
    // Chart data: revenue per month (last 6 months)
    supabase
      .from("invoices")
      .select("total, currency, issue_date")
      .eq("status", "paid")
      .gte("issue_date", monthRanges[0].start),
    // Chart data: expenses per month (last 6 months)
    supabase
      .from("expenses")
      .select("amount, currency, date")
      .gte("date", monthRanges[0].start),
    // Active accounts for dashboard widget
    supabase
      .from("accounts")
      .select("id, account_name, account_type, current_balance, currency")
      .eq("status", "active")
      .order("current_balance", { ascending: false })
      .limit(5),
    // All active accounts for net worth calculation + name lookup
    supabase
      .from("accounts")
      .select("id, account_name, account_type, current_balance, currency")
      .eq("status", "active"),
    // Recent transfers
    supabase
      .from("account_transfers")
      .select("id, amount, currency, note, transfer_date, from_account_id, to_account_id")
      .order("transfer_date", { ascending: false })
      .limit(5),
  ]);

  // Fetch exchange rates (base = PHP) for currency conversion
  const rates = await getExchangeRates("PHP");

  const revenueMonth = sumConverted(
    (paidInvoicesMonth ?? []).map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
    rates
  );
  const revenueYear = sumConverted(
    (paidInvoicesYear ?? []).map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
    rates
  );
  const revenuePrevMonth = sumConverted(
    (paidInvoicesPrevMonth ?? []).map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
    rates
  );
  const outstandingTotal = sumConverted(
    (outstandingInvoices ?? []).map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
    rates
  );
  const expensesTotal = sumConverted(
    (expensesMonth ?? []).map((exp) => ({ amount: exp.amount || 0, currency: exp.currency || "PHP" })),
    rates
  );
  const expensesPrevTotal = sumConverted(
    (expensesPrevMonth ?? []).map((exp) => ({ amount: exp.amount || 0, currency: exp.currency || "PHP" })),
    rates
  );

  // Calculate trend percentages
  const revenueTrend =
    revenuePrevMonth > 0
      ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100
      : revenueMonth > 0
        ? 100
        : 0;
  const expensesTrend =
    expensesPrevTotal > 0
      ? ((expensesTotal - expensesPrevTotal) / expensesPrevTotal) * 100
      : expensesTotal > 0
        ? 100
        : 0;

  // Build chart data (with currency conversion)
  const chartData = monthRanges.map(({ start, end, label }) => {
    const monthInvoices = chartRevenue?.filter((inv) => inv.issue_date >= start && inv.issue_date <= end) ?? [];
    const revenue = sumConverted(
      monthInvoices.map((inv) => ({ amount: inv.total || 0, currency: inv.currency || "PHP" })),
      rates
    );
    const monthExpenses = chartExpenses?.filter((exp) => exp.date >= start && exp.date <= end) ?? [];
    const expenses = sumConverted(
      monthExpenses.map((exp) => ({ amount: exp.amount || 0, currency: exp.currency || "PHP" })),
      rates
    );
    return { month: label, revenue, expenses };
  });

  // Net worth calculation (bank balances - credit card balances)
  const totalBankBalance = sumConverted(
    (allActiveAccounts ?? [])
      .filter((a) => a.account_type === "bank_account")
      .map((a) => ({ amount: a.current_balance || 0, currency: a.currency || "PHP" })),
    rates
  );
  const totalCreditOwed = sumConverted(
    (allActiveAccounts ?? [])
      .filter((a) => a.account_type === "credit_card")
      .map((a) => ({ amount: a.current_balance || 0, currency: a.currency || "PHP" })),
    rates
  );
  const netWorth = totalBankBalance - totalCreditOwed;

  // Build a map of account id -> name for transfer display
  const accountMap = new Map(
    (allActiveAccounts ?? []).map((a) => [a.id, a.account_name])
  );

  // Revenue vs expenses bar
  const netTotal = revenueMonth + expensesTotal;
  const revenuePercent = netTotal > 0 ? (revenueMonth / netTotal) * 100 : 50;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session!.user.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <Header
        title={`${getGreeting()}, ${firstName}`}
        userName={profile?.full_name}
        userEmail={session?.user?.email}
      />
      <div className="p-4 md:p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Revenue */}
          <Card className="gap-2 border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Revenue (Month)
              </CardTitle>
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-950">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(revenueMonth)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {revenueTrend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <p
                  className={`text-xs font-medium ${revenueTrend >= 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {revenueTrend >= 0 ? "+" : ""}
                  {revenueTrend.toFixed(1)}% from last month
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(revenueYear)} YTD
              </p>
            </CardContent>
          </Card>

          {/* Outstanding */}
          <Card className="gap-2 border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-950">
                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(outstandingTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {outstandingInvoices?.length ?? 0} unpaid invoice(s)
              </p>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="gap-2 border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Expenses (Month)
              </CardTitle>
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-950">
                <Receipt className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(expensesTotal)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {expensesTrend <= 0 ? (
                  <TrendingDown className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingUp className="h-3 w-3 text-red-500" />
                )}
                <p
                  className={`text-xs font-medium ${expensesTrend <= 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {expensesTrend >= 0 ? "+" : ""}
                  {expensesTrend.toFixed(1)}% from last month
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Net: {formatCurrency(revenueMonth - expensesTotal)}
              </p>
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card className="gap-2 border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Projects
              </CardTitle>
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {activeProjects?.length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>

          {/* Net Worth */}
          <Card className="gap-2 border-l-4 border-l-violet-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
              <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-950">
                <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${netWorth >= 0 ? "" : "text-red-500"}`}>
                {formatCurrency(netWorth)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Bank: {formatCurrency(totalBankBalance)} · CC: {formatCurrency(totalCreditOwed)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <QuickActions userId={session!.user.id} />

        {/* Revenue vs Expenses Bar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Revenue vs Expenses (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-sm">
                  Revenue: {formatCurrency(revenueMonth)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm">
                  Expenses: {formatCurrency(expensesTotal)}
                </span>
              </div>
            </div>
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex">
              {netTotal > 0 ? (
                <>
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${revenuePercent}%` }}
                  />
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${100 - revenuePercent}%` }}
                  />
                </>
              ) : (
                <div className="h-full bg-muted w-full" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Net profit:{" "}
              <span
                className={
                  revenueMonth - expensesTotal >= 0
                    ? "text-emerald-600 font-medium"
                    : "text-red-500 font-medium"
                }
              >
                {formatCurrency(revenueMonth - expensesTotal)}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Revenue & Expenses (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Active Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Active Projects</CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {activeProjects && activeProjects.length > 0 ? (
                <div className="space-y-3">
                  {activeProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950">
                          <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(
                              project.client as unknown as {
                                company_name: string;
                              } | null
                            )?.company_name ?? "No client"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <FolderKanban className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No active projects</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a project to start tracking your work
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outstanding Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Outstanding Invoices</CardTitle>
              <Link href="/invoices">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {outstandingInvoices && outstandingInvoices.length > 0 ? (
                <div className="space-y-3">
                  {outstandingInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {inv.invoice_number}
                          </p>
                          {getStatusBadge(inv.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {
                            (
                              inv.client as unknown as {
                                company_name: string;
                              } | null
                            )?.company_name
                          }
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(inv.total, inv.currency || "PHP")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No outstanding invoices at the moment
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Balances */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Account Balances</CardTitle>
              <Link href="/accounts">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {activeAccountsData && activeAccountsData.length > 0 ? (
                <div className="space-y-3">
                  {activeAccountsData.map((acc) => (
                    <Link
                      key={acc.id}
                      href={`/accounts/${acc.id}`}
                      className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          {acc.account_type === "credit_card" ? (
                            <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          {acc.account_name}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(acc.current_balance, acc.currency || "PHP")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Landmark className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No accounts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a bank account or credit card to track balances
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transfers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Transfers</CardTitle>
              <Link href="/accounts">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentTransfers && recentTransfers.length > 0 ? (
                <div className="space-y-3">
                  {recentTransfers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md p-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-950">
                          <ArrowRightLeft className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {accountMap.get(t.from_account_id) ?? "Deleted Account"}{" "}
                            <span className="text-muted-foreground">&rarr;</span>{" "}
                            {accountMap.get(t.to_account_id) ?? "Deleted Account"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.note || t.transfer_date}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(t.amount, t.currency || "PHP")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No transfers yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transfer funds between accounts to see history here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </>
  );
}
