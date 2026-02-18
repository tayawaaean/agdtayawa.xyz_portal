"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, FileImage, Check, X, ChevronLeft, ChevronRight, Trash2, Pencil, Loader2, Wallet, TrendingUp, CalendarDays, Landmark, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { convertAmount } from "@/lib/currency";
import { CURRENCIES } from "@/lib/constants";
import { updateAccountBalance } from "@/lib/account-balance";
import type { Expense, AccountType } from "@/lib/types";

const PAGE_SIZE = 10;

interface AccountOption {
  id: string;
  account_name: string;
  account_type: AccountType;
  currency: string;
}

interface ExpenseTableProps {
  expenses: Expense[];
  categories: string[];
  exchangeRates: Record<string, number>;
  accounts?: AccountOption[];
}

export function ExpenseTable({ expenses: initialExpenses, categories, exchangeRates, accounts = [] }: ExpenseTableProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState("all");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCurrency, setEditCurrency] = useState("PHP");
  const [editDeductible, setEditDeductible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  // Realtime subscription for expenses table
  const userId = initialExpenses[0]?.user_id;
  useRealtime<Expense>({
    table: "expenses",
    ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
    onInsert: useCallback((record: Expense) => {
      setExpenses((prev) => {
        if (prev.some((e) => e.id === record.id)) return prev;
        return [record, ...prev];
      });
    }, []),
    onUpdate: useCallback((record: Expense) => {
      setExpenses((prev) =>
        prev.map((e) => (e.id === record.id ? { ...e, ...record } : e))
      );
    }, []),
    onDelete: useCallback((record: Expense) => {
      setExpenses((prev) => prev.filter((e) => e.id !== record.id));
    }, []),
  });

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();

    // Find the expense to check for linked account before deleting
    const expToDelete = expenses.find((e) => e.id === deleteId);

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete expense: " + error.message);
    } else {
      // Revert account balance if linked
      if (expToDelete?.account_id) {
        const acct = accounts.find((a) => a.id === expToDelete.account_id);
        if (acct) {
          await updateAccountBalance(
            supabase,
            acct.id,
            expToDelete.user_id,
            expToDelete.amount,
            acct.account_type,
            "remove",
            `Expense deleted: ${expToDelete.category}`
          );
        }
      }
      setExpenses((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Expense deleted");
    }
    setDeleteId(null);
  }

  function openEdit(exp: Expense) {
    setEditExpense(exp);
    setEditAmount(exp.amount.toString());
    setEditCurrency(exp.currency || "PHP");
    setEditDate(exp.date);
    setEditCategory(exp.category);
    setEditVendor(exp.vendor || "");
    setEditDescription(exp.description || "");
    setEditDeductible(exp.is_tax_deductible);
  }

  async function handleEdit() {
    if (!editExpense) return;
    const amount = Number(editAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .update({
        amount: Math.round(amount * 100) / 100,
        currency: editCurrency,
        date: editDate,
        category: editCategory,
        vendor: editVendor || null,
        description: editDescription || null,
        is_tax_deductible: editDeductible,
      })
      .eq("id", editExpense.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      // If linked to an account and amount changed, apply the delta
      const delta = Math.round((amount - editExpense.amount) * 100) / 100;
      if (editExpense.account_id && delta !== 0) {
        const acct = accounts.find((a) => a.id === editExpense.account_id);
        if (acct) {
          await updateAccountBalance(
            supabase,
            acct.id,
            editExpense.user_id,
            Math.abs(delta),
            acct.account_type,
            delta > 0 ? "add" : "remove",
            `Expense edited: ${editCategory}`
          );
        }
      }
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === editExpense.id
            ? {
                ...e,
                amount,
                currency: editCurrency,
                date: editDate,
                category: editCategory,
                vendor: editVendor || null,
                description: editDescription || null,
                is_tax_deductible: editDeductible,
              }
            : e
        )
      );
      toast.success("Expense updated");
      setEditExpense(null);
    }
    setSaving(false);
  }

  function getDateFrom(range: string): string {
    const now = new Date();
    if (range === "this_month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    if (range === "last_month") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (range === "this_quarter") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return `${now.getFullYear()}-${String(q + 1).padStart(2, "0")}-01`;
    }
    if (range === "this_year") return `${now.getFullYear()}-01-01`;
    return "";
  }

  function getDateTo(range: string): string {
    const now = new Date();
    if (range === "last_month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 0);
      return d.toISOString().split("T")[0];
    }
    return "";
  }

  const filtered = expenses.filter((exp) => {
    const matchesSearch =
      (exp.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (exp.vendor?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCategory =
      categoryFilter === "all" || exp.category === categoryFilter;
    const from = getDateFrom(dateRange);
    const to = getDateTo(dateRange);
    const matchesFrom = !from || exp.date >= from;
    const matchesTo = !to || exp.date <= to;
    return matchesSearch && matchesCategory && matchesFrom && matchesTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedExpenses = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const monthTotal = filtered.reduce(
    (sum, exp) => sum + convertAmount(exp.amount, exp.currency || "PHP", exchangeRates), 0
  );

  // Group totals and counts by category (converted to base currency)
  const categoryData = filtered.reduce<Record<string, { total: number; count: number }>>((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = { total: 0, count: 0 };
    acc[exp.category].total += convertAmount(exp.amount, exp.currency || "PHP", exchangeRates);
    acc[exp.category].count += 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryData)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 3);

  const categoryColors = [
    { bg: "bg-blue-500", light: "bg-blue-50 text-blue-700", icon: "text-blue-500" },
    { bg: "bg-amber-500", light: "bg-amber-50 text-amber-700", icon: "text-amber-500" },
    { bg: "bg-violet-500", light: "bg-violet-50 text-violet-700", icon: "text-violet-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="rounded-lg bg-red-50 p-2">
              <Wallet className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(monthTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtered.length} expense{filtered.length !== 1 ? "s" : ""} total</p>
          </CardContent>
        </Card>
        {topCategories.map(([cat, data], i) => {
          const colors = categoryColors[i];
          const pct = monthTotal > 0 ? Math.round((data.total / monthTotal) * 100) : 0;
          return (
            <Card key={cat} className="relative overflow-hidden gap-2 py-4">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.bg}`} />
              <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-sm font-medium text-muted-foreground truncate">{cat}</CardTitle>
                <div className={`rounded-lg p-2 ${colors.light.split(" ")[0]}`}>
                  <TrendingUp className={`h-4 w-4 ${colors.icon}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data.total)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${colors.bg}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">{pct}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{data.count} item{data.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {expenses.length === 0
              ? "No expenses yet. Log your first business expense!"
              : "No expenses match your filters."}
          </p>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Vendor</TableHead>
                <TableHead className="text-right w-[100px]">Amount</TableHead>
                <TableHead className="w-[60px] text-center">Receipt</TableHead>
                <TableHead className="w-[80px] hidden sm:table-cell text-center">
                  Deductible
                </TableHead>
                <TableHead className="w-[40px] hidden md:table-cell text-center">
                  Account
                </TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedExpenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(exp.date)}
                  </TableCell>
                  <TableCell>{exp.description || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">{exp.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {exp.vendor || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(exp.amount, exp.currency || "PHP")}
                  </TableCell>
                  <TableCell className="text-center">
                    {exp.receipt_url && (
                      <button
                        onClick={() => setReceiptUrl(exp.receipt_url)}
                        className="text-muted-foreground hover:text-foreground inline-flex"
                      >
                        <FileImage className="h-4 w-4" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-center">
                    {exp.is_tax_deductible ? (
                      <Check className="h-4 w-4 text-green-600 inline-block" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground inline-block" />
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    {exp.account_id && (() => {
                      const acct = accounts.find((a) => a.id === exp.account_id);
                      if (!acct) return null;
                      return (
                        <span title={acct.account_name}>
                          {acct.account_type === "credit_card" ? (
                            <CreditCard className="h-4 w-4 text-muted-foreground inline-block" />
                          ) : (
                            <Landmark className="h-4 w-4 text-muted-foreground inline-block" />
                          )}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(exp)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the details for this expense.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={editCurrency} onValueChange={setEditCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input value={editVendor} onChange={(e) => setEditVendor(e.target.value)} placeholder="Vendor name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="What was this expense for?" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-deductible"
                checked={editDeductible}
                onChange={(e) => setEditDeductible(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-deductible" className="text-sm font-normal">Tax Deductible</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer */}
      <Dialog open={!!receiptUrl} onOpenChange={() => setReceiptUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptUrl && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl}
                alt="Receipt"
                className="max-h-[70vh] object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
