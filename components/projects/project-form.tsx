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
import { PROJECT_STATUSES, PROJECT_TYPES, CURRENCIES } from "@/lib/constants";
import type { Project } from "@/lib/types";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client_id: z.string().optional(),
  type: z.enum(["fixed", "hourly", "retainer"]).default("hourly"),
  rate: z.coerce.number().min(0).optional().or(z.literal("")),
  currency: z.string().default("PHP"),
  estimated_hours: z.coerce.number().min(0).optional().or(z.literal("")),
  deadline: z.string().optional(),
  status: z
    .enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"])
    .default("not_started"),
  description: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  clients: { id: string; company_name: string }[];
  userId: string;
  defaultRate?: number | null;
  project?: Project;
  onSuccess?: () => void;
}

export function ProjectForm({
  clients,
  userId,
  defaultRate,
  project,
  onSuccess,
}: ProjectFormProps) {
  const router = useRouter();
  const isEditing = !!project;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(projectSchema) as any,
    defaultValues: {
      name: project?.name ?? "",
      client_id: project?.client_id ?? "",
      type: project?.type ?? "hourly",
      rate: project?.rate ?? defaultRate ?? "",
      currency: project?.currency ?? "PHP",
      estimated_hours: project?.estimated_hours ?? "",
      deadline: project?.deadline ?? "",
      status: project?.status ?? "not_started",
      description: project?.description ?? "",
    },
  });

  const projectType = watch("type");
  const currency = watch("currency");
  const status = watch("status");
  const clientId = watch("client_id");

  async function onSubmit(data: ProjectFormData) {
    const supabase = createClient();

    const payload = {
      user_id: userId,
      name: data.name,
      client_id: data.client_id || null,
      type: data.type,
      rate: data.rate === "" ? null : Number(data.rate),
      currency: data.currency,
      estimated_hours:
        data.estimated_hours === "" ? null : Number(data.estimated_hours),
      deadline: data.deadline || null,
      status: data.status,
      description: data.description || null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", project.id);

      if (error) {
        toast.error("Failed to update project: " + error.message);
        return;
      }
      toast.success("Project updated");
    } else {
      const { error } = await supabase.from("projects").insert(payload);

      if (error) {
        toast.error("Failed to create project: " + error.message);
        return;
      }
      toast.success("Project created");
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/projects");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Project Name <span className="text-destructive">*</span>
        </Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId || "none"}
            onValueChange={(val) =>
              setValue("client_id", val === "none" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={projectType}
            onValueChange={(val) =>
              setValue("type", val as ProjectFormData["type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`grid gap-4 ${projectType === "fixed" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <div className="space-y-2">
          <Label htmlFor="rate">
            {projectType === "fixed" ? "Fixed Price" : projectType === "retainer" ? "Retainer Fee" : "Hourly Rate"}
          </Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            {...register("rate")}
          />
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
        {projectType !== "fixed" && (
          <div className="space-y-2">
            <Label htmlFor="estimated_hours">Estimated Hours</Label>
            <Input
              id="estimated_hours"
              type="number"
              step="0.5"
              min="0"
              {...register("estimated_hours")}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="date" {...register("deadline")} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(val) =>
              setValue("status", val as ProjectFormData["status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
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
        {isEditing ? "Update Project" : "Create Project"}
      </Button>
    </form>
  );
}
