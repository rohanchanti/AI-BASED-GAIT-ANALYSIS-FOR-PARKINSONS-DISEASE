import { useCallback, useState } from "react";
import { UploadCloud, Video, ImageIcon } from "lucide-react";

export type MediaKind = "gait" | "facial";
export type DetectedFile = { file: File; kind: MediaKind; previewUrl: string };

interface Props {
  onDetected: (d: DetectedFile) => void;
}

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/avi"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export function UploadZone({ onDetected }: Props) {
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (file: File) => {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isVideo = VIDEO_TYPES.includes(file.type) || file.name.match(/\.(mp4|mov|avi)$/i);
      if (!isImage && !isVideo) return;
      const kind: MediaKind = isImage ? "facial" : "gait";
      const previewUrl = URL.createObjectURL(file);
      onDetected({ file, kind, previewUrl });
    },
    [onDetected],
  );

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={`relative overflow-hidden rounded-3xl gradient-border glass p-10 sm:p-14 text-center transition-all ${
          dragging ? "glow-primary scale-[1.01]" : ""
        }`}
      >
        {/* animated orbit ring */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full border border-primary/20 ring-orbit" />
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full border border-purple/20 ring-orbit" style={{ animationDirection: "reverse", animationDuration: "18s" }} />

        <div className="relative mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 glow-primary">
          <UploadCloud className="h-8 w-8 text-cyan" />
        </div>

        <h3 className="font-display text-2xl sm:text-3xl font-semibold">
          Drop a walking or facial recording
        </h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
          Our AI auto-detects media type and routes to the correct analysis pipeline.
          Supported: <span className="text-foreground/80">MP4, MOV, AVI, PNG, JPG</span>.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:brightness-110 glow-primary transition">
            <UploadCloud className="h-4 w-4" />
            Choose file
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/avi,.avi,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handle(f);
              }}
            />
          </label>
          <div className="text-xs text-muted-foreground">or drop file anywhere in this card</div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
          <div className="rounded-xl border border-border/60 p-3 flex items-center gap-3">
            <Video className="h-5 w-5 text-cyan shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Walking video</div>
              <div className="text-xs text-muted-foreground truncate">Gait, stride & pose analysis</div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 p-3 flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-purple shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Facial recording</div>
              <div className="text-xs text-muted-foreground truncate">Blink, rigidity, tremor</div>
            </div>
          </div>
        </div>

        {detecting && (
          <div className="mt-6 mx-auto max-w-md rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm text-left">
            <div className="flex items-center gap-2 text-cyan">
              <Sparkles className="h-4 w-4 animate-pulse" />
              AI detected {detecting.kind === "gait" ? "Walking Video" : "Facial Recording"}
            </div>
            <div className="mt-1 text-muted-foreground">
              Loading {detecting.kind === "gait" ? "Gait" : "Facial"} Analysis pipeline…
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/2 animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-primary via-cyan to-purple" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
