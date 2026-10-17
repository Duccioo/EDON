import { useState } from "react";
import { Sparkles } from "lucide-react";
import { request } from "./api";

export function AgentCreator({
  onDone,
  onConfigure,
}: {
  onDone: (reply: string) => void;
  onConfigure: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="agent-creator"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!prompt.trim() || busy) return;
        setBusy(true);
        setError("");
        try {
          const { reply } = await request<{ reply: string }>("/api/agent/ask", {
            method: "POST",
            body: JSON.stringify({ prompt: prompt.trim() }),
          });
          onDone(reply);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Descrivi cosa vuoi creare nel tuo desktop.</p>
      <label>
        La tua richiesta
        <textarea
          autoFocus
          rows={5}
          maxLength={4000}
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Crea una lista per preparare il prossimo viaggio…"
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {error.includes("Impostazioni") && (
        <button type="button" onClick={onConfigure}>
          Configura agente AI
        </button>
      )}
      <button className="primary" disabled={busy || !prompt.trim()}>
        <Sparkles size={17} />
        {busy ? "L’agente ci sta lavorando…" : "Crea con agenti AI"}
      </button>
    </form>
  );
}
