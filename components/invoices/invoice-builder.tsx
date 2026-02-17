"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";
import { generateInvoiceNumber, formatCurrency } from "@/lib/utils";
import type { Profile, TimeEntry } from "@/lib/types";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceBuilderProps {
  userId: string;
  profile: Profile | null;
  clients: { id: string; company_name: string; email: string | null; address: string | null }[];
  projects: { id: string; name: string; rate: number | null; client_id: string | null }[];
  lastInvoiceNumber: string | null;
  variant?: "page" | "modal";
  onSuccess?: () => void;
  milestoneId?: string;
  milestoneData?: { name: string; description: string | null; amount: number; currency: string };
  milestoneProjectId?: string;
  milestoneProjectClientId?: string | null;
}

export function InvoiceBuilder({
  userId,
  profile,
  clients,
  projects,
  lastInvoiceNumber,
  variant = "page",
  onSuccess,
  milestoneId,
  milestoneData,
  milestoneProjectId,
  milestoneProjectClientId,
}: InvoiceBuilderProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const invoiceNumber = generateInvoiceNumber(
    lastInvoiceNumber,
    profile?.invoice_prefix ?? "INV"
  );

  const [clientId, setClientId] = useState(milestoneProjectClientId ?? "");
  const [projectId, setProjectId] = useState(milestoneProjectId ?? "");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(
    profile?.default_payment_terms ?? "Due within 30 days"
  );
  const [notes, setNotes] = useState(profile?.default_invoice_notes ?? "");
  const [currency, setCurrency] = useState(
    milestoneData?.currency ?? profile?.default_currency ?? "PHP"
  );
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<LineItem[]>(
    milestoneData
      ? [
          {
            description: milestoneData.description
              ? `${milestoneData.name} - ${milestoneData.description}`
              : milestoneData.name,
            quantity: 1,
            unit_price: milestoneData.amount,
          },
        ]
      : [{ description: "", quantity: 1, unit_price: 0 }]
  );
  const [saving, setSaving] = useState(false);
  const [showTimeImport, setShowTimeImport] = useState(false);
  const [importProjectId, setImportProjectId] = useState("");
  const [importEntries, setImportEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function loadTimeEntries() {
    if (!importProjectId) return;
    setLoadingEntries(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("project_id", importProjectId)
      .eq("is_billable", true)
      .order("date");

    if (error) {
      toast.error("Failed to load entries");
    } else {
      setImportEntries(data ?? []);
    }
    setLoadingEntries(false);
  }

  function importTimeEntries() {
    const project = projects.find((p) => p.id === importProjectId);
    const rate = project?.rate ?? profile?.default_hourly_rate ?? 0;

    const newItems: LineItem[] = importEntries.map((entry) => ({
      description: `${entry.description || "Development work"} (${entry.date})`,
      quantity: entry.hours,
      unit_price: rate,
    }));

    setItems([...items.filter((i) => i.description), ...newItems]);
    if (project?.client_id) {
      setClientId(project.client_id);
    }
    setProjectId(importProjectId);
    setShowTimeImport(false);
    toast.success(`${newItems.length} time entries imported`);
  }

  async function saveInvoice(status: "draft" | "sent") {
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }
    if (items.length === 0 || !items.some((i) => i.description)) {
      toast.error("Add at least one line item");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        client_id: clientId,
        project_id: projectId || null,
        milestone_id: milestoneId || null,
        invoice_number: invoiceNumber,
        status,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        tax_rate: taxRate / 100,
        tax_amount: taxAmount,
        total,
        notes: notes || null,
        payment_terms: paymentTerms || null,
        currency,
      })
      .select()
      .single();

    if (error || !invoice) {
      toast.error("Failed to create invoice: " + (error?.message ?? ""));
      setSaving(false);
      return;
    }

    // Insert line items
    const validItems = items.filter((i) => i.description);
    if (validItems.length > 0) {
      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(
          validItems.map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.quantity * item.unit_price,
          }))
        );

      if (itemsError) {
        toast.error("Invoice created but failed to save items");
      }
    }

    // Update milestone status to "invoiced" if created from a milestone
    if (milestoneId) {
      await supabase
        .from("project_milestones")
        .update({ status: "invoiced" })
        .eq("id", milestoneId);
    }

    toast.success(`Invoice ${invoiceNumber} created`);
    if (variant === "modal" && onSuccess) {
      onSuccess();
    } else {
      router.push(`/invoices/${invoice.id}`);
    }
    router.refresh();
  }

  const isModal = variant === "modal";

  return (
    <div className={`space-y-6 ${isModal ? "" : "max-w-4xl"}`}>
      {/* Header Info */}
      <div className={`grid gap-6 ${isModal ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} disabled />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">PHP (₱)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isModal && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">From</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">
                {profile?.business_name || profile?.full_name || "Your Business"}
              </p>
              {profile?.email && <p>{profile.email}</p>}
              {profile?.phone && <p>{profile.phone}</p>}
              {profile?.address && (
                <p className="whitespace-pre-line">{profile.address}</p>
              )}
              {profile?.tax_id_tin && <p>TIN: {profile.tax_id_tin}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          {!isModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTimeImport(true)}
            >
              <Clock className="mr-2 h-4 w-4" />
              Import Time Entries
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Column headers */}
          <div className={`${isModal ? "hidden sm:grid sm:grid-cols-[1fr_80px_100px_auto] gap-2" : "hidden sm:flex gap-2"} text-xs text-muted-foreground`}>
            <span className={isModal ? "" : "flex-1"}>Description</span>
            <span className={isModal ? "text-center" : "w-20 text-center"}>Qty</span>
            <span className={isModal ? "text-center" : "w-28 text-center"}>Price</span>
            {!isModal && <span className="w-28 text-right">Amount</span>}
            {!isModal && <span className="w-9"></span>}
          </div>
          {items.map((item, index) => (
            <div key={index} className={isModal
              ? "grid gap-2 sm:grid-cols-[1fr_80px_100px_auto] items-start border-b pb-3 last:border-0 last:pb-0"
              : "flex gap-2 items-start"
            }>
              <div className={isModal ? "" : "flex-1"}>
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, "description", e.target.value)
                  }
                />
              </div>
              <div className={isModal ? "flex gap-2 sm:contents" : "contents"}>
                <div className={isModal ? "flex-1 sm:flex-none" : "w-20"}>
                  <Input
                    type="number"
                    placeholder="Qty"
                    step="0.01"
                    min="0"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateItem(index, "quantity", Number(e.target.value))
                    }
                  />
                </div>
                <div className={isModal ? "flex-1 sm:flex-none" : "w-28"}>
                  <Input
                    type="number"
                    placeholder="Price"
                    step="0.01"
                    min="0"
                    value={item.unit_price || ""}
                    onChange={(e) =>
                      updateItem(index, "unit_price", Number(e.target.value))
                    }
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium whitespace-nowrap pt-2 sm:pt-0">
                    {formatCurrency(item.quantity * item.unit_price, currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive shrink-0"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Line Item
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-end space-y-2">
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex gap-4 items-center text-sm">
              <span className="text-muted-foreground">Tax Rate (%)</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="w-20 h-8"
                value={taxRate || ""}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
              />
              <span className="font-medium">{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="flex gap-8 text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={isModal ? 2 : 3}
              placeholder="Additional notes or terms..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={() => saveInvoice("draft")}
          variant="outline"
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save as Draft
        </Button>
        <Button onClick={() => saveInvoice("sent")} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save & Mark Sent
        </Button>
      </div>

      {/* Time Import Dialog */}
      {!isModal && (
        <Dialog open={showTimeImport} onOpenChange={setShowTimeImport}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Time Entries</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Project</Label>
                <Select
                  value={importProjectId}
                  onValueChange={setImportProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={loadTimeEntries}
                disabled={!importProjectId || loadingEntries}
                variant="outline"
                className="w-full"
              >
                {loadingEntries && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Load Entries
              </Button>
              {importEntries.length > 0 && (
                <div className="text-sm space-y-1 max-h-48 overflow-auto">
                  {importEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between border-b pb-1"
                    >
                      <span>
                        {entry.description || "Work"} ({entry.date})
                      </span>
                      <span className="font-medium">{entry.hours}h</span>
                    </div>
                  ))}
                  <p className="font-medium pt-2">
                    Total:{" "}
                    {importEntries.reduce((s, e) => s + e.hours, 0).toFixed(1)}h
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={importTimeEntries}
                disabled={importEntries.length === 0}
              >
                Import {importEntries.length} Entries
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
