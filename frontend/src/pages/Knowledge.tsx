import { useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { api } from "../api/client";
import {
  Button,
  ErrorBox,
  Field,
  PageHeader,
  Panel,
  inputClass,
} from "../components/ui";

export function Knowledge() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const data = await api.rag(query);
      setResponse(data.response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RAG query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        subtitle="Ask the FAQ corpus via Hugging Face embeddings (or keyword fallback)."
      />

      <Panel className="p-5 max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Question">
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="How do I reset my password?"
              required
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search knowledge base
          </Button>
        </form>

        {response && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="size-4 text-[var(--blue)]" />
              <h2 className="font-semibold">Answer</h2>
            </div>
            <div className="rounded-xl bg-black/25 border border-[var(--border)] p-4 text-sm whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
