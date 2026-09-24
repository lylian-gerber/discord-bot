import clsx from "clsx";
import Link from "next/link";

export function tierColor(tier?: string | null): string {
  switch (tier) {
    case "green":
      return "var(--color-good)";
    case "normal":
      return "var(--color-ok)";
    case "adapt":
      return "var(--color-warn)";
    case "easy":
      return "var(--color-alert)";
    case "rest":
      return "var(--color-bad)";
    default:
      return "var(--color-line)";
  }
}

export function Ring({ value, color, size = 112, stroke = 10, children }: { value: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 pt-6">
      <div>
        {subtitle && <p className="text-sm text-muted first-letter:uppercase">{subtitle}</p>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="num mt-1 text-xl font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CardLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={clsx("card block transition active:scale-[0.99]", className)}>
      {children}
    </Link>
  );
}

export function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, "0")}`;
}
