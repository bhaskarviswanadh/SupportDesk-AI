import type { ReactNode } from "react";
import { HiOutlineSparkles } from "react-icons/hi2";
import { CheckCircle2, Zap, Shield } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white [background:var(--grad-brand)]">
        <div className="glow-orb absolute -right-16 top-10 size-64 rounded-full bg-[var(--orange)]/25 blur-3xl" />
        <div className="glow-orb absolute left-10 bottom-16 size-72 rounded-full bg-[var(--light-blue)]/35 blur-3xl" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:36px_36px]" />

        <div className="relative">
          <div className="inline-flex items-center gap-3">
            <div className="grid place-items-center size-12 rounded-2xl bg-white/15 border border-white/25">
              <HiOutlineSparkles className="size-6 text-[#ffe8d4]" />
            </div>
            <div>
              <p className="brand-font text-2xl">SupportDesk AI</p>
              <p className="text-sm text-white/80">Professional ticket automation</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md animate-rise">
          <h1 className="brand-font text-4xl xl:text-5xl leading-tight mb-4">
            Resolve support faster with clarity.
          </h1>
          <p className="text-white/85 text-lg mb-8">
            Classify tickets, search your knowledge base, and escalate with
            confidence — all in one console.
          </p>
          <ul className="space-y-3 text-sm font-medium">
            {[
              { icon: Zap, text: "Instant tier classification" },
              { icon: CheckCircle2, text: "FAQ-powered AI replies" },
              { icon: Shield, text: "Secure signed-in workspace" },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 backdrop-blur"
              >
                <span className="grid place-items-center size-8 rounded-lg bg-[var(--orange)] text-white">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/65">
          Blue · Light blue · Orange — built for modern support teams
        </p>
      </section>

      <section className="grid place-items-center px-4 py-10 md:px-8">
        <div className="w-full max-w-md animate-rise-delay">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="grid place-items-center size-11 rounded-2xl [background:var(--grad-brand)] text-white">
              <HiOutlineSparkles className="size-5" />
            </div>
            <div>
              <p className="brand-font text-xl text-[var(--ink)]">SupportDesk AI</p>
              <p className="text-xs text-[var(--muted)]">Ticket automation</p>
            </div>
          </div>

          <h2 className="brand-font text-3xl text-[var(--ink)] mb-2">{title}</h2>
          <p className="text-[var(--muted)] mb-7">{subtitle}</p>

          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 md:p-7 shadow-[var(--shadow)]">
            {children}
          </div>

          <div className="text-center text-sm text-[var(--muted)] mt-5">
            {footer}
          </div>
        </div>
      </section>
    </div>
  );
}
