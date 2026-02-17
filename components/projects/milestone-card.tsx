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
import {
  Pencil,
  Trash2,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";
import type { ProjectMilestone, Profile } from "@/lib/types";
import { MilestoneForm } from "./milestone-form";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { useRealtime } from "@/hooks/use-realtime";

const PAGE_SIZE = 10;

interface MilestoneCardProps {
  projectId: string;
  userId: string;
  defaultCurrency: string;
  initialMilestones: ProjectMilestone[];
}

interface InvoiceModalData {
  milestone: ProjectMilestone;
  profile: Profile | null;
  clients: { id: string; company_name: string; email: string | null; address: string | null }[];
  projects: { id: string; name: string; rate: number | null; client_id: string | null }[];
  lastInvoiceNumber: string | null;
  clientId: string | null;
}

export function MilestoneCard({
  projectId,
  userId,
  defaultCurrency,
  initialMilestones,
}: MilestoneCardProps) {
  const router = useRouter();
  const [milestones, setMilestones] = useState(initialMilestones);
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalData | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Realtime subscription
  useRealtime<ProjectMilestone>({
    table: "project_milestones",
    filter: `project_id=eq.${projectId}`,
    onInsert: (record) => {
      setMilestones((prev) =>
        [...prev, record].sort((a, b) => a.sort_order - b.sort_order)
      );
    },
    onUpdate: (record) => {
      setMilestones((prev) =>
        prev
          .map((m) => (m.id === record.id ? record : m))
          .sort((a, b) => a.sort_order - b.sort_order)
      );
    },
    onDelete: (oldRecord) => {
      setMilestones((prev) => prev.filter((m) => m.id !== oldRecord.id));
    },
  });

  const totalPages = Math.max(1, Math.ceil(milestones.length / PAGE_SIZE));
  const paginated = milestones.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  // Summary stats
  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const completedCount = milestones.filter((m) =>
    ["completed", "invoiced", "paid"].includes(m.status)
  ).length;
  const paidCount = milestones.filter((m) => m.status === "paid").length;
  const completedPct =
    milestones.length > 0
      ? Math.round((completedCount / milestones.length) * 100)
      : 0;
  const paidPct =
    milestones.length > 0
      ? Math.round((paidCount / milestones.length) * 100)
      : 0;

  const nextSortOrder =
    milestones.length > 0
      ? Math.max(...milestones.map((m) => m.sort_order)) + 1
      : 0;

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("project_milestones")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete milestone: " + error.message);
    } else {
      setMilestones((prev) => prev.filter((m) => m.id !== deleteId));
      toast.success("Milestone deleted");
    }
    setDeleteId(null);
  }

  async function handleCreateInvoice(milestone: ProjectMilestone) {
    setLoadingInvoice(true);
    const supabase = createClient();

    // Fetch all data needed by InvoiceBuilder
    const [profileRes, clientsRes, projectsRes, lastInvoiceRes, projectRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase
          .from("clients")
          .select("id, company_name, email, address")
          .eq("status", "active")
          .order("company_name"),
        supabase
          .from("projects")
          .select("id, name, rate, client_id")
          .in("status", ["not_started", "in_progress"])
          .order("name"),
        supabase
          .from("invoices")
          .select("invoice_number")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("projects")
          .select("client_id")
          .eq("id", projectId)
          .single(),
      ]);

    setInvoiceModal({
      milestone,
      profile: profileRes.data,
      clients: clientsRes.data ?? [],
      projects: projectsRes.data ?? [],
      lastInvoiceNumber: lastInvoiceRes.data?.invoice_number ?? null,
      clientId: projectRes.data?.client_id ?? null,
    });
    setLoadingInvoice(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Milestones ({milestones.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditMilestone(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </CardHeader>
        <CardContent>
          {milestones.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalAmount, defaultCurrency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-lg font-bold">{completedPct}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-lg font-bold">{paidPct}%</p>
              </div>
            </div>
          )}

          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No milestones yet. Add milestones to break this project into
              deliverables.
            </p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[110px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((milestone) => (
                      <TableRow key={milestone.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{milestone.name}</p>
                            {milestone.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {milestone.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            milestone.amount,
                            milestone.currency
                          )}
                        </TableCell>
                        <TableCell>
                          {milestone.due_date
                            ? formatDate(milestone.due_date)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              STATUS_COLORS[milestone.status] || ""
                            }
                          >
                            {formatStatus(milestone.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditMilestone(milestone);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(milestone.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {milestone.status === "completed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Create Invoice"
                                disabled={loadingInvoice}
                                onClick={() => handleCreateInvoice(milestone)}
                              >
                                {loadingInvoice ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {milestones.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–
                    {Math.min((page + 1) * PAGE_SIZE, milestones.length)} of{" "}
                    {milestones.length}
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
      </Card>

      {/* Add/Edit Milestone Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditMilestone(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editMilestone ? "Edit Milestone" : "Add Milestone"}
            </DialogTitle>
            <DialogDescription>
              {editMilestone
                ? `Update the details for "${editMilestone.name}".`
                : "Add a new milestone to this project."}
            </DialogDescription>
          </DialogHeader>
          <MilestoneForm
            projectId={projectId}
            userId={userId}
            defaultCurrency={defaultCurrency}
            milestone={editMilestone ?? undefined}
            nextSortOrder={nextSortOrder}
            onSuccess={() => {
              setShowForm(false);
              setEditMilestone(null);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Milestone Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Milestone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this milestone? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Modal */}
      <Dialog
        open={!!invoiceModal}
        onOpenChange={(open) => {
          if (!open) setInvoiceModal(null);
        }}
      >
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice from Milestone</DialogTitle>
            <DialogDescription>
              Creating invoice for &quot;{invoiceModal?.milestone.name}&quot;
            </DialogDescription>
          </DialogHeader>
          {invoiceModal && (
            <InvoiceBuilder
              userId={userId}
              profile={invoiceModal.profile}
              clients={invoiceModal.clients}
              projects={invoiceModal.projects}
              lastInvoiceNumber={invoiceModal.lastInvoiceNumber}
              variant="modal"
              milestoneId={invoiceModal.milestone.id}
              milestoneData={{
                name: invoiceModal.milestone.name,
                description: invoiceModal.milestone.description,
                amount: invoiceModal.milestone.amount,
                currency: invoiceModal.milestone.currency,
              }}
              milestoneProjectId={projectId}
              milestoneProjectClientId={invoiceModal.clientId}
              onSuccess={() => {
                setInvoiceModal(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
