import { useEffect, useState } from "react";
import { request } from "./api";
type Status = {
  configured: boolean;
  url: string;
  model: string;
  hasKey: boolean;
  managedByEnvironment: { url: boolean; apiKey: boolean; model: boolean };
};
export function AgentSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const show = (text: string, error = false) => {
    setMessage(text);
    setFailed(error);
  };
  useEffect(() => {
    request<Status>("/api/agent")
      .then((s) => {
        setStatus(s);
        setUrl(s.url);
        setModel(s.model);
      })
      .catch((e) => show(e.message, true));
  }, []);
  if (!status) return null;
  const env = status.managedByEnvironment;
  return (
    <fieldset className="agent-settings">
      <legend>Agente AI (Hermes)</legend>
      <p className="hint">
        Il pulsante ✨ nella barra invia le richieste a Hermes (API compatibile
        OpenAI). Hermes modifica le tile tramite il server MCP di EDON: vedi
        docs/agents.md. Con <code>HERMES_URL</code> e{" "}
        <code>HERMES_API_KEY</code> nello stack Docker questi campi sono gestiti
        dall’ambiente.
      </p>
      <form
        className="agent-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const next = await request<Status>("/api/agent", {
              method: "PUT",
              body: JSON.stringify({
                url,
                model,
                ...(apiKey ? { apiKey } : {}),
              }),
            });
            setStatus(next);
            setApiKey("");
            show("Salvato.");
          } catch (e) {
            show((e as Error).message, true);
          }
        }}
      >
        <label>
          Indirizzo di Hermes
          <input
            value={url}
            disabled={env.url}
            placeholder="http://192.168.1.20:8642"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          Chiave API {status.hasKey && <span>(già impostata)</span>}
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled={env.apiKey}
            placeholder={status.hasKey ? "Lascia vuoto per non cambiarla" : ""}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label>
          Modello
          <input
            value={model}
            disabled={env.model}
            placeholder="hermes-agent"
            onChange={(e) => setModel(e.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button
            type="button"
            disabled={!status.configured}
            onClick={() =>
              void request("/api/agent/test", { method: "POST" })
                .then(() => show("Hermes risponde."))
                .catch((e) => show(e.message, true))
            }
          >
            Verifica connessione
          </button>
          <button className="primary" type="submit">
            Salva
          </button>
        </div>
      </form>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "error-text" : "hint"}
        >
          {message}
        </p>
      )}
    </fieldset>
  );
}
