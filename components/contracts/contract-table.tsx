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
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Loader2, FileCheck2, PlayCircle, PauseCircle, StopCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { STATUS_COLORS, CURRENCIES, BILLING_CYCLES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { Contract, ContractType, ContractStatus, BillingCycle } from "@/lib/types";
import { NewContractDialog } from "./new-contract-dialog";

const PAGE_SIZE = 10;

type ContractWithClient = Contract & { client?: { id: string; company_name: string } | null };

interface ContractTableProps {
  contracts: ContractWithClient[];
  userId: string;
}

export function ContractTable({
  contracts: initialContracts,
  userId,
}: ContractTableProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState(initialContracts);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editContract, setEditContract] = useState<ContractWithClient | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<ContractType>("hourly");
  const [editStatus, setEditStatus] = useState<ContractStatus>("active");
  const [editBillingCycle, setEditBillingCycle] = useState<BillingCycle>("weekly");
  const [editRate, setEditRate] = useState("");
  const [editFixedAmount, setEditFixedAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("PHP");
  const [saving, setSaving] = useState(false);

  useRealtime<Contract>({
    table: "contracts",
    filter: `user_id=eq.${userId}`,
    onInsert: useCallback(async (record: Contract) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("contracts")
        .select("*, client:clients(id, company_name)")
        .eq("id", record.id)
        .single();
      if (data) {
        setContracts((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev;
          return [data as ContractWithClient, ...prev];
        });
      }
    }, []),
    onUpdate: useCallback((record: Contract) => {
      setContracts((prev) =>
        prev.map((c) => {
          if (c.id !== record.id) return c;
          const { client: _, ...fields } = record as any;
          return { ...c, ...fields };
        })
      );
    }, []),
    onDelete: useCallback((record: Contract) => {
      setContracts((prev) => prev.filter((c) => c.id !== record.id));
    }, []),
  });

  const statusCounts = {
    all: contracts.length,
    active: contracts.filter((c) => c.status === "active").length,
    paused: contracts.filter((c) => c.status === "paused").length,
    ended: contracts.filter((c) => c.status === "ended").length,
  };

  const filtered = contracts.filter(
    (c) => statusFilter === "all" || c.status === statusFilter
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedContracts = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openEdit(contract: ContractWithClient) {
    setEditContract(contract);
    setEditName(contract.name);
    setEditType(contract.type);
    setEditStatus(contract.status);
    setEditBillingCycle(contract.billing_cycle);
    setEditRate(contract.rate?.toString() || "");
    setEditFixedAmount(contract.fixed_amount?.toString() || "");
    setEditCurrency(contract.currency || "PHP");
  }

  async function handleEdit() {
    if (!editContract) return;
    if (!editName.trim()) {
      toast.error("Contract name is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const rate = editType === "hourly" && editRate ? Number(editRate) : null;
    const fixedAmount = editType === "fixed" && editFixedAmount ? Number(editFixedAmount) : null;
    const { error } = await supabase
      .from("contracts")
      .update({
        name: editName.trim(),
        type: editType,
        status: editStatus,
        billing_cycle: editBillingCycle,
        rate,
        fixed_amount: fixedAmount,
        currency: editCurrency,
      })
      .eq("id", editContract.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setContracts((prev) =>
        prev.map((c) =>
          c.id === editContract.id
            ? { ...c, name: editName.trim(), type: editType, status: editStatus, billing_cycle: editBillingCycle, rate, fixed_amount: fixedAmount, currency: editCurrency }
            : c
        )
      );
      toast.success("Contract updated");
      setEditContract(null);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete: " + error.message);
    } else {
      setContracts((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success("Contract deleted");
    }
    setDeleteId(null);
  }

  function formatStatus(status: string): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function formatBillingCycle(cycle: string): string {
    return BILLING_CYCLES.find((b) => b.value === cycle)?.label ?? cycle;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contracts</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <FileCheck2 className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.all}</p>
            <p className="text-xs text-muted-foreground mt-1">All contracts</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <div className="rounded-lg bg-green-50 p-2">
              <PlayCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.active}</p>
            <p className="text-xs text-muted-foreground mt-1">Currently billing</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paused</CardTitle>
            <div className="rounded-lg bg-orange-50 p-2">
              <PauseCircle className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.paused}</p>
            <p className="text-xs text-muted-foreground mt-1">On hold</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ended</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <StopCircle className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.ended}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="paused">Paused</TabsTrigger>
          <TabsTrigger value="ended">Ended</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {contracts.length === 0
              ? "No contracts yet. Create your first contract!"
              : "No contracts match this filter."}
          </p>
          {contracts.length === 0 && (
            <div className="mt-4">
              <NewContractDialog
                userId={userId}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Contract
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
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Billing Cycle</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Rate / Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContracts.map((contract) => (
                <TableRow
                  key={contract.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contracts/${contract.id}`)}
                >
                  <TableCell className="font-medium">{contract.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {contract.client?.company_name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {contract.type === "hourly" ? "Hourly" : "Fixed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatBillingCycle(contract.billing_cycle)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    {contract.type === "hourly"
                      ? contract.rate
                        ? `${formatCurrency(contract.rate, contract.currency)}/hr`
                        : "-"
                      : contract.fixed_amount
                        ? formatCurrency(contract.fixed_amount, contract.currency)
                        : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[contract.status] || ""}
                    >
                      {formatStatus(contract.status)}
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
                          openEdit(contract);
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
                          setDeleteId(contract.id);
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
      <Dialog open={!!editContract} onOpenChange={() => setEditContract(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>
              Update the details for this contract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Contract name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v as ContractType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ContractStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={editBillingCycle} onValueChange={(v) => setEditBillingCycle(v as BillingCycle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{editType === "hourly" ? "Hourly Rate" : "Fixed Amount"}</Label>
                {editType === "hourly" ? (
                  <Input type="number" step="0.01" min="0" value={editRate} onChange={(e) => setEditRate(e.target.value)} placeholder="0.00" />
                ) : (
                  <Input type="number" step="0.01" min="0" value={editFixedAmount} onChange={(e) => setEditFixedAmount(e.target.value)} placeholder="0.00" />
                )}
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContract(null)}>Cancel</Button>
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
            <DialogTitle>Delete Contract</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contract? This action cannot be undone.
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
