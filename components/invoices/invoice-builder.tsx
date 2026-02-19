"use client";

import { useState, useEffect, useCallback } from "react";
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
import { CURRENCIES } from "@/lib/constants";
import type { Profile, TimeEntry, ProjectMilestone } from "@/lib/types";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface ContractOption {
  id: string;
  name: string;
  type: "hourly" | "fixed";
  billing_cycle: string;
  rate: number | null;
  fixed_amount: number | null;
  currency: string;
  client_id: string;
}

interface InvoiceBuilderProps {
  userId: string;
  profile: Profile | null;
  clients: { id: string; company_name: string; email: string | null; address: string | null }[];
  projects: { id: string; name: string; rate: number | null; client_id: string | null }[];
  contracts?: ContractOption[];
  lastInvoiceNumber: string | null;
  variant?: "page" | "modal";
  onSuccess?: () => void;
  milestoneId?: string;
  milestoneData?: { name: string; description: string | null; amount: number; currency: string };
  milestoneProjectId?: string;
  milestoneProjectClientId?: string | null;
  contractId?: string;
  contractData?: { name: string; type: "hourly" | "fixed"; billing_cycle: string; rate: number | null; fixed_amount: number | null; currency: string };
  contractClientId?: string;
}

export function InvoiceBuilder({
  userId,
  profile,
  clients,
  projects,
  contracts = [],
  lastInvoiceNumber,
  variant = "page",
  onSuccess,
  milestoneId,
  milestoneData,
  milestoneProjectId,
  milestoneProjectClientId,
  contractId: initialContractId,
  contractData,
  contractClientId,
}: InvoiceBuilderProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const invoiceNumber = generateInvoiceNumber(
    lastInvoiceNumber,
    profile?.invoice_prefix ?? "INV"
  );

  const [clientId, setClientId] = useState(contractClientId ?? milestoneProjectClientId ?? "");
  const [projectId, setProjectId] = useState(milestoneProjectId ?? "");
  const [selectedContractId, setSelectedContractId] = useState(initialContractId ?? "");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(
    profile?.default_payment_terms ?? "Due within 30 days"
  );
  const [notes, setNotes] = useState(profile?.default_invoice_notes ?? "");
  const [currency, setCurrency] = useState(
    contractData?.currency ?? milestoneData?.currency ?? profile?.default_currency ?? "PHP"
  );
  const [taxRate, setTaxRate] = useState(0);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  function buildInitialItems(): LineItem[] {
    if (contractData) {
      if (contractData.type === "hourly") {
        return [{
          description: `${contractData.name} - hours`,
          quantity: 0,
          unit_price: contractData.rate ?? 0,
        }];
      } else {
        const cycleLabel = contractData.billing_cycle.replace(/\b\w/g, (l) => l.toUpperCase());
        return [{
          description: `${contractData.name} - ${cycleLabel} payment`,
          quantity: 1,
          unit_price: contractData.fixed_amount ?? 0,
        }];
      }
    }
    if (milestoneData) {
      return [{
        description: milestoneData.description
          ? `${milestoneData.name} - ${milestoneData.description}`
          : milestoneData.name,
        quantity: 1,
        unit_price: milestoneData.amount,
      }];
    }
    return [{ description: "", quantity: 1, unit_price: 0 }];
  }

  const [items, setItems] = useState<LineItem[]>(buildInitialItems());
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(milestoneId ?? "");
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTimeImport, setShowTimeImport] = useState(false);
  const [importProjectId, setImportProjectId] = useState("");
  const [importEntries, setImportEntries] = useState<TimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Filter projects by selected client
  const filteredProjects = clientId
    ? projects.filter((p) => p.client_id === clientId)
    : projects;

  // Filter contracts by selected client
  const filteredContracts = clientId
    ? contracts.filter((c) => c.client_id === clientId)
    : contracts;

  // Fetch milestones when project changes
  const fetchMilestones = useCallback(async (projId: string) => {
    if (!projId) {
      setMilestones([]);
      return;
    }
    setLoadingMilestones(true);
    const supabase = createClient();

    // Fetch available milestones (not yet invoiced/paid)
    const { data } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projId)
      .in("status", ["pending", "in_progress", "completed"])
      .order("sort_order");

    let results = data ?? [];

    // If a milestone was pre-selected (from milestone card), ensure it's in the list
    if (milestoneId && !results.some((m) => m.id === milestoneId)) {
      const { data: current } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("id", milestoneId)
        .single();
      if (current) {
        results = [current, ...results];
      }
    }

    setMilestones(results);
    setLoadingMilestones(false);
  }, [milestoneId]);

  useEffect(() => {
    if (projectId) {
      fetchMilestones(projectId);
    }
  }, [projectId, fetchMilestones]);

  function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    // Clear project and milestone if the new client doesn't match
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.client_id !== newClientId) {
        setProjectId("");
        setSelectedMilestoneId("");
        setMilestones([]);
      }
    }
    // Clear contract if the new client doesn't match
    if (selectedContractId) {
      const contract = contracts.find((c) => c.id === selectedContractId);
      if (contract?.client_id !== newClientId) {
        setSelectedContractId("");
      }
    }
  }

  function handleProjectChange(newProjectId: string) {
    const actualId = newProjectId === "__none__" ? "" : newProjectId;
    setProjectId(actualId);
    setSelectedMilestoneId("");

    if (actualId) {
      // Auto-set client from project
      const project = projects.find((p) => p.id === actualId);
      if (project?.client_id && !clientId) {
        setClientId(project.client_id);
      }
      fetchMilestones(actualId);
    } else {
      setMilestones([]);
    }
  }

  function handleMilestoneChange(newMilestoneId: string) {
    const actualId = newMilestoneId === "__none__" ? "" : newMilestoneId;
    setSelectedMilestoneId(actualId);

    if (actualId) {
      const milestone = milestones.find((m) => m.id === actualId);
      if (milestone) {
        // Pre-fill line items with milestone data
        setItems([
          {
            description: milestone.description
              ? `${milestone.name} - ${milestone.description}`
              : milestone.name,
            quantity: 1,
            unit_price: milestone.amount,
          },
        ]);
        setCurrency(milestone.currency);
      }
    }
  }

  function handleContractChange(newContractId: string) {
    const actualId = newContractId === "__none__" ? "" : newContractId;
    setSelectedContractId(actualId);

    if (actualId) {
      const contract = contracts.find((c) => c.id === actualId);
      if (contract) {
        // Auto-set client from contract
        if (contract.client_id && !clientId) {
          setClientId(contract.client_id);
        }
        setCurrency(contract.currency);

        if (contract.type === "hourly") {
          setItems([{
            description: `${contract.name} - hours`,
            quantity: 0,
            unit_price: contract.rate ?? 0,
          }]);
        } else {
          const cycleLabel = contract.billing_cycle.replace(/\b\w/g, (l) => l.toUpperCase());
          setItems([{
            description: `${contract.name} - ${cycleLabel} payment`,
            quantity: 1,
            unit_price: contract.fixed_amount ?? 0,
          }]);
        }
      }
    }
  }

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
        milestone_id: selectedMilestoneId || milestoneId || null,
        contract_id: selectedContractId || initialContractId || null,
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
        exchange_rate: currency !== "PHP" ? exchangeRate : null,
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

    // Update milestone status to "invoiced" if linked to a milestone
    const linkedMilestoneId = selectedMilestoneId || milestoneId;
    if (linkedMilestoneId) {
      await supabase
        .from("project_milestones")
        .update({ status: "invoiced" })
        .eq("id", linkedMilestoneId);
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
              <Select value={clientId} onValueChange={handleClientChange}>
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
            <div className="space-y-2">
              <Label>Project <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={projectId || "__none__"} onValueChange={handleProjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {filteredProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectId && (
              <div className="space-y-2">
                <Label>Milestone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={selectedMilestoneId || "__none__"}
                  onValueChange={handleMilestoneChange}
                  disabled={loadingMilestones}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingMilestones ? "Loading..." : "Select milestone"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No milestone</SelectItem>
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {formatCurrency(m.amount, m.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Contract <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={selectedContractId || "__none__"} onValueChange={handleContractChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contract" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No contract</SelectItem>
                  {filteredContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type === "hourly" ? "Hourly" : "Fixed"})
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
            <div className={`grid gap-3 ${currency !== "PHP" ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(val) => {
                  setCurrency(val);
                  if (val === "PHP") setExchangeRate(null);
                }}>
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
              {currency !== "PHP" && (
                <div className="space-y-2">
                  <Label>1 {currency} = ? PHP</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 56.00"
                    value={exchangeRate ?? ""}
                    onChange={(e) => setExchangeRate(e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}
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
            {currency !== "PHP" && exchangeRate && exchangeRate > 0 && (
              <div className="flex gap-8 text-sm text-muted-foreground">
                <span>PHP Equivalent</span>
                <span>{formatCurrency(total * exchangeRate, "PHP")}</span>
              </div>
            )}
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
