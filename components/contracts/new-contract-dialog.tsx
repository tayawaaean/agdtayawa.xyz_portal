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
import { ContractForm } from "./contract-form";

interface NewContractDialogProps {
  userId: string;
  trigger?: React.ReactNode;
}

export function NewContractDialog({ userId, trigger }: NewContractDialogProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [clients, setClients] = useState<
    { id: string; company_name: string }[]
  >([]);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      return;
    }
    const supabase = createClient();

    supabase
      .from("clients")
      .select("id, company_name")
      .eq("status", "active")
      .order("company_name")
      .then(({ data }) => {
        setClients(data ?? []);
        setLoaded(true);
      });
  }, [open]);

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
          New Contract
        </Button>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
          <DialogDescription>
            Create a new recurring billing contract.
          </DialogDescription>
        </DialogHeader>
        {loaded ? (
          <ContractForm
            clients={clients}
            userId={userId}
            onSuccess={handleSuccess}
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
