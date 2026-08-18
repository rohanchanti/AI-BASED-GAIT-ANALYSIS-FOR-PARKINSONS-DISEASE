import { useState } from "react";
import { User, X } from "lucide-react";

export type PatientInfo = {
  name: string;
  patientId: string;
  age: string;
  gender: string;
  /** standing height in cm — optional spatial-calibration reference */
  heightCm?: string;
};

interface Props {
  onSubmit: (p: PatientInfo) => void;
  onCancel: () => void;
}

export function PatientForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightCm, setHeightCm] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !age.trim() || !gender.trim()) return;
    onSubmit({
      name: name.trim(),
      patientId: patientId.trim(),
      age: age.trim(),
      gender: gender.trim(),
      heightCm: heightCm.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-md p-4">
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg glass gradient-border rounded-3xl p-8"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 glow-primary">
            <User className="h-5 w-5 text-cyan" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan">Patient credentials</div>
            <h2 className="font-display text-2xl font-semibold">Enter patient details</h2>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          These details are recorded with the analysis and printed on every exported report.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs text-muted-foreground">Full name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="e.g. John Doe"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-muted-foreground">Patient ID</span>
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Optional MRN / hospital ID"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Age *</span>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="e.g. 62"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Gender *</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-muted-foreground">Standing height (cm)</span>
            <input
              type="number"
              min={80}
              max={230}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              placeholder="Optional — enables real-world (metre) calibration"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Without a height or a known in-frame distance, distances and speeds are reported in
              relative image units instead of metres.
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground glow-primary hover:brightness-110"
          >
            Continue to analysis
          </button>
        </div>
      </form>
    </div>
  );
}
