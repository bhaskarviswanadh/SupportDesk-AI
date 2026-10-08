import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Ticket,
} from "lucide-react";
import { MdOutlineAutoAwesome } from "react-icons/md";
import {
  api,
  type AnalyticsResponse,
  type HealthResponse,
  type StatsResponse,
} from "../api/client";
import {
  Badge,
  ErrorBox,
  PageHeader,
  Panel,
  StatCard,
  tierTone,
} from "../components/ui";

export function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, s, a] = await Promise.all([
          api.health(),
          api.stats(),
          api.analytics(),
        ]);
        if (!cancelled) {
          setHealth(h);
          setStats(s);
          setAnalytics(a);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live health, resolution rates, and recent ticket activity."
      />

      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 animate-rise-delay">
        <StatCard
          label="Total tickets"
          value={stats?.total_tickets ?? "—"}
          icon={<Ticket className="size-5" />}
        />
        <StatCard
          label="Auto-resolved"
          value={stats?.auto_resolved ?? "—"}
          icon={<CheckCircle2 className="size-5" />}
        />
        <StatCard
          label="Escalated"
          value={stats?.escalated ?? "—"}
          icon={<AlertTriangle className="size-5" />}
        />
        <StatCard
          label="Auto-resolution rate"
          value={
            stats
              ? `${stats.auto_resolution_rate.toFixed(1)}%`
              : "—"
          }
          icon={<MdOutlineAutoAwesome className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Panel className="p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="size-4 text-[var(--blue)]" />
            <h2 className="font-semibold">System health</h2>
          </div>
          {health ? (
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">API</span>
                <Badge tone={health.status === "healthy" ? "ok" : "danger"}>
                  {health.status}
                </Badge>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Database</span>
                <Badge tone="ok">{health.database}</Badge>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Freshdesk</span>
                <Badge
                  tone={
                    health.freshdesk === "connected"
                      ? "ok"
                      : health.freshdesk === "not_configured"
                        ? "warn"
                        : "danger"
                  }
                >
                  {health.freshdesk}
                </Badge>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">HF embeddings</span>
                <Badge tone={health.ai.embeddingsReady ? "ok" : "warn"}>
                  {health.ai.embeddingsReady ? "ready" : "keyword fallback"}
                </Badge>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-[var(--muted)]">Docs loaded</span>
                <span>{health.ai.docsLoaded}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          )}
        </Panel>

        <Panel className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-[var(--blue)]" />
              <h2 className="font-semibold">Recent tickets</h2>
            </div>
            <Link
              to="/tickets"
              className="text-sm text-[var(--blue)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">Tier</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.recent_tickets ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[var(--muted)]">
                      No tickets yet. Try Classify → Process ticket.
                    </td>
                  </tr>
                ) : (
                  analytics?.recent_tickets.map((t) => (
                    <tr
                      key={`${t.id}-${t.created_at}`}
                      className="border-b border-[var(--border)]/60"
                    >
                      <td className="py-3 pr-3">{t.id}</td>
                      <td className="py-3 pr-3 max-w-[280px] truncate">
                        {t.subject}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={tierTone(t.tier)}>{t.tier ?? "—"}</Badge>
                      </td>
                      <td className="py-3">{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
