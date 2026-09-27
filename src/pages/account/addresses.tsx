import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Home, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GradientButton } from "@/components/gradient-button";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { useAddresses, type Address, type AddressInput } from "@/hooks/use-addresses";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman & Nicobar Islands", "Chandigarh", "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

export function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const { addresses, loading, error, create, update, setDefault, remove } = useAddresses();
  const [editing, setEditing] = useState<Address | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!authLoading && !user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-12 md:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Account</Link>{" "}
              / Addresses
            </p>
            <h1 className="mt-1 font-brand text-3xl font-semibold md:text-4xl">
              Delivery Addresses
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Save the places we should ship your pieces to. The default address
              is used automatically at checkout.
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <ErrorCard message={error} />
        ) : addresses.length === 0 ? (
          <EmptyCard onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addresses.map((a) => (
              <AddressCard
                key={a.id}
                address={a}
                onEdit={() => setEditing(a)}
                onSetDefault={async () => {
                  try {
                    await setDefault(a.id);
                    toast.success("Default address updated");
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : "Failed");
                  }
                }}
                onDelete={() => setPendingDelete(a)}
              />
            ))}
          </div>
        )}
      </main>

      <AddressDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        title="Add address"
        onSubmit={async (input) => {
          await create(input);
          toast.success("Address added");
          setShowAdd(false);
        }}
      />

      <AddressDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Edit address"
        initial={editing ?? undefined}
        onSubmit={async (input) => {
          if (!editing) return;
          await update(editing.id, input);
          toast.success("Address updated");
          setEditing(null);
        }}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this address?</AlertDialogTitle>
            <AlertDialogDescription>
              You can always add it back later. This won't affect any past
              orders that used it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                setDeleting(true);
                try {
                  await remove(pendingDelete.id);
                  toast.success("Address deleted");
                  setPendingDelete(null);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Delete failed");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}

function AddressCard({
  address,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  address: Address;
  onEdit: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-[2px_4px_12px_rgba(0,0,0,0.06)]",
        address.is_default ? "border-foreground" : "border-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <p className="font-semibold">{address.recipient_name}</p>
        </div>
        {address.is_default && (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
            <Star className="h-3 w-3 fill-background" />
            Default
          </span>
        )}
      </div>
      <div className="space-y-0.5 text-sm text-muted-foreground">
        <p>{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>
          {address.city}, {address.state} {address.pincode}
        </p>
        {address.landmark && <p className="italic">{address.landmark}</p>}
        <p className="pt-1 text-foreground">{address.phone}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {!address.is_default && (
          <button
            onClick={onSetDefault}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Set as default
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Edit"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            aria-label="Delete"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
      <Home className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-lg font-medium">No addresses saved yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add a shipping address so we know where to send the pieces you order.
      </p>
      <GradientButton onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add your first address
      </GradientButton>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-16 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
      <p className="text-lg font-semibold text-destructive">
        Couldn't load your addresses
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AddressDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial?: Address;
  onSubmit: (input: AddressInput) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <AddressForm
          key={initial?.id ?? "new"}
          initial={initial}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddressForm({
  initial,
  onSubmit,
}: {
  initial?: Address;
  onSubmit: (input: AddressInput) => Promise<void>;
}) {
  const [form, setForm] = useState<AddressInput>({
    recipient_name: initial?.recipient_name ?? "",
    phone: initial?.phone ?? "",
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "Gujarat",
    pincode: initial?.pincode ?? "",
    landmark: initial?.landmark ?? "",
    is_default: initial?.is_default ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handle = (patch: Partial<AddressInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        line2: form.line2?.trim() || null,
        landmark: form.landmark?.trim() || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <FormRow label="Recipient name">
        <input
          required
          value={form.recipient_name}
          onChange={(e) => handle({ recipient_name: e.target.value })}
          className={FIELD}
        />
      </FormRow>
      <FormRow label="Phone">
        <input
          required
          type="tel"
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={(e) => handle({ phone: e.target.value })}
          className={FIELD}
        />
      </FormRow>
      <FormRow label="Address line 1">
        <input
          required
          value={form.line1}
          onChange={(e) => handle({ line1: e.target.value })}
          className={FIELD}
        />
      </FormRow>
      <FormRow label="Address line 2 (optional)">
        <input
          value={form.line2 ?? ""}
          onChange={(e) => handle({ line2: e.target.value })}
          className={FIELD}
        />
      </FormRow>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormRow label="City">
          <input
            required
            value={form.city}
            onChange={(e) => handle({ city: e.target.value })}
            className={FIELD}
          />
        </FormRow>
        <FormRow label="State">
          <select
            required
            value={form.state}
            onChange={(e) => handle({ state: e.target.value })}
            className={FIELD}
          >
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormRow>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormRow label="PIN code">
          <input
            required
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={form.pincode}
            onChange={(e) => handle({ pincode: e.target.value.replace(/\D/g, "") })}
            className={FIELD}
          />
        </FormRow>
        <FormRow label="Landmark (optional)">
          <input
            value={form.landmark ?? ""}
            onChange={(e) => handle({ landmark: e.target.value })}
            className={FIELD}
          />
        </FormRow>
      </div>
      <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => handle({ is_default: e.target.checked })}
          className="h-4 w-4 rounded border-border accent-foreground"
        />
        <span className="text-muted-foreground">Set as default address</span>
      </label>
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Save address"}
        </Button>
      </div>
    </form>
  );
}

const FIELD =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-foreground focus:outline-none";

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
