"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES, CURRENCIES } from "@/lib/constants";
import type { Account } from "@/lib/types";

const accountSchema = z.object({
  account_name: z.string().min(1, "Account name is required"),
  account_type: z.enum(["bank_account", "credit_card"]).default("bank_account"),
  institution_name: z.string().optional(),
  account_number: z
    .string()
    .max(4, "Last 4 digits only")
    .optional(),
  currency: z.string().default("PHP"),
  opening_balance: z.coerce.number().min(0).default(0),
  credit_limit: z.coerce.number().min(0).optional().or(z.literal("")),
  status: z.enum(["active", "closed"]).default("active"),
  opened_date: z.string().optional(),
  notes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
  userId: string;
  account?: Account;
  onSuccess?: () => void;
}

export function AccountForm({ userId, account, onSuccess }: AccountFormProps) {
  const router = useRouter();
  const isEditing = !!account;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as any,
    defaultValues: {
      account_name: account?.account_name ?? "",
      account_type: account?.account_type ?? "bank_account",
      institution_name: account?.institution_name ?? "",
      account_number: account?.account_number ?? "",
      currency: account?.currency ?? "PHP",
      opening_balance: account?.current_balance ?? 0,
      credit_limit: account?.credit_limit ?? "",
      status: account?.status ?? "active",
      opened_date: account?.opened_date ?? "",
      notes: account?.notes ?? "",
    },
  });

  const accountType = watch("account_type");
  const currency = watch("currency");
  const status = watch("status");

  async function onSubmit(data: AccountFormData) {
    const supabase = createClient();

    const balance = data.opening_balance;

    const payload = {
      user_id: userId,
      account_name: data.account_name,
      account_type: data.account_type,
      institution_name: data.institution_name || null,
      account_number: data.account_number || null,
      currency: data.currency,
      current_balance: balance,
      credit_limit:
        data.account_type === "credit_card" && data.credit_limit !== ""
          ? Number(data.credit_limit)
          : null,
      status: data.status,
      opened_date: data.opened_date || null,
      notes: data.notes || null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", account.id);

      if (error) {
        toast.error("Failed to update account: " + error.message);
        return;
      }
      toast.success("Account updated");
    } else {
      const { data: newAccount, error } = await supabase
        .from("accounts")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        toast.error("Failed to create account: " + error.message);
        return;
      }

      // Insert opening balance as first balance_history entry
      if (newAccount) {
        await supabase.from("account_balance_history").insert({
          account_id: newAccount.id,
          user_id: userId,
          balance_date: data.opened_date || new Date().toISOString().split("T")[0],
          balance,
          note: "Opening balance",
        });
      }

      toast.success("Account created");
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/accounts");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="account_name">
          Account Name <span className="text-destructive">*</span>
        </Label>
        <Input id="account_name" {...register("account_name")} placeholder="e.g. BDO Savings" />
        {errors.account_name && (
          <p className="text-xs text-destructive">{errors.account_name.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Account Type</Label>
          <Select
            value={accountType}
            onValueChange={(val) =>
              setValue("account_type", val as AccountFormData["account_type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="institution_name">Institution</Label>
          <Input
            id="institution_name"
            {...register("institution_name")}
            placeholder="e.g. BDO, BPI, Metrobank"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="account_number">
            Last 4 Digits{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="account_number"
            {...register("account_number")}
            maxLength={4}
            placeholder="1234"
          />
          {errors.account_number && (
            <p className="text-xs text-destructive">{errors.account_number.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={currency}
            onValueChange={(val) => setValue("currency", val)}
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
          <Label htmlFor="opening_balance">
            {isEditing
              ? "Current Balance"
              : accountType === "credit_card"
                ? "Amount Owed"
                : "Opening Balance"}
          </Label>
          <Input
            id="opening_balance"
            type="number"
            step="0.01"
            min="0"
            {...register("opening_balance")}
            placeholder={accountType === "credit_card" ? "e.g. 22000" : "0.00"}
          />
          {accountType === "credit_card" && (
            <p className="text-xs text-muted-foreground">
              How much you currently owe on this card
            </p>
          )}
        </div>
      </div>

      {accountType === "credit_card" && (
        <div className="space-y-2">
          <Label htmlFor="credit_limit">Credit Limit</Label>
          <Input
            id="credit_limit"
            type="number"
            step="0.01"
            min="0"
            {...register("credit_limit")}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="opened_date">Opened Date</Label>
          <Input id="opened_date" type="date" {...register("opened_date")} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(val) =>
              setValue("status", val as AccountFormData["status"])
            }
          >
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? "Update Account" : "Create Account"}
      </Button>
    </form>
  );
}
