import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type State =
  | { kind: "pending" }
  | { kind: "ok" }
  | { kind: "error"; message: string }
  | { kind: "no-token" }
  | { kind: "input-otp" };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<State>(
    token ? { kind: "pending" } : { kind: "input-otp" },
  );
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .post("/auth/verify-email", { token })
      .then(async () => {
        await refresh();
        setState({ kind: "ok" });
      })
      .catch((err) => {
        setState({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Verification failed",
        });
      });
  }, [token, refresh]);

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      setState({
        kind: "error",
        message: "Please enter a valid 6-digit OTP",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/verify-email", { token: otp });
      await refresh();
      setState({ kind: "ok" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Verification failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex flex-col items-center py-24">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
          {state.kind === "pending" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
              <h1 className="display mt-4 text-3xl">
                Verifying your email...
              </h1>
            </>
          )}
          {state.kind === "ok" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="display mt-4 text-3xl">
                Email verified
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your account is fully activated. Happy browsing.
              </p>
              <Link
                to="/products"
                className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Browse the catalogue
              </Link>
            </>
          )}
          {state.kind === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="display mt-4 text-3xl">
                Couldn't verify
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                If the link expired, log in and click "Resend verification email"
                from the banner at the top of the site.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Log in
              </Link>
            </>
          )}
          {state.kind === "input-otp" && (
            <>
              <h1 className="display text-3xl">
                Verify your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter the 6-digit OTP we sent to your email
              </p>
              <form onSubmit={handleOtpSubmit} className="mt-6 flex flex-col gap-4">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="rounded-full border border-border bg-background px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button type="submit" disabled={submitting || otp.length !== 6} size="lg">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Verifying..." : "Verify"}
                </Button>
              </form>
            </>
          )}
          {state.kind === "no-token" && (
            <>
              <h1 className="display text-3xl">
                Missing verification token
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This page needs a valid link from the verification email we sent
                you.
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
