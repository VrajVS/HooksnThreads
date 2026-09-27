import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type State =
  | { kind: "pending" }
  | { kind: "ok" }
  | { kind: "error"; message: string }
  | { kind: "no-token" };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const token = params.get("token")?.trim() ?? "";
  const [state, setState] = useState<State>(
    token ? { kind: "pending" } : { kind: "no-token" },
  );

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex flex-col items-center py-24">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-[2px_4px_12px_rgba(0,0,0,0.08)]">
          {state.kind === "pending" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
              <h1 className="mt-4 font-brand text-2xl font-semibold">
                Verifying your email...
              </h1>
            </>
          )}
          {state.kind === "ok" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="mt-4 font-brand text-2xl font-semibold">
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
              <h1 className="mt-4 font-brand text-2xl font-semibold">
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
          {state.kind === "no-token" && (
            <>
              <h1 className="font-brand text-2xl font-semibold">
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
