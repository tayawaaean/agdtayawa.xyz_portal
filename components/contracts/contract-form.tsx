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
import { CONTRACT_STATUSES, CONTRACT_TYPES, BILLING_CYCLES, CURRENCIES } from "@/lib/constants";
import type { Contract } from "@/lib/types";

const contractSchema = z.object({
  name: z.string().min(1, "Contract name is required"),
  client_id: z.string().min(1, "Client is required"),
  type: z.enum(["hourly", "fixed"]).default("hourly"),
  billing_cycle: z.enum(["weekly", "biweekly", "monthly"]).default("weekly"),
  rate: z.coerce.number().min(0).optional().or(z.literal("")),
  fixed_amount: z.coerce.number().min(0).optional().or(z.literal("")),
  currency: z.string().default("PHP"),
  status: z.enum(["active", "paused", "ended"]).default("active"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface ContractFormProps {
  clients: { id: string; company_name: string }[];
  userId: string;
  contract?: Contract;
  onSuccess?: () => void;
}

export function ContractForm({
  clients,
  userId,
  contract,
  onSuccess,
}: ContractFormProps) {
  const router = useRouter();
  const isEditing = !!contract;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(contractSchema) as any,
    defaultValues: {
      name: contract?.name ?? "",
      client_id: contract?.client_id ?? "",
      type: contract?.type ?? "hourly",
      billing_cycle: contract?.billing_cycle ?? "weekly",
      rate: contract?.rate ?? "",
      fixed_amount: contract?.fixed_amount ?? "",
      currency: contract?.currency ?? "PHP",
      status: contract?.status ?? "active",
      start_date: contract?.start_date ?? "",
      end_date: contract?.end_date ?? "",
      description: contract?.description ?? "",
    },
  });

  const contractType = watch("type");
  const currency = watch("currency");
  const status = watch("status");
  const clientId = watch("client_id");
  const billingCycle = watch("billing_cycle");

  async function onSubmit(data: ContractFormData) {
    const supabase = createClient();

    const payload = {
      user_id: userId,
      name: data.name,
      client_id: data.client_id,
      type: data.type,
      billing_cycle: data.billing_cycle,
      rate: data.type === "hourly" ? (data.rate === "" ? null : Number(data.rate)) : null,
      fixed_amount: data.type === "fixed" ? (data.fixed_amount === "" ? null : Number(data.fixed_amount)) : null,
      currency: data.currency,
      status: data.status,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      description: data.description || null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("contracts")
        .update(payload)
        .eq("id", contract.id);

      if (error) {
        toast.error("Failed to update contract: " + error.message);
        return;
      }
      toast.success("Contract updated");
    } else {
      const { error } = await supabase.from("contracts").insert(payload);

      if (error) {
        toast.error("Failed to create contract: " + error.message);
        return;
      }
      toast.success("Contract created");
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/contracts");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Contract Name <span className="text-destructive">*</span>
        </Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Client <span className="text-destructive">*</span>
          </Label>
          <Select
            value={clientId || ""}
            onValueChange={(val) => setValue("client_id", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.client_id && (
            <p className="text-xs text-destructive">{errors.client_id.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={contractType}
            onValueChange={(val) =>
              setValue("type", val as ContractFormData["type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Billing Cycle</Label>
          <Select
            value={billingCycle}
            onValueChange={(val) =>
              setValue("billing_cycle", val as ContractFormData["billing_cycle"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_CYCLES.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate_or_amount">
            {contractType === "hourly" ? "Hourly Rate" : "Fixed Amount"}
          </Label>
          {contractType === "hourly" ? (
            <Input
              id="rate_or_amount"
              type="number"
              step="0.01"
              min="0"
              {...register("rate")}
            />
          ) : (
            <Input
              id="rate_or_amount"
              type="number"
              step="0.01"
              min="0"
              {...register("fixed_amount")}
            />
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input id="end_date" type="date" {...register("end_date")} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(val) =>
              setValue("status", val as ContractFormData["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? "Update Contract" : "Create Contract"}
      </Button>
    </form>
  );
}
