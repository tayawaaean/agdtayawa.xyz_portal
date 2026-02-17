"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, FolderKanban, PlayCircle, CircleDashed, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { STATUS_COLORS, CURRENCIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { Project, ProjectStatus, ProjectType } from "@/lib/types";
import { NewProjectDialog } from "./new-project-dialog";

const PAGE_SIZE = 10;

type ProjectWithClient = Project & { client?: { id: string; company_name: string } | null };

interface ProjectTableProps {
  projects: ProjectWithClient[];
  clients: { id: string; company_name: string }[];
  userId: string;
  defaultRate?: number | null;
}

export function ProjectTable({
  projects: initialProjects,
  clients,
  userId,
  defaultRate,
}: ProjectTableProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<ProjectWithClient | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<ProjectType>("hourly");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("not_started");
  const [editRate, setEditRate] = useState("");
  const [editCurrency, setEditCurrency] = useState("PHP");
  const [editDeadline, setEditDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  // Realtime subscription for projects table
  useRealtime<Project>({
    table: "projects",
    filter: `user_id=eq.${userId}`,
    onInsert: useCallback(async (record: Project) => {
      // Fetch full record with joined client data
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("*, client:clients(id, company_name)")
        .eq("id", record.id)
        .single();
      if (data) {
        setProjects((prev) => {
          if (prev.some((p) => p.id === data.id)) return prev;
          return [data as ProjectWithClient, ...prev];
        });
      }
    }, []),
    onUpdate: useCallback((record: Project) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== record.id) return p;
          const { client: _, ...fields } = record as any;
          return { ...p, ...fields };
        })
      );
    }, []),
    onDelete: useCallback((record: Project) => {
      setProjects((prev) => prev.filter((p) => p.id !== record.id));
    }, []),
  });

  const statusCounts = {
    all: projects.length,
    in_progress: projects.filter((p) => p.status === "in_progress").length,
    not_started: projects.filter((p) => p.status === "not_started").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  const filtered = projects.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedProjects = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openEdit(project: ProjectWithClient) {
    setEditProject(project);
    setEditName(project.name);
    setEditType(project.type);
    setEditStatus(project.status);
    setEditRate(project.rate?.toString() || "");
    setEditCurrency(project.currency || "PHP");
    setEditDeadline(project.deadline || "");
  }

  async function handleEdit() {
    if (!editProject) return;
    if (!editName.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const rate = editRate ? Number(editRate) : null;
    const { error } = await supabase
      .from("projects")
      .update({
        name: editName.trim(),
        type: editType,
        status: editStatus,
        rate,
        currency: editCurrency,
        deadline: editDeadline || null,
      })
      .eq("id", editProject.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editProject.id
            ? { ...p, name: editName.trim(), type: editType, status: editStatus, rate, currency: editCurrency, deadline: editDeadline || null }
            : p
        )
      );
      toast.success("Project updated");
      setEditProject(null);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success("Project deleted");
    }
    setDeleteId(null);
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <FolderKanban className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.all}</p>
            <p className="text-xs text-muted-foreground mt-1">All projects</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <div className="rounded-lg bg-blue-50 p-2">
              <PlayCircle className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.in_progress}</p>
            <p className="text-xs text-muted-foreground mt-1">Active work</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Not Started</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <CircleDashed className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.not_started}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.completed}</p>
            <p className="text-xs text-muted-foreground mt-1">Finished</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="not_started">Not Started</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {projects.length === 0
              ? "No projects yet. Create your first project!"
              : "No projects match this filter."}
          </p>
          {projects.length === 0 && (
            <div className="mt-4">
              <NewProjectDialog
                clients={clients}
                userId={userId}
                defaultRate={defaultRate}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {project.client?.company_name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{project.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[project.status] || ""}
                    >
                      {formatStatus(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(project);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(project.id);
                        }}
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

      {/* Edit Dialog */}
      <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v as ProjectType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="retainer">Retainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Rate</Label>
                <Input type="number" step="0.01" min="0" value={editRate} onChange={(e) => setEditRate(e.target.value)} placeholder="0.00" />
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
                <Label>Deadline</Label>
                <Input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This will also delete all associated time entries. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
