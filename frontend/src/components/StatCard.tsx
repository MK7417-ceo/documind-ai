interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: "blue" | "purple" | "emerald" | "amber";
}

/** Overview stat tile for the dashboard. */
export default function StatCard({ label, value, icon, accent = "blue" }: StatCardProps) {
  const accentRing: Record<NonNullable<StatCardProps["accent"]>, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-navy-900">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${accentRing[accent]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}
