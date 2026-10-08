import { NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";

/** App mark + wordmark. `tone="light"` is for dark backgrounds. */
export default function BrandMark({
  compact = false,
  tone = "dark",
  className,
}: {
  compact?: boolean;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
          tone === "dark"
            ? "bg-primary-700 text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.15)]"
            : "bg-white/10 text-white ring-1 ring-inset ring-white/15"
        )}
      >
        <NotebookPen className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </span>
      {!compact && (
        <span
          className={cn(
            "whitespace-nowrap text-[15px] font-semibold tracking-tight",
            tone === "dark" ? "text-surface-950" : "text-white"
          )}
        >
          OJT Logbook
        </span>
      )}
    </span>
  );
}
