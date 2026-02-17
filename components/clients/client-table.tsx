"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Trash2, Pencil, ChevronLeft, ChevronRight, Loader2, Users, UserCheck, PauseCircle, CheckCircle2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Client, ClientStatus } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";

const PAGE_SIZE = 10;

interface ClientTableProps {
  clients: Client[];
}

export function ClientTable({ clients: initialClients }: ClientTableProps) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editCompany, setEditCompany] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStatus, setEditStatus] = useState<ClientStatus>("active");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  // Realtime subscription for clients table
  const userId = initialClients[0]?.user_id;
  useRealtime<Client>({
    table: "clients",
    ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
    onInsert: useCallback((record: Client) => {
      setClients((prev) => {
        if (prev.some((c) => c.id === record.id)) return prev;
        return [record, ...prev];
      });
    }, []),
    onUpdate: useCallback((record: Client) => {
      setClients((prev) =>
        prev.map((c) => (c.id === record.id ? { ...c, ...record } : c))
      );
    }, []),
    onDelete: useCallback((record: Client) => {
      setClients((prev) => prev.filter((c) => c.id !== record.id));
    }, []),
  });

  const statusCounts = {
    all: clients.length,
    active: clients.filter((c) => c.status === "active").length,
    on_hold: clients.filter((c) => c.status === "on_hold").length,
    completed: clients.filter((c) => c.status === "completed").length,
    prospect: clients.filter((c) => c.status === "prospect").length,
  };

  const filtered = clients.filter((client) => {
    const matchesSearch =
      client.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (client.contact_name?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesStatus =
      statusFilter === "all" || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedClients = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleDelete() {
    if (!deleteId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete client: " + error.message);
    } else {
      setClients((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success("Client deleted");
    }
    setDeleteId(null);
  }

  function openEdit(client: Client) {
    setEditClient(client);
    setEditCompany(client.company_name);
    setEditContact(client.contact_name || "");
    setEditEmail(client.email || "");
    setEditPhone(client.phone || "");
    setEditStatus(client.status);
  }

  async function handleEdit() {
    if (!editClient) return;
    if (!editCompany.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        company_name: editCompany.trim(),
        contact_name: editContact.trim() || null,
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        status: editStatus,
      })
      .eq("id", editClient.id);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editClient.id
            ? {
                ...c,
                company_name: editCompany.trim(),
                contact_name: editContact.trim() || null,
                email: editEmail.trim() || null,
                phone: editPhone.trim() || null,
                status: editStatus,
              }
            : c
        )
      );
      toast.success("Client updated");
      setEditClient(null);
    }
    setSaving(false);
  }

  function formatStatus(status: ClientStatus): string {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <div className="rounded-lg bg-gray-100 p-2">
              <Users className="h-4 w-4 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.all}</p>
            <p className="text-xs text-muted-foreground mt-1">All clients</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.active}</p>
            <p className="text-xs text-muted-foreground mt-1">Ongoing work</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Hold</CardTitle>
            <div className="rounded-lg bg-amber-50 p-2">
              <PauseCircle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.on_hold}</p>
            <p className="text-xs text-muted-foreground mt-1">Paused</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <div className="rounded-lg bg-blue-50 p-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.completed}</p>
            <p className="text-xs text-muted-foreground mt-1">Finished</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden gap-2 py-4 col-span-2 lg:col-span-1">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prospect</CardTitle>
            <div className="rounded-lg bg-violet-50 p-2">
              <UserPlus className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{statusCounts.prospect}</p>
            <p className="text-xs text-muted-foreground mt-1">Potential clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="on_hold">On Hold</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="prospect">Prospect</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {clients.length === 0
              ? "No clients yet. Add your first client to get started!"
              : "No clients match your search."}
          </p>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">
                    {client.company_name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {client.contact_name || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[client.status] || ""}
                    >
                      {formatStatus(client.status)}
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
                          openEdit(client);
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
                          setDeleteId(client.id);
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
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update the details for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Company name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={editContact} onChange={(e) => setEditContact(e.target.value)} placeholder="Contact person" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ClientStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
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
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this client? This will also remove
              their associated projects and invoices. This action cannot be
              undone.
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
    </div>
  );
}
