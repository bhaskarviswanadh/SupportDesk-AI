import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { SiHuggingface, SiGooglegemini } from "react-icons/si";
import { api, type HealthResponse, type PublicConfig } from "../api/client";
import {
  Badge,
  ErrorBox,
  PageHeader,
  Panel,
} from "../components/ui";

export function Settings() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, h] = await Promise.all([api.config(), api.health()]);
        if (!cancelled) {
          setConfig(c);
          setHealth(h);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
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
        title="Settings"
        subtitle="Read-only view of backend configuration. Edit values in backend/.env."
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="size-4 text-[var(--blue)]" />
            <h2 className="font-semibold">Freshdesk</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Domain</span>
              <span>{config?.freshdeskDomain || "not set"}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">API key</span>
              <span className="font-mono text-xs">
                {config?.freshdeskApiKeyMasked || "not set"}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Connection</span>
              <Badge
                tone={
                  health?.freshdesk === "connected"
                    ? "ok"
                    : health?.freshdesk === "not_configured"
                      ? "warn"
                      : "danger"
                }
              >
                {health?.freshdesk ?? "—"}
              </Badge>
            </li>
          </ul>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <SiHuggingface className="size-4 text-[var(--blue)]" />
            <h2 className="font-semibold">Hugging Face</h2>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Token</span>
              <Badge tone={config?.hfConfigured ? "ok" : "warn"}>
                {config?.hfConfigured ? "set" : "missing"}
              </Badge>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Embedding model</span>
              <span className="text-right text-xs font-mono max-w-[60%] break-all">
                {config?.embeddingModel}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Embeddings</span>
              <Badge tone={health?.ai.embeddingsReady ? "ok" : "warn"}>
                {health?.ai.embeddingsReady ? "ready" : "keyword fallback"}
              </Badge>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Docs loaded</span>
              <span>{health?.ai.docsLoaded ?? "—"}</span>
            </li>
          </ul>
        </Panel>

        <Panel className="p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <SiGooglegemini className="size-4 text-[var(--orange)]" />
            <h2 className="font-semibold">Google Gemini</h2>
          </div>
          <ul className="space-y-3 text-sm max-w-xl">
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">API key</span>
              <Badge tone={config?.geminiConfigured ? "ok" : "warn"}>
                {config?.geminiConfigured ? "set" : "missing"}
              </Badge>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-[var(--muted)]">Model</span>
              <span className="font-mono text-xs">
                {config?.geminiModel ?? health?.ai.geminiModel ?? "—"}
              </span>
            </li>
            <li className="text-[var(--muted)] text-xs leading-relaxed">
              Used by <span className="font-semibold text-[var(--ink)]">Ask Assistant</span>.
              Set <code className="text-[var(--blue)]">GEMINI_API_KEY</code> in{" "}
              <code className="text-[var(--blue)]">backend/.env</code> then restart the API.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
