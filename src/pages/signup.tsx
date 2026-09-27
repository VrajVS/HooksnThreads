import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{10,15}$/;

interface FieldErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  acceptTerms?: string;
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Full name is required";
    if (!email.trim()) errors.email = "Email is required";
    else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address";
    const cleanPhone = phone.replace(/[\s\-()]/g, "");
    if (!cleanPhone) errors.phone = "Phone number is required";
    else if (!PHONE_PATTERN.test(cleanPhone))
      errors.phone = "Enter a valid 10–15 digit phone number";
    if (password.length < 8) errors.password = "At least 8 characters";
    if (!acceptTerms) errors.acceptTerms = "You must accept the terms to continue";
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
      await signup({
        email,
        password,
        full_name: fullName,
        phone: phone.replace(/[\s\-()]/g, ""),
        accept_terms: acceptTerms,
        marketing_opt_in: marketingOptIn,
      });
      toast.success("Account created — check your email to verify");
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex flex-col items-center py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-3xl font-semibold">Create Account</h1>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-8 flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-[2px_4px_12px_rgba(0,0,0,0.08)]"
          >
            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Field label="Full Name" htmlFor="fullName" error={fieldErrors.fullName}>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass(!!fieldErrors.fullName)}
              />
            </Field>
            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass(!!fieldErrors.email)}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" error={fieldErrors.phone}>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass(!!fieldErrors.phone)}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full rounded-full border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                  fieldErrors.password
                    ? "border-destructive focus:ring-destructive"
                    : "border-border focus:ring-ring",
                )}
              />
              <p
                className={cn(
                  "text-xs",
                  fieldErrors.password ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {fieldErrors.password ?? "At least 8 characters"}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-foreground"
                />
                <span className="text-muted-foreground">
                  I agree to the{" "}
                  <Link
                    to="/terms-of-service"
                    className="font-medium text-foreground underline underline-offset-2"
                    target="_blank"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy-policy"
                    className="font-medium text-foreground underline underline-offset-2"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {fieldErrors.acceptTerms && (
                <p className="text-xs text-destructive">{fieldErrors.acceptTerms}</p>
              )}
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-foreground"
                />
                <span className="text-muted-foreground">
                  Email me about new pieces and occasional sales
                </span>
              </label>
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="mt-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
              Log in
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    "rounded-full border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
    hasError
      ? "border-destructive focus:ring-destructive"
      : "border-border focus:ring-ring",
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
