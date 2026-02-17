"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";
import type { Project, TimeEntry, ProjectMilestone } from "@/lib/types";
import { ProjectForm } from "./project-form";
import { MilestoneCard } from "./milestone-card";

const PAGE_SIZE = 10;

interface ProjectDetailProps {
  project: Project & { client?: { id: string; company_name: string } | null };
  clients: { id: string; company_name: string }[];
  timeEntries: TimeEntry[];
  milestones: ProjectMilestone[];
  userId: string;
  defaultRate?: number | null;
}

export function ProjectDetail({
  project,
  clients,
  timeEntries,
  milestones,
  userId,
  defaultRate,
}: ProjectDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [timePage, setTimePage] = useState(0);
  const [entries, setEntries] = useState(timeEntries);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBillable, setEditBillable] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);

  const timeTotalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedTimeEntries = entries.slice(timePage * PAGE_SIZE, (timePage + 1) * PAGE_SIZE);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries
    .filter((e) => e.is_billable)
    .reduce((sum, e) => sum + e.hours, 0);
  // Milestone calculations
  const milestoneTotalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const milestoneCompletedAmount = milestones
    .filter((m) => ["completed", "invoiced", "paid"].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);
  const milestoneInvoicedAmount = milestones
    .filter((m) => ["invoiced", "paid"].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);

  // For hourly: billable hours * rate
  // For fixed/retainer: sum of milestone amounts that have been invoiced or paid
  const totalBilled =
    project.type === "hourly"
      ? billableHours * (project.rate || 0)
      : milestoneInvoicedAmount;

  const budgetUsed =
    project.type === "hourly"
      ? project.estimated_hours
        ? (totalHours / project.estimated_hours) * 100
        : 0
      : milestoneTotalAmount > 0
        ? (milestoneCompletedAmount / milestoneTotalAmount) * 100
        : 0;

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (error) {
      toast.error("Failed to delete project: " + error.message);
    } else {
      toast.success("Project deleted");
      router.push("/projects");
      router.refresh();
    }
  }

  function openEditEntry(entry: TimeEntry) {
    setEditEntry(entry);
    setEditDate(entry.date);
    setEditHours(entry.hours.toString());
    setEditDescription(entry.description || "");
    setEditBillable(entry.is_billable);
  }

  async function handleEditEntry() {
    if (!editEntry) return;
    const hours = Number(editHours);
    if (!hours || hours <= 0) {
      toast.error("Enter valid hours");
      return;
    }
    setSavingEntry(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("time_entries")
      .update({
        date: editDate,
        hours: Math.round(hours * 100) / 100,
        description: editDescription || null,
        is_billable: editBillable,
      })
      .eq("id", editEntry.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editEntry.id
            ? { ...e, date: editDate, hours, description: editDescription || null, is_billable: editBillable }
            : e
        )
      );
      toast.success("Entry updated");
      setEditEntry(null);
    }
    setSavingEntry(false);
  }

  async function handleDeleteEntry() {
    if (!deleteEntryId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", deleteEntryId);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== deleteEntryId));
      toast.success("Entry deleted");
    }
    setDeleteEntryId(null);
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{project.name}</CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="secondary"
                className={STATUS_COLORS[project.status] || ""}
              >
                {formatStatus(project.status)}
              </Badge>
              <Badge variant="outline">{project.type}</Badge>
              {project.client && (
                <span className="text-sm text-muted-foreground">
                  {project.client.company_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {project.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {project.description}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-lg font-bold">{totalHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Billed</p>
              <p className="text-lg font-bold">{formatCurrency(totalBilled, project.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {project.type === "hourly" ? "Rate" : "Fixed Price"}
              </p>
              <p className="text-lg font-bold">
                {project.rate
                  ? formatCurrency(project.rate, project.currency) +
                    (project.type === "hourly" ? "/hr" : "")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {project.type === "hourly" ? "Budget Used" : "Milestone Progress"}
              </p>
              <p className="text-lg font-bold">
                {project.type === "hourly"
                  ? project.estimated_hours
                    ? `${budgetUsed.toFixed(0)}%`
                    : "-"
                  : milestoneTotalAmount > 0
                    ? `${budgetUsed.toFixed(0)}%`
                    : "-"}
              </p>
            </div>
          </div>
          {project.deadline && (
            <p className="text-sm text-muted-foreground mt-4">
              Deadline: {formatDate(project.deadline)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Time Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Time Entries ({entries.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/time")}
          >
            <Clock className="mr-2 h-4 w-4" />
            Log Time
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No time entries yet.
            </p>
          ) : (
            <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTimeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        {entry.hours.toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        {entry.is_billable ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditEntry(entry)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteEntryId(entry.id)}
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
            {entries.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {timePage * PAGE_SIZE + 1}–{Math.min((timePage + 1) * PAGE_SIZE, entries.length)} of {entries.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTimePage((p) => p - 1)} disabled={timePage === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">{timePage + 1} / {timeTotalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setTimePage((p) => p + 1)} disabled={timePage >= timeTotalPages - 1}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <MilestoneCard
        projectId={project.id}
        userId={userId}
        defaultCurrency={project.currency}
        initialMilestones={milestones}
      />

      {/* Edit Project Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details for {project.name}.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            clients={clients}
            userId={userId}
            defaultRate={defaultRate}
            project={project}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;?
              This will also delete all time entries for this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Time Entry Dialog */}
      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update the details for this time entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input type="number" step="0.25" min="0.1" value={editHours} onChange={(e) => setEditHours(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="What did you work on?" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-entry-billable"
                checked={editBillable}
                onChange={(e) => setEditBillable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-entry-billable" className="text-sm font-normal">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={handleEditEntry} disabled={savingEntry}>
              {savingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Time Entry Confirmation */}
      <Dialog open={!!deleteEntryId} onOpenChange={() => setDeleteEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Time Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntryId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteEntry}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
