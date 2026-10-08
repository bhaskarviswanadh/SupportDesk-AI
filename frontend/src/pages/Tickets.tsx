import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { api, type TicketDetail, type TicketSummary } from "../api/client";
import {
  Badge,
  Button,
  ErrorBox,
  PageHeader,
  Panel,
  tierTone,
} from "../components/ui";

function TicketList() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.tickets();
      setTickets(data.tickets);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={`${total} processed ticket${total === 1 ? "" : "s"} in the local database.`}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <Panel className="overflow-hidden">
        <div className="flex justify-end p-3 border-b border-[var(--border)]">
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Freshdesk</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[var(--muted)]">
                    No tickets yet.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--border)]/60 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/tickets/${t.id}`}
                        className="text-[var(--blue)] hover:underline"
                      >
                        {t.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{t.freshdesk_id}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-3">
                      <Badge tone={tierTone(t.tier)}>{t.tier ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-3">{t.status}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function TicketDetailView() {
  const { ticketId } = useParams();
  const id = Number(ticketId);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.ticket(id);
        if (!cancelled) setTicket(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ticket");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function reprocess() {
    if (!ticket) return;
    setReprocessing(true);
    setMessage("");
    setError("");
    try {
      await api.reprocess(ticket.freshdesk_id);
      setMessage("Reprocess requested. Refreshing…");
      const data = await api.ticket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div>
      <Link
        to="/tickets"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-4"
      >
        <ArrowLeft className="size-4" />
        Back to tickets
      </Link>
      <PageHeader
        title={ticket?.subject ?? "Ticket detail"}
        subtitle={ticket ? `Internal #${ticket.id} · Freshdesk #${ticket.freshdesk_id}` : "Loading…"}
      />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      {message && (
        <div className="mb-4 rounded-xl border border-[var(--border-strong)] bg-[var(--light-blue-soft)] px-4 py-3 text-sm font-medium text-[var(--blue)]">
          {message}
        </div>
      )}
      {ticket && (
        <Panel className="p-5 space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone={tierTone(ticket.tier)}>{ticket.tier ?? "—"}</Badge>
            <Badge tone="neutral">{ticket.category ?? "—"}</Badge>
            <Badge tone="neutral">{ticket.status}</Badge>
            {ticket.auto_resolved && <Badge tone="ok">auto-resolved</Badge>}
          </div>
          <p>
            <span className="text-[var(--muted)]">Confidence: </span>
            {ticket.confidence_score != null
              ? `${Math.round(ticket.confidence_score * 100)}%`
              : "—"}
          </p>
          <div>
            <p className="text-[var(--muted)] mb-1">Description</p>
            <div className="rounded-xl bg-black/25 border border-[var(--border)] p-4 whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>
          {ticket.bot_response && (
            <div>
              <p className="text-[var(--muted)] mb-1">Bot response</p>
              <div className="rounded-xl bg-black/25 border border-[var(--border)] p-4 whitespace-pre-wrap">
                {ticket.bot_response}
              </div>
            </div>
          )}
          {ticket.escalation_reason && (
            <p>
              <span className="text-[var(--muted)]">Escalation: </span>
              {ticket.escalation_reason}
            </p>
          )}
          <Button onClick={() => void reprocess()} disabled={reprocessing}>
            {reprocessing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Reprocess from Freshdesk
          </Button>
        </Panel>
      )}
    </div>
  );
}

export function Tickets() {
  const { ticketId } = useParams();
  if (ticketId) return <TicketDetailView />;
  return <TicketList />;
}
