"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, Landmark, CreditCard } from "lucide-react";
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants";
import { updateAccountBalance } from "@/lib/account-balance";
import type { AccountType } from "@/lib/types";

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount is required"),
  currency: z.string().default("PHP"),
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1, "Category is required"),
  vendor: z.string().optional(),
  description: z.string().optional(),
  payment_method: z.string().optional(),
  is_tax_deductible: z.boolean(),
  project_id: z.string().optional(),
  account_id: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface AccountOption {
  id: string;
  account_name: string;
  account_type: AccountType;
  currency: string;
}

interface ExpenseFormProps {
  userId: string;
  categories: string[];
  projects: { id: string; name: string }[];
  accounts?: AccountOption[];
  variant?: "page" | "modal";
  onSuccess?: () => void;
}

export function ExpenseForm({ userId, categories, projects, accounts = [], variant = "page", onSuccess }: ExpenseFormProps) {
  const router = useRouter();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      amount: "" as unknown as number,
      currency: "PHP",
      date: today,
      category: "",
      vendor: "",
      description: "",
      payment_method: "",
      is_tax_deductible: true,
      project_id: "",
      account_id: "",
    },
  });

  const category = watch("category");
  const currency = watch("currency");
  const paymentMethod = watch("payment_method");
  const projectId = watch("project_id");
  const accountId = watch("account_id");
  const isTaxDeductible = watch("is_tax_deductible");

  async function onSubmit(data: ExpenseFormData) {
    const supabase = createClient();
    let receiptUrl: string | null = null;

    // Upload receipt if provided
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, receiptFile);

      if (uploadError) {
        toast.error("Failed to upload receipt: " + uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(fileName);

      receiptUrl = publicUrl;
    }

    const { error } = await supabase.from("expenses").insert({
      user_id: userId,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      category: data.category,
      vendor: data.vendor || null,
      description: data.description || null,
      payment_method: data.payment_method || null,
      receipt_url: receiptUrl,
      is_tax_deductible: data.is_tax_deductible,
      project_id: data.project_id || null,
      account_id: data.account_id || null,
    });

    if (error) {
      toast.error("Failed to create expense: " + error.message);
      return;
    }

    // Update linked account balance
    if (data.account_id) {
      const acct = accounts.find((a) => a.id === data.account_id);
      if (acct) {
        await updateAccountBalance(
          supabase,
          acct.id,
          userId,
          data.amount,
          acct.account_type,
          "add",
          `Expense: ${data.category}${data.vendor ? ` – ${data.vendor}` : ""}`
        );
      }
    }

    toast.success("Expense logged");
    if (variant === "modal" && onSuccess) {
      onSuccess();
    } else {
      router.push("/expenses");
    }
    router.refresh();
  }

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="amount">
            Amount <span className="text-destructive">*</span>
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-xs text-destructive">
              {errors.amount.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={currency}
            onValueChange={(val) => {
              setValue("currency", val);
              // Clear account if it doesn't match the new currency
              const currentAcct = accounts.find((a) => a.id === accountId);
              if (currentAcct && currentAcct.currency !== val) {
                setValue("account_id", "");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={category}
            onValueChange={(val) => setValue("category", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-destructive">
              {errors.category.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor</Label>
          <Input id="vendor" {...register("vendor")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={2}
          {...register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select
            value={paymentMethod || "none"}
            onValueChange={(val) =>
              setValue("payment_method", val === "none" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Paid From (optional)</Label>
          <Select
            value={accountId || "none"}
            onValueChange={(val) =>
              setValue("account_id", val === "none" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No account</SelectItem>
              {accounts
                .filter((a) => a.currency === currency)
                .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    {a.account_type === "credit_card" ? (
                      <CreditCard className="h-3.5 w-3.5" />
                    ) : (
                      <Landmark className="h-3.5 w-3.5" />
                    )}
                    {a.account_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Project (optional)</Label>
          <Select
            value={projectId || "none"}
            onValueChange={(val) =>
              setValue("project_id", val === "none" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receipt Upload */}
      <div className="space-y-2">
        <Label htmlFor="receipt">Receipt (optional)</Label>
        <div className="flex items-center gap-3">
          <Input
            id="receipt"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="max-w-xs"
          />
          {receiptFile && (
            <span className="text-sm text-muted-foreground">
              <Upload className="inline h-3 w-3 mr-1" />
              {receiptFile.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_tax_deductible"
          checked={isTaxDeductible}
          onChange={(e) => setValue("is_tax_deductible", e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="is_tax_deductible" className="text-sm font-normal">
          Tax deductible
        </Label>
      </div>

      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={variant === "modal" && onSuccess ? onSuccess : () => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Log Expense
        </Button>
      </div>
    </form>
  );

  if (variant === "modal") {
    return formContent;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {formContent}
      </CardContent>
    </Card>
  );
}
