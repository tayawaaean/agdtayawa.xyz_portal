"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { MILESTONE_STATUSES, CURRENCIES } from "@/lib/constants";
import type { ProjectMilestone } from "@/lib/types";

const milestoneSchema = z.object({
  name: z.string().min(1, "Milestone name is required"),
  description: z.string().optional(),
  amount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  currency: z.string().default("PHP"),
  due_date: z.string().optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "invoiced", "paid"])
    .default("pending"),
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface MilestoneFormProps {
  projectId: string;
  userId: string;
  defaultCurrency: string;
  milestone?: ProjectMilestone;
  nextSortOrder: number;
  onSuccess: () => void;
}

export function MilestoneForm({
  projectId,
  userId,
  defaultCurrency,
  milestone,
  nextSortOrder,
  onSuccess,
}: MilestoneFormProps) {
  const isEditing = !!milestone;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MilestoneFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(milestoneSchema) as any,
    defaultValues: {
      name: milestone?.name ?? "",
      description: milestone?.description ?? "",
      amount: milestone?.amount ?? 0,
      currency: milestone?.currency ?? defaultCurrency,
      due_date: milestone?.due_date ?? "",
      status: milestone?.status ?? "pending",
    },
  });

  const currency = watch("currency");
  const status = watch("status");

  async function onSubmit(data: MilestoneFormData) {
    const supabase = createClient();

    const payload = {
      project_id: projectId,
      user_id: userId,
      name: data.name,
      description: data.description || null,
      amount: data.amount,
      currency: data.currency,
      due_date: data.due_date || null,
      status: data.status,
      sort_order: milestone?.sort_order ?? nextSortOrder,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("project_milestones")
        .update(payload)
        .eq("id", milestone.id);

      if (error) {
        toast.error("Failed to update milestone: " + error.message);
        return;
      }
      toast.success("Milestone updated");
    } else {
      const { error } = await supabase
        .from("project_milestones")
        .insert(payload);

      if (error) {
        toast.error("Failed to create milestone: " + error.message);
        return;
      }
      toast.success("Milestone created");
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="milestone-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input id="milestone-name" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="milestone-description">Description</Label>
        <Textarea
          id="milestone-description"
          rows={2}
          {...register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="milestone-amount">Amount</Label>
          <Input
            id="milestone-amount"
            type="number"
            step="0.01"
            min="0"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="milestone-due-date">Due Date</Label>
          <Input
            id="milestone-due-date"
            type="date"
            {...register("due_date")}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(val) =>
              setValue("status", val as MilestoneFormData["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MILESTONE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? "Update Milestone" : "Add Milestone"}
      </Button>
    </form>
  );
}
