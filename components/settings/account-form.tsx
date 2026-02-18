"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";

interface AccountFormProps {
  userEmail: string;
}

export function AccountForm({ userEmail }: AccountFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }

    if (!newEmail && !newPassword) {
      toast.error("Enter a new email or password to update");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newEmail: newEmail || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to update account");
        return;
      }

      toast.success("Account updated. Please sign in again.");
      setCurrentPassword("");
      setNewEmail("");
      setNewPassword("");
      setConfirmPassword("");

      // Sign out so the user re-authenticates with new credentials
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Change Email</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Current login email: <span className="font-medium">{userEmail}</span>
        </p>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="new_email">New Email</Label>
          <Input
            id="new_email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Leave blank to keep current"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-1">Change Password</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Password must be at least 8 characters.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-1">Verify Identity</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Enter your current password to confirm changes.
        </p>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="current_password">Current Password</Label>
          <Input
            id="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update Account
      </Button>
    </form>
  );
}
