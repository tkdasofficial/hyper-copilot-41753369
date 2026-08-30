import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailExists } from "@/lib/auth.functions";
import { Logo } from "@/components/hyper/Logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in or create your Hyper Copilot account" },
      {
        name: "description",
        content:
          "Continue with email or Google to access the Hyper Copilot generative AI studio for image, video, vector and audio creation.",
      },
      { property: "og:title", content: "Sign in to Hyper Copilot" },
      {
        property: "og:description",
        content: "Continue with email or Google to access the Hyper Copilot generative AI studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Step = "email" | "login" | "signup";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function routeAfterLogin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    navigate({
      to: profile?.onboarding_completed ? "/dashboard" : "/getting-ready",
      replace: true,
    });
  }

  async function onContinueEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { exists } = await checkEmailExists({ data: { email: email.trim() } });
      setStep(exists ? "login" : "signup");
    } catch {
      toast.error("We couldn't check that email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    if (step === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      await routeAfterLogin();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/verify` },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    window.sessionStorage.setItem("hyper:pending-email", email.trim());

    if (data.session?.user.email_confirmed_at) {
      navigate({ to: "/getting-ready", replace: true });
    } else {
      navigate({ to: "/verify", replace: true });
    }
  }

  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/getting-ready` },
    });
    if (error) toast.error(error.message);
  }

  const isPasswordStep = step !== "email";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>

      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-7">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {step === "email" ? "Get started" : step === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          {step === "email"
            ? "Enter your email and we'll take you to the right place."
            : step === "login"
              ? "Enter your password to sign in."
              : "Choose a password to finish creating your account."}
        </p>

        {step === "email" ? (
          <>
            <form onSubmit={onContinueEmail} className="mt-6 space-y-3">
              <label className="block">
                <span className="sr-only">Email address</span>
                <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-3.5 py-3 focus-within:border-border-strong">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-[13.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
                {!busy ? <ArrowRight className="h-4 w-4" strokeWidth={2.2} /> : null}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={onGoogle}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface-2 px-4 py-3 text-[13.5px] font-bold transition-colors hover:border-border-strong"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        ) : (
          <form onSubmit={onSubmitPassword} className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-3.5 py-2.5">
              <span className="truncate text-[13px] font-medium">{email}</span>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setPassword("");
                }}
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
                Change
              </button>
            </div>

            <label className="block">
              <span className="sr-only">Password</span>
              <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-3.5 py-3 focus-within:border-border-strong">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                <input
                  type="password"
                  required
                  autoFocus
                  minLength={6}
                  autoComplete={step === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder={step === "login" ? "Your password" : "At least 6 characters"}
                  className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-[13.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {step === "login" ? "Log in" : "Continue"}
            </button>
          </form>
        )}
      </div>

      {isPasswordStep ? null : (
        <p className="mt-6 max-w-sm text-center text-[11.5px] leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}
