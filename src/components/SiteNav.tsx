import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/#analyze", label: "AI Analysis" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/voice-analysis", label: "Voice AI" },
  { to: "/reports", label: "Reports" },
  { to: "/research", label: "Research" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-xl bg-background/70 border-b border-border/60" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative h-9 w-9 rounded-lg gradient-border glass grid place-items-center">
            <Brain className="h-5 w-5 text-cyan" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold tracking-tight">
              Neuro<span className="gradient-text">Stride</span> AI
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Parkinson&apos;s Detection
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to.startsWith("/#") ? "/" : l.to}
              hash={l.to.startsWith("/#") ? l.to.slice(2) : undefined}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-white/5"
              activeOptions={{ exact: l.to === "/" }}
              activeProps={{ className: "text-foreground bg-white/5" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {email ? (
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {email}
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Login
              </Link>
              <Link
                to="/auth"
                search={{ mode: "register" as const }}
                className="relative rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:brightness-110 transition glow-primary"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          className="lg:hidden rounded-md p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to.startsWith("/#") ? "/" : l.to}
                hash={l.to.startsWith("/#") ? l.to.slice(2) : undefined}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {email ? (
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-center text-sm">Login</Link>
                  <Link to="/auth" search={{ mode: "register" as const }} onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">Register</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
