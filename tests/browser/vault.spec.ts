import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const password = "browser-test-password";
let session: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
let vaultDir = "";
let baseline: any;

async function login(page: Page) {
  if (session) {
    await page.context().addCookies(session);
    return;
  }
  const auth = await (await page.request.get("/api/auth")).json();
  await page.request.post(auth.configured ? "/api/login" : "/api/setup", {
    data: { password },
  });
  session = await page.context().cookies();
}

test.beforeEach(async ({ page }) => {
  await login(page);
  vaultDir = await mkdtemp(join(tmpdir(), "edon-browser-vault-"));
  baseline = await (await page.request.get("/api/desktop")).json();
  await page.request.put("/api/desktop", {
    data: {
      ...baseline,
      tiles: [],
      archive: [],
      settings: { ...baseline.settings, rows: 12 },
    },
  });
  const configured = await page.request.put("/api/vault", {
    data: { path: vaultDir, folder: "EDON", archiveFolder: ".trash" },
  });
  expect(configured.ok()).toBe(true);
});

test.afterEach(async ({ page }) => {
  await page.request.put("/api/vault", {
    data: { path: "", folder: "", archiveFolder: ".trash" },
  });
  if (baseline) {
    const current = await (await page.request.get("/api/desktop")).json();
    await page.request.put("/api/desktop", {
      data: { ...baseline, revision: current.revision },
    });
  }
  baseline = undefined;
  if (vaultDir) await rm(vaultDir, { recursive: true, force: true });
  vaultDir = "";
});

test("two quick captures keep one vault file each and reuse the assigned paths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  const input = page.getByRole("textbox", {
    name: "Appunta qualcosa",
    exact: true,
  });

  for (const [title, body] of [
    ["Idea", "Una sola copia."],
    ["Seconda", "Nessun duplicato."],
  ]) {
    await input.fill(`# ${title}\n\n${body}`);
    await input.press("ControlOrMeta+Enter");
    await expect(input).toHaveValue("");
    await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  }

  expect((await readdir(join(vaultDir, "EDON"))).sort()).toEqual([
    "Idea.md",
    "Seconda.md",
  ]);
  await expect(page.getByTestId("tile-text")).toHaveCount(2);

  // The normal polling interval must not rewrite or duplicate either file.
  await page.waitForTimeout(5500);
  expect((await readdir(join(vaultDir, "EDON"))).sort()).toEqual([
    "Idea.md",
    "Seconda.md",
  ]);
});
