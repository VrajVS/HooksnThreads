import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

export function VerificationBanner() {
  const { user, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast.success("Verification email sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't resend right now");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-foreground text-background">
      <div className="container flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Please verify <strong className="font-semibold">{user.email}</strong> to
          confirm your account.
        </span>
        <button
          onClick={handleResend}
          disabled={sending}
          className="rounded-full border border-background/40 px-3 py-1 text-xs font-medium hover:bg-background/10 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Resend verification email"}
        </button>
      </div>
    </div>
  );
}
