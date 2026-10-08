import { useState } from "react";
import { Tags, Loader2 } from "lucide-react";
import { HiOutlineSparkles } from "react-icons/hi2";
import { api } from "../api/client";
import {
  Badge,
  Button,
  ErrorBox,
  Field,
  PageHeader,
  Panel,
  inputClass,
  tierTone,
} from "../components/ui";

export function Classify() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tier?: string;
    confidence?: number;
    category?: string;
    auto_resolved?: boolean;
    escalated?: boolean;
    response?: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.testTicket(subject, description);
      if (!data.processing_result.success) {
        throw new Error(data.processing_result.error ?? "Processing failed");
      }
      setResult(data.processing_result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Classify ticket"
        subtitle="Run a test ticket through classification, RAG, and resolution rules."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Subject">
              <input
                className={inputClass}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Password reset not working"
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className={`${inputClass} min-h-36 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="I clicked the reset link but nothing happened…"
                required
              />
            </Field>
            {error && <ErrorBox message={error} />}
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Tags className="size-4" />
              )}
              Process ticket
            </Button>
          </form>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HiOutlineSparkles className="size-4 text-[var(--blue)]" />
            <h2 className="font-semibold">Result</h2>
          </div>
          {!result ? (
            <p className="text-sm text-[var(--muted)]">
              Submit a ticket to see tier, confidence, and bot response.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={tierTone(result.tier)}>{result.tier}</Badge>
                <Badge tone="neutral">{result.category}</Badge>
                {result.auto_resolved && <Badge tone="ok">auto-resolved</Badge>}
                {result.escalated && <Badge tone="danger">escalated</Badge>}
              </div>
              <p>
                <span className="text-[var(--muted)]">Confidence: </span>
                {result.confidence != null
                  ? `${Math.round(result.confidence * 100)}%`
                  : "—"}
              </p>
              <div className="rounded-xl bg-black/25 border border-[var(--border)] p-4 whitespace-pre-wrap">
                {result.response}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
