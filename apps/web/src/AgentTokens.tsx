import { useCallback, useEffect, useState } from "react";
import { request } from "./api";
type TokenInfo = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("it") : "—";
export function AgentTokens() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      request<{ tokens: TokenInfo[] }>("/api/tokens")
        .then((r) => setTokens(r.tokens))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => void load(), [load]);
  return (
    <fieldset className="agent-tokens">
      <legend>Agenti (Hermes, MCP, API)</legend>
      <p className="hint">
        Un token consente a un agente esterno di creare e aggiornare tile. Non
        può vedere né modificare il resto del desktop o queste impostazioni.
      </p>
      <form
        className="token-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await request<{ token: string }>("/api/tokens", {
              method: "POST",
              body: JSON.stringify({
                name,
                expiresInDays: days ? Number(days) : undefined,
              }),
            });
            setFresh(r.token);
            setName("");
            setError("");
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <input
          aria-label="Nome del token"
          placeholder="Nome (es. Hermes)"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          aria-label="Scadenza"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="30">30 giorni</option>
          <option value="90">90 giorni</option>
          <option value="365">1 anno</option>
          <option value="">Senza scadenza</option>
        </select>
        <button className="primary" disabled={!name.trim()}>
          Crea token
        </button>
      </form>
      {fresh && (
        <div className="token-fresh" role="status">
          <p>Copialo ora: non verrà più mostrato.</p>
          <code>{fresh}</code>
          <button type="button" onClick={() => setFresh("")}>
            Fatto
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <ul className="token-list">
        {tokens.map((t) => (
          <li key={t.id}>
            <span>
              <strong>{t.name}</strong>
              <small>
                creato {day(t.createdAt)} · scade {day(t.expiresAt)} · usato{" "}
                {day(t.lastUsedAt)}
              </small>
            </span>
            <button
              type="button"
              className="danger"
              onClick={() =>
                void request(`/api/tokens/${t.id}`, { method: "DELETE" })
                  .then(load)
                  .catch((e) => setError(e.message))
              }
            >
              Revoca
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
