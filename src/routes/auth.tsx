import { createFileRoute, Link, useNavigate, useSearch, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Brain, Mail, Lock, User } from "lucide-react";

const search = z.object({
  mode: z.enum(["login", "register"]).optional().default("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (input) => search.parse(input),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "Welcome to NeuroStride AI." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <section className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="glass gradient-border rounded-3xl p-8">
        <div className="flex items-center gap-2 justify-center">
          <Brain className="h-6 w-6 text-cyan" />
          <span className="font-display text-lg font-semibold">Neuro<span className="gradient-text">Stride</span> AI</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold text-center">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {isRegister ? "Save reports and revisit past analyses." : "Sign in to access your dashboard."}
        </p>

        <button
          onClick={onGoogle}
          disabled={busy}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.27-1.63 3.72-5.5 3.72-3.31 0-6.01-2.74-6.01-6.12s2.7-6.12 6.01-6.12c1.88 0 3.14.8 3.86 1.48l2.63-2.54C16.9 2.9 14.68 2 12 2 6.98 2 2.92 6.06 2.92 11.1S6.98 20.2 12 20.2c6.93 0 8.35-6.48 7.72-9.7L12 10.2z"/></svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {isRegister && (
            <label className="block">
              <span className="text-xs text-muted-foreground">Full name</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 focus-within:border-primary">
                <User className="h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full bg-transparent outline-none text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </label>
          )}
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 focus-within:border-primary">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                className="w-full bg-transparent outline-none text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Password</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 focus-within:border-primary">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                minLength={6}
                className="w-full bg-transparent outline-none text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-60 glow-primary transition"
          >
            {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          {isRegister ? (
            <>Already have an account? <Link to="/auth" search={{ mode: "login" }} className="text-cyan hover:underline">Sign in</Link></>
          ) : (
            <>New here? <Link to="/auth" search={{ mode: "register" }} className="text-cyan hover:underline">Create an account</Link></>
          )}
        </div>
      </div>
    </section>
  );
}
