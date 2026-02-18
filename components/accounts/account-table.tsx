"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Landmark,
  CreditCard,
  Wallet,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { convertAmount } from "@/lib/currency";
import { ACCOUNT_STATUSES, CURRENCIES } from "@/lib/constants";
import { STATUS_COLORS } from "@/lib/constants";
import type { Account } from "@/lib/types";

const PAGE_SIZE = 10;

interface AccountTableProps {
  accounts: Account[];
  userId: string;
  exchangeRates: Record<string, number>;
}

export function AccountTable({
  accounts: initialAccounts,
  userId,
  exchangeRates,
}: AccountTableProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [balanceAccount, setBalanceAccount] = useState<Account | null>(null);
  const [page, setPage] = useState(0);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Balance update state
  const [newBalance, setNewBalance] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [updatingBalance, setUpdatingBalance] = useState(false);

  // Transfer state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [transferring, setTransferring] = useState(false);

  // Realtime subscription
  useRealtime<Account>({
    table: "accounts",
    filter: `user_id=eq.${userId}`,
    onInsert: useCallback((record: Account) => {
      setAccounts((prev) => {
        if (prev.some((a) => a.id === record.id)) return prev;
        return [record, ...prev];
      });
    }, []),
    onUpdate: useCallback((record: Account) => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === record.id ? { ...a, ...record } : a))
      );
    }, []),
    onDelete: useCallback((record: Account) => {
      setAccounts((prev) => prev.filter((a) => a.id !== record.id));
    }, []),
  });

  // Filter
  const filtered = accounts.filter((acc) => {
    if (typeFilter === "all") return true;
    return acc.account_type === typeFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Summary calculations
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const totalBankBalance = activeAccounts
    .filter((a) => a.account_type === "bank_account")
    .reduce(
      (sum, a) =>
        sum + convertAmount(a.current_balance, a.currency || "PHP", exchangeRates),
      0
    );
  const totalCreditUsed = activeAccounts
    .filter((a) => a.account_type === "credit_card")
    .reduce(
      (sum, a) =>
        sum + convertAmount(a.current_balance, a.currency || "PHP", exchangeRates),
      0
    );

  // Delete handler
  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete account: " + error.message);
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== deleteId));
      toast.success("Account deleted");
    }
    setDeleteId(null);
  }

  // Edit handlers
  function openEdit(acc: Account) {
    setEditAccount(acc);
    setEditName(acc.account_name);
    setEditInstitution(acc.institution_name || "");
    setEditStatus(acc.status);
    setEditCreditLimit(acc.credit_limit?.toString() || "");
    setEditNotes(acc.notes || "");
  }

  async function handleEdit() {
    if (!editAccount) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .update({
        account_name: editName,
        institution_name: editInstitution || null,
        status: editStatus,
        credit_limit:
          editAccount.account_type === "credit_card" && editCreditLimit
            ? Number(editCreditLimit)
            : null,
        notes: editNotes || null,
      })
      .eq("id", editAccount.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editAccount.id
            ? {
                ...a,
                account_name: editName,
                institution_name: editInstitution || null,
                status: editStatus as Account["status"],
                credit_limit:
                  editAccount.account_type === "credit_card" && editCreditLimit
                    ? Number(editCreditLimit)
                    : null,
                notes: editNotes || null,
              }
            : a
        )
      );
      toast.success("Account updated");
      setEditAccount(null);
    }
    setSaving(false);
  }

  // Balance update handlers
  function openBalanceUpdate(acc: Account) {
    setBalanceAccount(acc);
    setNewBalance(acc.current_balance.toString());
    setBalanceNote("");
  }

  async function handleBalanceUpdate() {
    if (!balanceAccount) return;
    const balance = Number(newBalance);
    if (isNaN(balance)) {
      toast.error("Enter a valid balance");
      return;
    }
    setUpdatingBalance(true);
    const supabase = createClient();

    // Update current_balance on account
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ current_balance: balance })
      .eq("id", balanceAccount.id);

    if (updateError) {
      toast.error("Failed to update balance: " + updateError.message);
      setUpdatingBalance(false);
      return;
    }

    // Insert balance history entry
    const { error: historyError } = await supabase
      .from("account_balance_history")
      .insert({
        account_id: balanceAccount.id,
        user_id: userId,
        balance_date: new Date().toISOString().split("T")[0],
        balance,
        note: balanceNote || null,
      });

    if (historyError) {
      toast.error("Balance updated but failed to log history: " + historyError.message);
    } else {
      toast.success("Balance updated");
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === balanceAccount.id ? { ...a, current_balance: balance } : a
      )
    );
    setBalanceAccount(null);
    setUpdatingBalance(false);
  }

  // Transfer handlers
  function openTransfer(prefillFromId?: string) {
    setTransferFromId(prefillFromId || "");
    setTransferToId("");
    setTransferAmount("");
    setTransferNote("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setTransferOpen(true);
  }

  const fromAccount = accounts.find((a) => a.id === transferFromId);
  const transferCurrency = fromAccount?.currency || "";
  const toAccountOptions = accounts.filter(
    (a) =>
      a.id !== transferFromId &&
      a.status === "active" &&
      a.currency === transferCurrency
  );

  async function handleTransfer() {
    if (!transferFromId || !transferToId) {
      toast.error("Select both accounts");
      return;
    }
    if (transferFromId === transferToId) {
      toast.error("Cannot transfer to the same account");
      return;
    }
    const amount = Number(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than 0");
      return;
    }

    const from = accounts.find((a) => a.id === transferFromId);
    const to = accounts.find((a) => a.id === transferToId);
    if (!from || !to) return;

    if (from.currency !== to.currency) {
      toast.error("Cannot transfer between different currencies");
      return;
    }

    setTransferring(true);
    const supabase = createClient();
    const today = transferDate || new Date().toISOString().split("T")[0];

    // Calculate new balances
    const newFromBalance = from.current_balance - amount;
    // Credit cards: paying off reduces balance; bank accounts: receiving increases balance
    const newToBalance =
      to.account_type === "credit_card"
        ? to.current_balance - amount
        : to.current_balance + amount;

    // Update "from" account balance
    const { error: fromErr } = await supabase
      .from("accounts")
      .update({ current_balance: newFromBalance })
      .eq("id", from.id);

    if (fromErr) {
      toast.error("Failed to update source account: " + fromErr.message);
      setTransferring(false);
      return;
    }

    // Update "to" account balance
    const { error: toErr } = await supabase
      .from("accounts")
      .update({ current_balance: newToBalance })
      .eq("id", to.id);

    if (toErr) {
      toast.error("Failed to update target account: " + toErr.message);
      setTransferring(false);
      return;
    }

    // Insert balance history for both accounts
    const historyNote = transferNote
      ? `Transfer: ${transferNote}`
      : `Transfer ${to.account_type === "credit_card" ? "payment to" : "to"} ${to.account_name}`;
    const historyNoteReverse = transferNote
      ? `Transfer: ${transferNote}`
      : `Transfer from ${from.account_name}`;

    await supabase.from("account_balance_history").insert([
      {
        account_id: from.id,
        user_id: userId,
        balance_date: today,
        balance: newFromBalance,
        note: historyNote,
      },
      {
        account_id: to.id,
        user_id: userId,
        balance_date: today,
        balance: newToBalance,
        note: historyNoteReverse,
      },
    ]);

    // Insert transfer record
    await supabase.from("account_transfers").insert({
      user_id: userId,
      from_account_id: from.id,
      to_account_id: to.id,
      amount,
      currency: from.currency,
      note: transferNote || null,
      transfer_date: today,
    });

    // Update local state
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === from.id) return { ...a, current_balance: newFromBalance };
        if (a.id === to.id) return { ...a, current_balance: newToBalance };
        return a;
      })
    );

    toast.success(
      `Transferred ${formatCurrency(amount, from.currency)} from ${from.account_name} to ${to.account_name}`
    );
    setTransferOpen(false);
    setTransferring(false);
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Balance
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950">
              <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalBankBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Active bank accounts
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Credit Used
            </CardTitle>
            <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
              <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalCreditUsed)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Active credit cards
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Number of Accounts
            </CardTitle>
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{accounts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeAccounts.length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { value: "all", label: "All" },
          { value: "bank_account", label: "Bank Accounts" },
          { value: "credit_card", label: "Credit Cards" },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={typeFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTypeFilter(tab.value);
              setPage(0);
            }}
          >
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openTransfer()}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer / Pay
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {accounts.length === 0
              ? "No accounts yet. Add your first bank account or credit card!"
              : "No accounts match this filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Institution</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((acc) => (
                  <TableRow
                    key={acc.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/accounts/${acc.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {acc.account_type === "credit_card" ? (
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{acc.account_name}</p>
                          {acc.account_number && (
                            <p className="text-xs text-muted-foreground">
                              ****{acc.account_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">
                        {acc.account_type === "credit_card"
                          ? "Credit Card"
                          : "Bank Account"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {acc.institution_name || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div>
                        {formatCurrency(acc.current_balance, acc.currency || "PHP")}
                        {acc.account_type === "credit_card" && acc.credit_limit && (
                          <p className="text-xs text-muted-foreground">
                            / {formatCurrency(acc.credit_limit, acc.currency || "PHP")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        className={
                          STATUS_COLORS[acc.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {acc.status === "active" ? "Active" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Transfer"
                          onClick={() => openTransfer(acc.id)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Update Balance"
                          onClick={() => openBalanceUpdate(acc)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(acc)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(acc.id)}
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
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
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
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? This will also delete
              all balance history. This action cannot be undone.
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
      <Dialog open={!!editAccount} onOpenChange={() => setEditAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Institution</Label>
              <Input
                value={editInstitution}
                onChange={(e) => setEditInstitution(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editAccount?.account_type === "credit_card" && (
                <div className="space-y-2">
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer / Pay</DialogTitle>
            <DialogDescription>
              Move funds between accounts. Paying a credit card reduces its
              balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select value={transferFromId} onValueChange={(v) => {
                setTransferFromId(v);
                setTransferToId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.status === "active")
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} ({formatCurrency(a.current_balance, a.currency || "PHP")})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Account</Label>
              <Select
                value={transferToId}
                onValueChange={setTransferToId}
                disabled={!transferFromId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !transferFromId
                      ? "Select source first"
                      : toAccountOptions.length === 0
                        ? "No matching accounts"
                        : "Select target account"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {toAccountOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} ({formatCurrency(a.current_balance, a.currency || "PHP")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferFromId && toAccountOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No other active accounts with the same currency ({transferCurrency}).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount {transferCurrency && `(${transferCurrency})`}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Note{" "}
                  <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="e.g. CC payment"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={transferring}>
              {transferring && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Balance Dialog */}
      <Dialog
        open={!!balanceAccount}
        onOpenChange={() => setBalanceAccount(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Balance</DialogTitle>
            <DialogDescription>
              Enter the current balance for{" "}
              <span className="font-medium">
                {balanceAccount?.account_name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Balance ({balanceAccount?.currency || "PHP"})</Label>
              <Input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>
                Note{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder="e.g. Monthly reconciliation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBalanceAccount(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleBalanceUpdate} disabled={updatingBalance}>
              {updatingBalance && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
