"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Landmark,
  CreditCard,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";
import { BalanceChart } from "./balance-chart";
import { AccountForm } from "./account-form";
import type { Account, BalanceEntry } from "@/lib/types";

interface AccountDetailProps {
  account: Account;
  balanceHistory: BalanceEntry[];
  userId: string;
}

export function AccountDetail({
  account: initialAccount,
  balanceHistory: initialHistory,
  userId,
}: AccountDetailProps) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [history, setHistory] = useState(initialHistory);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showBalanceUpdate, setShowBalanceUpdate] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [updatingBalance, setUpdatingBalance] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Chart data — sorted ascending for the chart
  const chartData = [...history]
    .sort((a, b) => a.balance_date.localeCompare(b.balance_date))
    .map((entry) => ({
      date: formatDate(entry.balance_date),
      balance: Number(entry.balance),
    }));

  async function handleBalanceUpdate() {
    const balance = Number(newBalance);
    if (isNaN(balance)) {
      toast.error("Enter a valid balance");
      return;
    }
    setUpdatingBalance(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ current_balance: balance })
      .eq("id", account.id);

    if (updateError) {
      toast.error("Failed to update balance: " + updateError.message);
      setUpdatingBalance(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: newEntry, error: historyError } = await supabase
      .from("account_balance_history")
      .insert({
        account_id: account.id,
        user_id: userId,
        balance_date: today,
        balance,
        note: balanceNote || null,
      })
      .select()
      .single();

    if (historyError) {
      toast.error("Balance updated but history failed: " + historyError.message);
    } else {
      toast.success("Balance updated");
      if (newEntry) {
        setHistory((prev) => [newEntry, ...prev]);
      }
    }

    setAccount((prev) => ({ ...prev, current_balance: balance }));
    setShowBalanceUpdate(false);
    setUpdatingBalance(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id);

    if (error) {
      toast.error("Failed to delete account: " + error.message);
      setDeleting(false);
      return;
    }

    toast.success("Account deleted");
    router.push("/accounts");
    router.refresh();
  }

  function openBalanceUpdate() {
    setNewBalance(account.current_balance.toString());
    setBalanceNote("");
    setShowBalanceUpdate(true);
  }

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/accounts")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Accounts
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openBalanceUpdate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update Balance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Account Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-full bg-muted p-3">
            {account.account_type === "credit_card" ? (
              <CreditCard className="h-6 w-6" />
            ) : (
              <Landmark className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{account.account_name}</CardTitle>
              <Badge
                className={
                  STATUS_COLORS[account.status] || "bg-gray-100 text-gray-800"
                }
              >
                {account.status === "active" ? "Active" : "Closed"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>
                {account.account_type === "credit_card"
                  ? "Credit Card"
                  : "Bank Account"}
              </span>
              {account.institution_name && (
                <>
                  <span>·</span>
                  <span>{account.institution_name}</span>
                </>
              )}
              {account.account_number && (
                <>
                  <span>·</span>
                  <span>****{account.account_number}</span>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              {formatCurrency(account.current_balance, account.currency || "PHP")}
            </span>
            {account.account_type === "credit_card" && account.credit_limit && (
              <span className="text-lg text-muted-foreground">
                / {formatCurrency(account.credit_limit, account.currency || "PHP")}
              </span>
            )}
          </div>
          {account.opened_date && (
            <p className="text-sm text-muted-foreground mt-2">
              Opened: {formatDate(account.opened_date)}
            </p>
          )}
          {account.notes && (
            <p className="text-sm text-muted-foreground mt-1">{account.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Balance History Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance History</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={chartData} currency={account.currency || "PHP"} />
        </CardContent>
      </Card>

      {/* Balance History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance Log</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No balance history entries yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(entry.balance_date)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(
                          Number(entry.balance),
                          account.currency || "PHP"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.note || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Balance Dialog */}
      <Dialog open={showBalanceUpdate} onOpenChange={setShowBalanceUpdate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Balance</DialogTitle>
            <DialogDescription>
              Enter the current balance for{" "}
              <span className="font-medium">{account.account_name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Balance ({account.currency || "PHP"})</Label>
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
              onClick={() => setShowBalanceUpdate(false)}
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

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details.
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            userId={userId}
            account={account}
            onSuccess={() => {
              setShowEdit(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{account.account_name}</span>? This
              will also delete all balance history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
