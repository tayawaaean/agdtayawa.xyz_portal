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
import { Pencil, Trash2, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, BILLING_CYCLES } from "@/lib/constants";
import type { Contract, Invoice } from "@/lib/types";
import { ContractForm } from "./contract-form";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";

const PAGE_SIZE = 10;

interface ContractDetailProps {
  contract: Contract & { client?: { id: string; company_name: string } | null };
  clients: { id: string; company_name: string }[];
  invoices: (Invoice & { client?: { company_name: string } | null })[];
  userId: string;
}

export function ContractDetail({
  contract,
  clients,
  invoices,
  userId,
}: ContractDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [invoicePage, setInvoicePage] = useState(0);

  const invoiceTotalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice(invoicePage * PAGE_SIZE, (invoicePage + 1) * PAGE_SIZE);

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", contract.id);

    if (error) {
      toast.error("Failed to delete contract: " + error.message);
    } else {
      toast.success("Contract deleted");
      router.push("/contracts");
      router.refresh();
    }
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function formatBillingCycle(cycle: string): string {
    return BILLING_CYCLES.find((b) => b.value === cycle)?.label ?? cycle;
  }

  return (
    <div className="space-y-6">
      {/* Contract Info */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{contract.name}</CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="secondary"
                className={STATUS_COLORS[contract.status] || ""}
              >
                {formatStatus(contract.status)}
              </Badge>
              <Badge variant="outline">
                {contract.type === "hourly" ? "Hourly" : "Fixed"}
              </Badge>
              <Badge variant="outline">
                {formatBillingCycle(contract.billing_cycle)}
              </Badge>
              {contract.client && (
                <span className="text-sm text-muted-foreground">
                  {contract.client.company_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <NewInvoiceDialog
              userId={userId}
              contractId={contract.id}
              contractData={{
                name: contract.name,
                type: contract.type,
                billing_cycle: contract.billing_cycle,
                rate: contract.rate,
                fixed_amount: contract.fixed_amount,
                currency: contract.currency,
              }}
              contractClientId={contract.client_id}
              trigger={
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  Create Invoice
                </Button>
              }
            />
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
          {contract.description && (
            <p className="text-sm text-muted-foreground mb-4">
              {contract.description}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {contract.type === "hourly" ? "Hourly Rate" : "Fixed Amount"}
              </p>
              <p className="text-lg font-bold">
                {contract.type === "hourly"
                  ? contract.rate
                    ? `${formatCurrency(contract.rate, contract.currency)}/hr`
                    : "-"
                  : contract.fixed_amount
                    ? formatCurrency(contract.fixed_amount, contract.currency)
                    : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-lg font-bold">{formatCurrency(totalInvoiced, contract.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold">{formatCurrency(totalPaid, contract.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoices</p>
              <p className="text-lg font-bold">{invoices.length}</p>
            </div>
          </div>
          {(contract.start_date || contract.end_date) && (
            <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
              {contract.start_date && (
                <span>Start: {formatDate(contract.start_date)}</span>
              )}
              {contract.end_date && (
                <span>End: {formatDate(contract.end_date)}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Invoices ({invoices.length})
          </CardTitle>
          <NewInvoiceDialog
            userId={userId}
            contractId={contract.id}
            contractData={{
              name: contract.name,
              type: contract.type,
              billing_cycle: contract.billing_cycle,
              rate: contract.rate,
              fixed_amount: contract.fixed_amount,
              currency: contract.currency,
            }}
            contractClientId={contract.client_id}
            trigger={
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No invoices yet for this contract.
            </p>
          ) : (
            <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden md:table-cell">Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
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
                          className={STATUS_COLORS[inv.status] || ""}
                        >
                          {formatStatus(inv.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {invoices.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {invoicePage * PAGE_SIZE + 1}–{Math.min((invoicePage + 1) * PAGE_SIZE, invoices.length)} of {invoices.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInvoicePage((p) => p - 1)} disabled={invoicePage === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">{invoicePage + 1} / {invoiceTotalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setInvoicePage((p) => p + 1)} disabled={invoicePage >= invoiceTotalPages - 1}>
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

      {/* Edit Contract Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>
              Update the details for {contract.name}.
            </DialogDescription>
          </DialogHeader>
          <ContractForm
            clients={clients}
            userId={userId}
            contract={contract}
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Contract Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contract</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{contract.name}&quot;?
              This will not delete associated invoices, but they will no longer be linked to this contract.
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
    </div>
  );
}
