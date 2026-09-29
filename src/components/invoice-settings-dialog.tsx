import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import type { BusinessSettings } from "@/lib/inventory";

const FIELDS: { key: keyof BusinessSettings; label: string; placeholder?: string; multiline?: boolean }[] = [
  { key: "business_name", label: "Business name" },
  { key: "contact_name", label: "Contact name", placeholder: "Printed above your phone number" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email or Instagram" },
  { key: "address", label: "Address", multiline: true },
  { key: "invoice_footer", label: "Invoice footer" },
];

const inputClass =
  "rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]";

export function InvoiceSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [values, setValues] = useState<BusinessSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api
      .get<BusinessSettings>("/admin/orders/settings")
      .then(setValues)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load settings"));
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values) return;
    if (!values.business_name.trim()) {
      setError("Business name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put("/admin/orders/settings", values);
      toast.success("Invoice details saved");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice details</DialogTitle>
          <DialogDescription>Printed at the top and bottom of every invoice.</DialogDescription>
        </DialogHeader>
        {!values ? (
          error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            {error && <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label htmlFor={`settings-${f.key}`} className="text-sm font-medium">{f.label}</label>
                {f.multiline ? (
                  <textarea
                    id={`settings-${f.key}`}
                    rows={2}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className={inputClass}
                  />
                ) : (
                  <input
                    id={`settings-${f.key}`}
                    value={values[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
            <Button type="submit" variant="accent" disabled={saving} className="mt-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
