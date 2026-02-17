"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Download,
  Send,
  CreditCard,
  Loader2,
  Ban,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, PAYMENT_METHODS } from "@/lib/constants";
import type { Invoice, InvoiceItem, Payment, Profile } from "@/lib/types";

interface InvoiceDetailProps {
  invoice: Invoice & {
    client?: {
      company_name: string;
      email: string | null;
      address: string | null;
      contact_name: string | null;
    } | null;
    items: InvoiceItem[];
    payments: Payment[];
  };
  profile: Profile | null;
  userId: string;
}

export function InvoiceDetail({
  invoice: initialInvoice,
  profile,
  userId,
}: InvoiceDetailProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [payMethod, setPayMethod] = useState("");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = invoice.total - totalPaid;

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  async function updateStatus(status: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoice.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      setInvoice({ ...invoice, status: status as Invoice["status"] });
      toast.success(`Invoice marked as ${status}`);
      router.refresh();
    }
  }

  async function recordPayment() {
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        invoice_id: invoice.id,
        amount: Number(payAmount),
        date: payDate,
        method: payMethod || null,
        reference_note: payRef || null,
      })
      .select()
      .single();

    if (error || !payment) {
      toast.error("Failed to record payment");
      setSaving(false);
      return;
    }

    const newPayments = [...invoice.payments, payment];
    const newTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);

    // Auto-update status if fully paid
    if (newTotalPaid >= invoice.total) {
      await supabase
        .from("invoices")
        .update({ status: "paid" })
        .eq("id", invoice.id);
      setInvoice({ ...invoice, status: "paid", payments: newPayments });
    } else {
      setInvoice({ ...invoice, payments: newPayments });
    }

    toast.success("Payment recorded");
    setShowPayment(false);
    setPayAmount("");
    setPayRef("");
    setSaving(false);
    router.refresh();
  }

  async function handleDownloadPdf() {
    // Dynamic import to avoid SSR issues
    const { generateInvoicePdf } = await import("./pdf-generator");
    await generateInvoicePdf(invoice, profile);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {invoice.status === "draft" && (
          <Button size="sm" onClick={() => updateStatus("sent")}>
            <Send className="mr-2 h-4 w-4" />
            Mark as Sent
          </Button>
        )}
        {!["paid", "cancelled"].includes(invoice.status) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPayAmount(remaining.toString());
              setShowPayment(true);
            }}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        {invoice.status !== "cancelled" && invoice.status !== "paid" && (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => updateStatus("cancelled")}
          >
            <Ban className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>

      {/* Invoice Preview */}
      <Card>
        <CardContent className="p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                {profile?.business_name || profile?.full_name || "FreelanceHub"}
              </h2>
              {profile?.email && (
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              )}
              {profile?.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
              {profile?.address && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {profile.address}
                </p>
              )}
              {profile?.tax_id_tin && (
                <p className="text-sm text-muted-foreground">
                  TIN: {profile.tax_id_tin}
                </p>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold text-muted-foreground">
                INVOICE
              </h3>
              <p className="text-lg font-medium">{invoice.invoice_number}</p>
              <Badge
                variant="secondary"
                className={`mt-2 ${STATUS_COLORS[invoice.status] || ""}`}
              >
                {formatStatus(invoice.status)}
              </Badge>
              {totalPaid > 0 && totalPaid < invoice.total && (
                <Badge variant="outline" className="mt-1 ml-2">
                  Partially Paid
                </Badge>
              )}
            </div>
          </div>

          {/* Bill To + Dates */}
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-1">
                Bill To
              </p>
              <p className="font-medium">
                {invoice.client?.company_name ?? "—"}
              </p>
              {invoice.client?.contact_name && (
                <p className="text-sm">{invoice.client.contact_name}</p>
              )}
              {invoice.client?.email && (
                <p className="text-sm text-muted-foreground">
                  {invoice.client.email}
                </p>
              )}
              {invoice.client?.address && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {invoice.client.address}
                </p>
              )}
            </div>
            <div className="text-sm space-y-1 sm:text-right">
              <p>
                <span className="text-muted-foreground">Issue Date:</span>{" "}
                {formatDate(invoice.issue_date)}
              </p>
              {invoice.due_date && (
                <p>
                  <span className="text-muted-foreground">Due Date:</span>{" "}
                  {formatDate(invoice.due_date)}
                </p>
              )}
              {invoice.payment_terms && (
                <p>
                  <span className="text-muted-foreground">Terms:</span>{" "}
                  {invoice.payment_terms}
                </p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-md border mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_price, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount, invoice.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end space-y-1 text-sm mb-6">
            <div className="flex gap-8">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">
                  Tax ({(invoice.tax_rate * 100).toFixed(1)}%)
                </span>
                <span>{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex gap-8 text-lg font-bold border-t pt-1">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex gap-8 text-green-600">
                  <span>Paid</span>
                  <span>- {formatCurrency(totalPaid, invoice.currency)}</span>
                </div>
                <div className="flex gap-8 font-bold">
                  <span>Balance Due</span>
                  <span>{formatCurrency(remaining, invoice.currency)}</span>
                </div>
              </>
            )}
          </div>

          {/* Payment Methods */}
          {profile?.payment_methods?.filter((pm) => pm.enabled).length ? (
            <div>
              <Separator className="mb-4" />
              <p className="text-xs text-muted-foreground uppercase mb-2">
                Payment Methods
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {profile.payment_methods
                  .filter((pm) => pm.enabled)
                  .map((pm, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">{pm.label}</p>
                      <p className="text-muted-foreground whitespace-pre-line">
                        {pm.details}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {invoice.notes && (
            <div>
              <Separator className="mb-4" />
              <p className="text-xs text-muted-foreground uppercase mb-1">
                Notes
              </p>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        {payment.method
                          ? PAYMENT_METHODS.find(
                              (m) => m.value === payment.method
                            )?.label ?? payment.method
                          : "-"}
                      </TableCell>
                      <TableCell>{payment.reference_note || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amount, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Remaining balance: {formatCurrency(remaining, invoice.currency)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference / Note</Label>
              <Input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Transaction ID, check number, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={recordPayment}
              disabled={saving || !payAmount}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
