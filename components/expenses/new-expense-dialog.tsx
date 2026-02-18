"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ExpenseForm } from "./expense-form";

interface NewExpenseDialogProps {
  userId: string;
  trigger?: React.ReactNode;
}

export function NewExpenseDialog({ userId, trigger }: NewExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; account_name: string; account_type: "bank_account" | "credit_card"; currency: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();

    Promise.all([
      supabase
        .from("expense_categories")
        .select("name")
        .eq("user_id", userId)
        .order("name"),
      supabase
        .from("projects")
        .select("id, name")
        .in("status", ["not_started", "in_progress"])
        .order("name"),
      supabase
        .from("accounts")
        .select("id, account_name, account_type, currency")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("account_name"),
    ]).then(([catRes, projRes, acctRes]) => {
      setCategories(catRes.data?.map((c) => c.name) ?? []);
      setProjects(projRes.data ?? []);
      setAccounts(acctRes.data ?? []);
    });
  }, [open, userId]);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Expense
        </Button>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Expense</DialogTitle>
          <DialogDescription>
            Log a new expense to track your spending.
          </DialogDescription>
        </DialogHeader>
        <ExpenseForm
          userId={userId}
          categories={categories}
          projects={projects}
          accounts={accounts}
          variant="modal"
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
