import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact · NeuroStride AI" },
      { name: "description", content: "Get in touch with the NeuroStride AI research team." },
      { property: "og:title", content: "Contact · NeuroStride AI" },
      { property: "og:description", content: "Get in touch with the NeuroStride AI research team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      toast.success("Message received", { description: "The research team will get back to you." });
      setName(""); setEmail(""); setMsg("");
      setBusy(false);
    }, 700);
  }

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan">Contact</div>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold">Talk to the team</h1>
      <p className="mt-3 text-muted-foreground max-w-xl">
        Questions about the model, collaboration proposals, or clinical pilots — send a
        message and we&apos;ll get back to you.
      </p>

      <form onSubmit={submit} className="mt-8 glass gradient-border rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-muted-foreground">Your name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5 focus-within:border-primary">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm" />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Message</span>
          <div className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5 focus-within:border-primary">
            <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
            <textarea required rows={5} value={msg} onChange={(e) => setMsg(e.target.value)}
              className="w-full bg-transparent outline-none text-sm resize-none" />
          </div>
        </label>
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 glow-primary disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}
