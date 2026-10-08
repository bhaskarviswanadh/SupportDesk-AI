import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-8 animate-rise">
      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--light-blue-soft)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--blue)] mb-3">
        <span className="size-1.5 rounded-full bg-[var(--orange)]" />
        SupportDesk AI
      </div>
      <h1 className="brand-font text-3xl md:text-[2.35rem] text-[var(--ink)] tracking-tight mb-2">
        {title}
      </h1>
      <p className="text-[var(--muted)] max-w-2xl text-[0.98rem]">{subtitle}</p>
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--grad-panel)] shadow-[var(--shadow-sm)] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Panel className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--muted)] mb-1">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--ink)]">
            {value}
          </p>
        </div>
        <div className="grid place-items-center size-11 rounded-xl bg-[var(--grad-brand)] text-white shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      </div>
    </Panel>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "orange";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary:
      "text-white shadow-[var(--shadow-sm)] hover:brightness-105 [background:var(--grad-brand)]",
    orange:
      "text-white shadow-[var(--shadow-sm)] hover:brightness-105 [background:var(--grad-orange)]",
    ghost:
      "bg-white text-[var(--blue)] border border-[var(--border-strong)] hover:bg-[var(--light-blue-soft)]",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[var(--ink-soft)]">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)]/80 outline-none transition focus:border-[var(--blue-soft)] focus:ring-4 focus:ring-[rgba(110,193,228,0.35)]";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const colors = {
    ok: "bg-emerald-50 text-[var(--ok)] border-emerald-200",
    warn: "bg-[var(--orange-soft)] text-[var(--orange-deep)] border-orange-200",
    danger: "bg-rose-50 text-[var(--danger)] border-rose-200",
    neutral: "bg-[var(--light-blue-soft)] text-[var(--blue)] border-[var(--border)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold ${colors[tone]}`}
    >
      {children}
    </span>
  );
}

export function tierTone(
  tier?: string | null
): "ok" | "warn" | "danger" | "neutral" {
  if (tier === "tier_1") return "ok";
  if (tier === "tier_2") return "warn";
  if (tier === "complex") return "danger";
  return "neutral";
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-[var(--danger)]">
      {message}
    </div>
  );
}
