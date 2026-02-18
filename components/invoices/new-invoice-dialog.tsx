"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InvoiceBuilder } from "./invoice-builder";
import type { Profile } from "@/lib/types";

interface NewInvoiceDialogProps {
  userId: string;
  trigger?: React.ReactNode;
  contractId?: string;
  contractData?: {
    name: string;
    type: "hourly" | "fixed";
    billing_cycle: string;
    rate: number | null;
    fixed_amount: number | null;
    currency: string;
  };
  contractClientId?: string;
}

export function NewInvoiceDialog({ userId, trigger, contractId, contractData, contractClientId }: NewInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<
    { id: string; company_name: string; email: string | null; address: string | null }[]
  >([]);
  const [projects, setProjects] = useState<
    { id: string; name: string; rate: number | null; client_id: string | null }[]
  >([]);
  const [contracts, setContracts] = useState<
    { id: string; name: string; type: "hourly" | "fixed"; billing_cycle: string; rate: number | null; fixed_amount: number | null; currency: string; client_id: string }[]
  >([]);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      return;
    }
    const supabase = createClient();

    Promise.all([
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
        .from("contracts")
        .select("id, name, type, billing_cycle, rate, fixed_amount, currency, client_id")
        .eq("status", "active")
        .order("name"),
    ]).then(([profRes, clientRes, projRes, lastInvRes, contractRes]) => {
      setProfile(profRes.data);
      setClients(clientRes.data ?? []);
      setProjects(projRes.data ?? []);
      setContracts(contractRes.data ?? []);
      setLastInvoiceNumber(lastInvRes.data?.invoice_number ?? null);
      setLoaded(true);
    });
  }, [open, userId]);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      )}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for a client.
          </DialogDescription>
        </DialogHeader>
        {loaded ? (
          <InvoiceBuilder
            userId={userId}
            profile={profile}
            clients={clients}
            projects={projects}
            contracts={contracts}
            lastInvoiceNumber={lastInvoiceNumber}
            variant="modal"
            onSuccess={handleSuccess}
            contractId={contractId}
            contractData={contractData}
            contractClientId={contractClientId}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
