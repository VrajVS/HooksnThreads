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
import { ApiError } from "@/lib/api";
import { type Requirement, formatQty } from "@/lib/inventory";

/** Pulls the shortage list out of a 409 from the order endpoints, if that's what it is. */
export function shortagesFromError(err: unknown): Requirement[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const data = err.data as { shortages?: Requirement[] } | undefined;
  return data?.shortages?.length ? data.shortages : null;
}

export function ShortageDialog({
  shortages,
  onCancel,
  onProceed,
}: {
  shortages: Requirement[] | null;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <AlertDialog open={shortages !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Not enough accessories in stock</AlertDialogTitle>
          <AlertDialogDescription>
            Confirming this order will take these accessories below zero. Continue if you're
            restocking soon; stock will show as negative until you add it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1.5">Accessory</th>
              <th className="py-1.5 text-right">Needed</th>
              <th className="py-1.5 text-right">In stock</th>
              <th className="py-1.5 text-right">Short by</th>
            </tr>
          </thead>
          <tbody>
            {shortages?.map((s) => (
              <tr key={s.accessory_id} className="border-t border-zinc-100">
                <td className="py-1.5">{s.name}</td>
                <td className="py-1.5 text-right tabular-nums">{formatQty(s.required)} {s.unit}</td>
                <td className="py-1.5 text-right tabular-nums">{formatQty(s.stock)} {s.unit}</td>
                <td className="py-1.5 text-right font-medium tabular-nums text-destructive">
                  {formatQty(s.shortage)} {s.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction onClick={onProceed}>Confirm anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
