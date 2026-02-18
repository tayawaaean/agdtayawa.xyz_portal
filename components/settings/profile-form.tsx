"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Profile, PaymentMethodConfig, ExpenseCategory } from "@/lib/types";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { ExpenseCategories } from "./expense-categories";
import { AccountForm } from "./account-form";

const profileSchema = z.object({
  business_name: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  tax_id_tin: z.string().optional(),
  default_currency: z.string().default("PHP"),
  default_hourly_rate: z.coerce.number().min(0).optional().or(z.literal("")),
  tax_regime: z.enum(["eight_percent", "graduated"]).default("eight_percent"),
  default_payment_terms: z.string().optional(),
  default_invoice_notes: z.string().optional(),
  invoice_prefix: z.string().default("INV"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: Profile | null;
  userId: string;
  userEmail: string;
  categories: ExpenseCategory[];
}

export function ProfileForm({ profile, userId, userEmail, categories }: ProfileFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      business_name: profile?.business_name ?? "",
      full_name: profile?.full_name ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
      tax_id_tin: profile?.tax_id_tin ?? "",
      default_currency: profile?.default_currency ?? "PHP",
      default_hourly_rate: profile?.default_hourly_rate ?? "",
      tax_regime: profile?.tax_regime ?? "eight_percent",
      default_payment_terms: profile?.default_payment_terms ?? "Due within 30 days",
      default_invoice_notes: profile?.default_invoice_notes ?? "",
      invoice_prefix: profile?.invoice_prefix ?? "INV",
    },
  });

  const taxRegime = watch("tax_regime");
  const currency = watch("default_currency");

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(
    profile?.payment_methods ?? []
  );

  function addPaymentMethod() {
    setPaymentMethods([
      ...paymentMethods,
      { type: "bank_transfer", label: "", details: "", enabled: true },
    ]);
  }

  function updatePaymentMethod(
    index: number,
    field: keyof PaymentMethodConfig,
    value: string | boolean
  ) {
    setPaymentMethods(
      paymentMethods.map((pm, i) =>
        i === index ? { ...pm, [field]: value } : pm
      )
    );
  }

  function removePaymentMethod(index: number) {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  }

  async function onSubmit(data: ProfileFormData) {
    const supabase = createClient();

    const updateData = {
      ...data,
      default_hourly_rate: data.default_hourly_rate === "" ? null : Number(data.default_hourly_rate),
      payment_methods: paymentMethods,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved successfully");
    }
  }

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="tax">Tax</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* ── Profile Tab ── */}
        <TabsContent value="profile" className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Business Profile</h3>
              <p className="text-xs text-muted-foreground">Your business and contact information.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input id="business_name" {...register("business_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" {...register("full_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" rows={2} {...register("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id_tin">TIN (Tax ID Number)</Label>
                <Input id="tax_id_tin" {...register("tax_id_tin")} placeholder="000-000-000-000" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Default Rates</h3>
              <p className="text-xs text-muted-foreground">Set your default hourly rate and currency.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default_hourly_rate">Default Hourly Rate</Label>
                <Input
                  id="default_hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("default_hourly_rate")}
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(val) => setValue("default_currency", val)}
                >
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
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </TabsContent>

        {/* ── Invoicing Tab ── */}
        <TabsContent value="invoicing" className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-1">Invoice Defaults</h3>
            <p className="text-xs text-muted-foreground">These values are pre-filled when creating new invoices.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
              <Input id="invoice_prefix" {...register("invoice_prefix")} placeholder="INV" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_payment_terms">Payment Terms</Label>
              <Input
                id="default_payment_terms"
                {...register("default_payment_terms")}
                placeholder="Due within 30 days"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_invoice_notes">Default Invoice Notes</Label>
            <Textarea
              id="default_invoice_notes"
              rows={3}
              {...register("default_invoice_notes")}
              placeholder="Thank you for your business!"
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </TabsContent>

        {/* ── Payments Tab ── */}
        <TabsContent value="payments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium mb-1">Payment Methods</h3>
              <p className="text-xs text-muted-foreground">Enabled methods will appear on all your invoices and PDFs.</p>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={addPaymentMethod}>
              <Plus className="mr-2 h-4 w-4" />
              Add Method
            </Button>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No payment methods configured. Add one so clients know how to pay you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((pm, index) => (
                <div key={index} className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Select
                        value={pm.type}
                        onValueChange={(val) => updatePaymentMethod(index, "type", val)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={pm.enabled}
                          onChange={(e) => updatePaymentMethod(index, "enabled", e.target.checked)}
                          className="rounded"
                        />
                        Show on invoices
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removePaymentMethod(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={pm.label}
                      onChange={(e) => updatePaymentMethod(index, "label", e.target.value)}
                      placeholder="e.g., BDO Savings Account, PayPal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Details</Label>
                    <Textarea
                      value={pm.details}
                      onChange={(e) => updatePaymentMethod(index, "details", e.target.value)}
                      rows={3}
                      placeholder={"Account Name: Juan Dela Cruz\nAccount Number: 1234-5678-9012\nBank: BDO Unibank"}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </TabsContent>

        {/* ── Tax Tab ── */}
        <TabsContent value="tax" className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-1">Tax Settings</h3>
            <p className="text-xs text-muted-foreground">Configure your tax regime for Philippine BIR compliance.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tax Regime</Label>
              <Select
                value={taxRegime}
                onValueChange={(val) =>
                  setValue("tax_regime", val as "eight_percent" | "graduated")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eight_percent">8% Flat Rate</SelectItem>
                  <SelectItem value="graduated">Graduated Rates</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {taxRegime === "eight_percent"
                  ? "8% on gross sales minus 250K exemption. No expense deductions."
                  : "Graduated brackets on net income (revenue - expenses) + 3% percentage tax."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>VAT Threshold</Label>
              <Input value="3,000,000 PHP" disabled />
              <p className="text-xs text-muted-foreground">
                You&apos;ll be warned when approaching this limit.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </TabsContent>
      </form>

      {/* ── Categories Tab (outside form, managed separately) ── */}
      <TabsContent value="categories">
        <ExpenseCategories categories={categories} userId={userId} />
      </TabsContent>

      {/* ── Account Tab (outside form, managed separately) ── */}
      <TabsContent value="account">
        <AccountForm userEmail={userEmail} />
      </TabsContent>
    </Tabs>
  );
}
