"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { TimeEntry, Project } from "@/lib/types";

const PAGE_SIZE = 10;

type EntryWithProject = TimeEntry & {
  project: Pick<Project, "id" | "name"> & {
    client: { company_name: string } | null;
  };
};

interface TimesheetViewProps {
  entries: EntryWithProject[];
}

export function TimesheetView({ entries: initialEntries }: TimesheetViewProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<EntryWithProject | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBillable, setEditBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  // Realtime subscription for time_entries table
  const userId = initialEntries[0]?.user_id;
  useRealtime<TimeEntry>({
    table: "time_entries",
    ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
    onInsert: useCallback(async (record: TimeEntry) => {
      // Fetch full record with joined project data
      const supabase = createClient();
      const { data } = await supabase
        .from("time_entries")
        .select("*, project:projects(id, name, client:clients(company_name))")
        .eq("id", record.id)
        .single();
      if (data) {
        setEntries((prev) => {
          if (prev.some((e) => e.id === data.id)) return prev;
          return [data as EntryWithProject, ...prev];
        });
      }
    }, []),
    onUpdate: useCallback((record: TimeEntry) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== record.id) return e;
          const { project: _, ...fields } = record as any;
          return { ...e, ...fields };
        })
      );
    }, []),
    onDelete: useCallback((record: TimeEntry) => {
      setEntries((prev) => prev.filter((e) => e.id !== record.id));
    }, []),
  });

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries
    .filter((e) => e.is_billable)
    .reduce((sum, e) => sum + e.hours, 0);

  function openEdit(entry: EntryWithProject) {
    setEditEntry(entry);
    setEditDate(entry.date);
    setEditHours(entry.hours.toString());
    setEditDescription(entry.description || "");
    setEditBillable(entry.is_billable);
  }

  async function handleEdit() {
    if (!editEntry) return;
    const hours = Number(editHours);
    if (!hours || hours <= 0) {
      toast.error("Enter valid hours");
      return;
    }
    setSaving(true);
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
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Entry deleted");
    }
    setDeleteId(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Entries</CardTitle>
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Total: <strong>{totalHours.toFixed(1)}h</strong>
          </span>
          <span className="text-muted-foreground">
            Billable: <strong>{billableHours.toFixed(1)}h</strong>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No time entries yet. Use the timer or manual entry above.
          </p>
        ) : (
          <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {entry.project.name}
                        </p>
                        {entry.project.client && (
                          <p className="text-xs text-muted-foreground">
                            {entry.project.client.company_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {entry.description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.hours.toFixed(1)}h
                    </TableCell>
                    <TableCell>
                      {entry.is_billable ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800"
                        >
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
                          onClick={() => openEdit(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleteId(entry.id)}
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
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, entries.length)} of {entries.length} entries
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
      </CardContent>

      {/* Edit Dialog */}
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
                id="edit-billable"
                checked={editBillable}
                onChange={(e) => setEditBillable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-billable" className="text-sm font-normal">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
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
            <DialogTitle>Delete Time Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
