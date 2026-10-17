import { useCallback, useEffect, useRef, useState } from "react";
import type { Desktop, Snapshot } from "../../../packages/shared/model";
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json", ...init?.headers },
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Connessione non riuscita. Riprova.");
  return result as T;
}
export async function upload(file: File) {
  const form = new FormData();
  form.append("file", file);
  return (
    await request<{ url: string }>("/api/uploads", {
      method: "POST",
      body: form,
    })
  ).url;
}
export function useDesktop() {
  const [desktop, setDesktop] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState("Caricamento…");
  const [error, setError] = useState("");
  const revision = useRef(0);
  const latest = useRef<Snapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef(Promise.resolve());
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(() => {
    request<Snapshot>("/api/desktop")
      .then((value) => {
        revision.current = value.revision;
        latest.current = value;
        setDesktop(value);
        setStatus("Tutto salvato");
      })
      .catch((e) => setError(e.message));
    return () => clearTimeout(timer.current);
  }, []);
  // Agents change the desktop from outside: pick up their edits when we have no unsaved work.
  const pull = useCallback(async () => {
    if (statusRef.current !== "Tutto salvato") return;
    try {
      const value = await request<Snapshot>("/api/desktop");
      if (
        value.revision <= revision.current ||
        statusRef.current !== "Tutto salvato"
      )
        return;
      revision.current = value.revision;
      latest.current = value;
      setDesktop(value);
    } catch {
      /* the next poll retries */
    }
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) void pull();
    }, 5000);
    return () => clearInterval(id);
  }, [pull]);
  const save = useCallback((value: Snapshot) => {
    setStatus("Salvataggio…");
    queue.current = queue.current.then(async () => {
      try {
        const result = await request<Snapshot>("/api/desktop", {
          method: "PUT",
          body: JSON.stringify({ ...value, revision: revision.current }),
        });
        revision.current = result.revision;
        setError("");
        if (latest.current === value) setStatus("Tutto salvato");
      } catch (e) {
        setError((e as Error).message);
        setStatus("Modifiche non salvate");
      }
    });
  }, []);
  const update = useCallback(
    (fn: (old: Desktop) => Desktop) => {
      if (!latest.current) return;
      const next = { ...fn(latest.current), revision: revision.current };
      latest.current = next;
      setDesktop(next);
      setStatus("Modifiche in corso…");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next), 350);
    },
    [save],
  );
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (status !== "Tutto salvato" && latest.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [status]);
  return {
    desktop,
    update,
    status,
    error,
    retry: () => latest.current && save(latest.current),
    refresh: pull,
  };
}
