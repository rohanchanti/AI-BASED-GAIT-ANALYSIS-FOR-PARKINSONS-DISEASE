import { Link } from "@tanstack/react-router";
import { Brain } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 flex flex-col md:flex-row items-start justify-between gap-8">
        <div className="max-w-md">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan" />
            <span className="font-display font-semibold">Neuro<span className="gradient-text">Stride</span> AI</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Research-grade Parkinson&apos;s screening from gait and facial video, powered by
            computer vision and deep learning. For research and educational use only —
            not a substitute for a clinical diagnosis.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Platform</div>
            <ul className="space-y-2">
              <li><Link to="/dashboard" className="hover:text-foreground text-muted-foreground">Dashboard</Link></li>
              <li><Link to="/reports" className="hover:text-foreground text-muted-foreground">Reports</Link></li>
              <li><Link to="/research" className="hover:text-foreground text-muted-foreground">Research</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Project</div>
            <ul className="space-y-2">
              <li><Link to="/about" className="hover:text-foreground text-muted-foreground">About</Link></li>
              <li><Link to="/contact" className="hover:text-foreground text-muted-foreground">Contact</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NeuroStride AI · Research prototype
      </div>
    </footer>
  );
}
