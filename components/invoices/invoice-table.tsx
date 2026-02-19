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
import { ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, FileText, FilePen, Send, CircleCheck, AlertTriangle, CalendarDays, X, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";
import type { Invoice, InvoiceStatus } from "@/lib/types";

const PAGE_SIZE = 10;

interface InvoiceTableProps {
  invoices: (Invoice & {
    client?: { company_name: string } | null;
    project?: { name: string } | null;
    milestone?: { name: string } | null;
    contract?: { name: string } | null;
  })[];
}

type InvoiceWithJoins = Invoice & {
  client?: { company_name: string } | null;
  project?: { name: string } | null;
  milestone?: { name: string } | null;
  contract?: { name: string } | null;
};

export function InvoiceTable({ invoices: initialInvoices }: InvoiceTableProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editInvoice, setEditInvoice] = useState<InvoiceWithJoins | null>(null);
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("draft");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editExchangeRate, setEditExchangeRate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Realtime subscription for invoices table
  const userId = initialInvoices[0]?.user_id;
  useRealtime<Invoice>({
    table: "invoices",
    ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
    onInsert: useCallback(async (record: Invoice) => {
      // Fetch full record with joined data
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("*, client:clients(company_name), project:projects(name), milestone:project_milestones(name), contract:contracts(name)")
        .eq("id", record.id)
        .single();
      if (data) {
        setInvoices((prev) => {
          if (prev.some((i) => i.id === data.id)) return prev;
          return [data as InvoiceWithJoins, ...prev];
        });
      }
    }, []),
    onUpdate: useCallback((record: Invoice) => {
      setInvoices((prev) =>
        prev.map((i) => {
          if (i.id !== record.id) return i;
          const { client: _, ...fields } = record as any;
          return { ...i, ...fields };
        })
      );
    }, []),
    onDelete: useCallback((record: Invoice) => {
      setInvoices((prev) => prev.filter((i) => i.id !== record.id));
    }, []),
  });

  // Auto-detect overdue
  const today = new Date().toISOString().split("T")[0];
  const processedInvoices = invoices.map((inv) => {
    if (
      inv.due_date &&
      inv.due_date < today &&
      !["paid", "cancelled"].includes(inv.status)
    ) {
      return { ...inv, displayStatus: "overdue" as const };
    }
    return { ...inv, displayStatus: inv.status };
  });

  const statusCounts = {
    all: processedInvoices.length,
    draft: processedInvoices.filter((i) => i.displayStatus === "draft").length,
    sent: processedInvoices.filter((i) => i.displayStatus === "sent").length,
    paid: processedInvoices.filter((i) => i.displayStatus === "paid").length,
    overdue: processedInvoices.filter((i) => i.displayStatus === "overdue").length,
  };

  function getDateFrom(range: string): string {
    const now = new Date();
    if (range === "this_month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    if (range === "last_month") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (range === "this_quarter") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return `${now.getFullYear()}-${String(q + 1).padStart(2, "0")}-01`;
    }
    if (range === "this_year") return `${now.getFullYear()}-01-01`;
    return "";
  }

  function getDateTo(range: string): string {
    const now = new Date();
    if (range === "last_month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 0);
      return d.toISOString().split("T")[0];
    }
    return "";
  }

  const filtered = processedInvoices.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.displayStatus === statusFilter;
    const from = getDateFrom(dateRange);
    const to = getDateTo(dateRange);
    const matchesFrom = !from || inv.issue_date >= from;
    const matchesTo = !to || inv.issue_date <= to;
    return matchesStatus && matchesFrom && matchesTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedInvoices = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openEdit(inv: InvoiceWithJoins) {
    setEditInvoice(inv);
    setEditStatus(inv.status);
    setEditDueDate(inv.due_date || "");
    setEditNotes(inv.notes || "");
    setEditExchangeRate(inv.exchange_rate ?? null);
  }

  async function handleEdit() {
    if (!editInvoice) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({
        status: editStatus,
        due_date: editDueDate || null,
        notes: editNotes || null,
        exchange_rate: editExchangeRate || null,
      })
      .eq("id", editInvoice.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      // If status changed to "paid", update linked milestone
      if (editStatus === "paid") {
        const { data: invoiceRow } = await supabase
          .from("invoices")
          .select("milestone_id")
          .eq("id", editInvoice.id)
          .single();

        if (invoiceRow?.milestone_id) {
          await supabase
            .from("project_milestones")
            .update({ status: "paid" })
            .eq("id", invoiceRow.milestone_id);
        }
      }

      setInvoices((prev) =>
        prev.map((i) =>
          i.id === editInvoice.id
            ? { ...i, status: editStatus, due_date: editDueDate || null, notes: editNotes || null, exchange_rate: editExchangeRate || null }
            : i
        )
      );
      toast.success("Invoice updated");
      setEditInvoice(null);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setInvoices((prev) => prev.filter((i) => i.id !== deleteId));
      toast.success("Invoice deleted");
    }
    setDeleteId(null);
  }

  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  async function handleMarkPaid(invoiceId: string) {
    setMarkingPaidId(invoiceId);
    const supabase = createClient();

    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoiceId);

    if (error) {
      toast.error("Failed to mark as paid: " + error.message);
    } else {
      // Update linked milestone to "paid"
      const { data: invoiceRow } = await supabase
        .from("invoices")
        .select("milestone_id")
        .eq("id", invoiceId)
        .single();

      if (invoiceRow?.milestone_id) {
        await supabase
          .from("project_milestones")
          .update({ status: "paid" })
          .eq("id", invoiceRow.milestone_id);
      }

      setInvoices((prev) =>
        prev.map((i) => (i.id === invoiceId ? { ...i, status: "paid" as InvoiceStatus } : i))
      );
      toast.success("Invoice marked as paid");
    }
    setMarkingPaidId(null);
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <FileText className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.all}</p>
            <p className="text-xs text-muted-foreground mt-1">All invoices</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <FilePen className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.draft}</p>
            <p className="text-xs text-muted-foreground mt-1">Not sent yet</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
            <div className="rounded-lg bg-blue-50 p-2">
              <Send className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.sent}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2">
              <CircleCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.paid}</p>
            <p className="text-xs text-muted-foreground mt-1">Payment received</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4 col-span-2 lg:col-span-1">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <div className="rounded-lg bg-red-50 p-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.overdue}</p>
            <p className="text-xs text-muted-foreground mt-1">Past due date</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {invoices.length === 0
              ? "No invoices yet. Create your first invoice!"
              : "No invoices match this filter."}
          </p>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">Project / Contract</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell max-w-[200px] truncate">
                    {inv.client?.company_name ?? "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px]">
                    {inv.project?.name || inv.contract?.name ? (
                      <div className="min-w-0">
                        {inv.project?.name && (
                          <p className="text-sm truncate">{inv.project.name}</p>
                        )}
                        {inv.milestone?.name && (
                          <p className="text-xs text-muted-foreground truncate">{inv.milestone.name}</p>
                        )}
                        {inv.contract?.name && (
                          <p className={`text-xs truncate ${inv.project?.name ? "text-muted-foreground" : "text-sm"}`}>{inv.contract.name}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(inv.issue_date)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {inv.due_date ? formatDate(inv.due_date) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(inv.total, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        STATUS_COLORS[inv.displayStatus] || ""
                      }
                    >
                      {formatStatus(inv.displayStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!["paid", "cancelled"].includes(inv.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600"
                          title="Mark as Paid"
                          disabled={markingPaidId === inv.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPaid(inv.id);
                          }}
                        >
                          {markingPaidId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(inv);
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
                          setDeleteId(inv.id);
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
      <Dialog open={!!editInvoice} onOpenChange={() => setEditInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Update the details for {editInvoice?.invoice_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as InvoiceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="viewed">Viewed</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Invoice notes" />
            </div>
            {editInvoice?.currency && editInvoice.currency !== "PHP" && (
              <div className="space-y-2">
                <Label>Exchange Rate (1 {editInvoice.currency} = ? PHP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 56.00"
                  value={editExchangeRate ?? ""}
                  onChange={(e) => setEditExchangeRate(e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoice(null)}>Cancel</Button>
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
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
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
