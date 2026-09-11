import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface FieldErrors {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!currentPassword) errors.current_password = "Enter your current password";
    if (newPassword.length < 8) errors.new_password = "At least 8 characters";
    if (newPassword !== confirmPassword) errors.confirm_password = "Passwords don't match";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/admin/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed");
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="current-password" className="text-sm font-medium">
              Current password
            </label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={cn(
                "w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                fieldErrors.current_password
                  ? "border-destructive focus:ring-destructive"
                  : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
              )}
            />
            {fieldErrors.current_password && (
              <p className="text-xs text-destructive">{fieldErrors.current_password}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-sm font-medium">
              New password
            </label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={cn(
                "w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                fieldErrors.new_password
                  ? "border-destructive focus:ring-destructive"
                  : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
              )}
            />
            {fieldErrors.new_password && (
              <p className="text-xs text-destructive">{fieldErrors.new_password}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm new password
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(
                "w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                fieldErrors.confirm_password
                  ? "border-destructive focus:ring-destructive"
                  : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
              )}
            />
            {fieldErrors.confirm_password && (
              <p className="text-xs text-destructive">{fieldErrors.confirm_password}</p>
            )}
          </div>

          <Button type="submit" variant="accent" disabled={submitting} className="mt-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving..." : "Change password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
