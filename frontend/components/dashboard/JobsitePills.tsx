import type { CountEntry } from "@/lib/dashboard-stats";

interface JobsitePillsProps {
  entries: CountEntry[];
  minimal?: boolean;
}

export default function JobsitePills({ entries, minimal = false }: JobsitePillsProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((entry) => (
        <div
          key={entry.label}
          className={`inline-flex items-center gap-1.5 rounded-lg border shadow-sm backdrop-blur-sm ${
            minimal
              ? "border-slate-200 dark:border-slate-600/50 bg-white dark:bg-slate-800 px-2 py-1"
              : "border-slate-200 dark:border-slate-600/50 bg-slate-50 dark:bg-slate-800/90 px-2 py-1"
          }`}
        >
          <span className={`font-medium text-slate-700 dark:text-slate-200 ${minimal ? "text-[11px]" : "text-xs"}`}>
            {entry.label}
          </span>
          <span className="font-display text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
            {entry.count}
          </span>
        </div>
      ))}
    </div>
  );
}
