import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createTile, tileToFolderChild } from "../../packages/shared/model";

const password = "browser-test-password";
let session: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
let baseline: any;

async function open(page: Page) {
  baseline = await (await page.request.get("/api/desktop")).json();
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
}

test.beforeEach(async ({ page }) => {
  if (session) await page.context().addCookies(session);
  else {
    const auth = await (await page.request.get("/api/auth")).json();
    await page.request.post(auth.configured ? "/api/login" : "/api/setup", {
      data: { password },
    });
    session = await page.context().cookies();
  }
});

test.afterEach(async ({ page }) => {
  if (!baseline) return;
  const current = await (await page.request.get("/api/desktop")).json();
  await page.request.put("/api/desktop", {
    data: { ...baseline, revision: current.revision },
  });
  baseline = undefined;
});

test("compact side workspaces ignore persisted width and Space activates buttons", async ({
  page,
}) => {
  await open(page);
  await page
    .getByTestId("tile-data")
    .first()
    .getByRole("button", { name: /^Apri / })
    .first()
    .click();
  const side = page.getByRole("dialog", { name: "Vista completa" });
  await side
    .getByRole("separator", { name: "Ridimensiona pannello laterale" })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(side).toHaveCSS("width", "390px");
  expect(
    await side.evaluate((element: HTMLElement) => element.style.width),
  ).toBe("");
  await side.getByRole("button", { name: "Chiudi", exact: true }).click();

  const capture = page.getByRole("textbox", { name: "Appunta qualcosa" });
  await capture.fill("");
  await page.getByRole("button", { name: "Impostazioni", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog", { name: "Impostazioni globali" }),
  ).toBeVisible();
  await expect(capture).toHaveValue("");
});

test("folder child edits retain Vault config, item IDs and warn before deletion", async ({
  page,
}) => {
  await open(page);
  const source = baseline.tiles.find(
    (tile: { type: string }) => tile.type === "data",
  );
  const linked = {
    ...source,
    id: crypto.randomUUID(),
    config: { ...source.config, vaultPath: "Linked.md" },
  };
  const child = tileToFolderChild(linked)!;
  const folder = createTile("folder", baseline.tiles, { w: 2, h: 2 });
  folder.title = "Cartella collegata";
  folder.config.children = [child];
  const setup = await page.request.put("/api/desktop", {
    data: { ...baseline, tiles: [...baseline.tiles, folder] },
  });
  expect(setup.ok(), await setup.text()).toBe(true);
  await page.reload();
  await page
    .getByTestId("tile-folder")
    .filter({ hasText: folder.title })
    .getByRole("button", { name: /Apri cartella/ })
    .click();
  const dialog = page.getByRole("dialog", { name: folder.title });
  await dialog
    .getByRole("button", { name: `Modifica ${child.title}`, exact: true })
    .click();
  await dialog.getByLabel("Titolo", { exact: true }).fill("Titolo aggiornato");
  await dialog.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  const saved = await (await page.request.get("/api/desktop")).json();
  const savedChild = saved.tiles
    .find((tile: { id: string }) => tile.id === folder.id)
    .config.children.find((item: { id: string }) => item.id === child.id);
  expect(savedChild.config.vaultPath).toBe("Linked.md");
  expect(
    savedChild.config.items.map((item: { id: string }) => item.id),
  ).toEqual(child.config.items.map((item) => item.id));
  await dialog.getByRole("button", { name: "Elimina", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "Eliminare questa tile?" });
  await expect(warning).toContainText("1 elemento figlio");
  await expect(warning).toContainText("file .md collegato");
});

test("Vault ignores stale detail responses, serializes tasks, sends versions and shows errors", async ({
  page,
}) => {
  const summary = (path: string, title: string) => ({
    path,
    title,
    folder: "",
    excerpt: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "data" as const,
    taskCount: 1,
    doneCount: 0,
  });
  const detail = (path: string, title: string, done = false) => ({
    ...summary(path, title),
    body: "",
    items: [{ id: "task", text: `Task ${title}`, done }],
    obsidianUrl: "obsidian://open",
    version: "a".repeat(64),
  });
  let releaseA!: () => void;
  const gateA = new Promise<void>((resolve) => (releaseA = resolve));
  await page.route("**/api/vault/notes?*", (route) =>
    route.fulfill({
      json: {
        vaultName: "Test",
        folders: [],
        notes: [summary("A.md", "A"), summary("B.md", "B")],
      },
    }),
  );
  await page.route("**/api/vault/note?path=A.md", async (route) => {
    await gateA;
    await route.fulfill({ json: detail("A.md", "A") });
  });
  await page.route("**/api/vault/note?path=B.md", (route) =>
    route.fulfill({ json: detail("B.md", "B") }),
  );
  const writes: any[] = [];
  let failWrite = false;
  await page.route("**/api/vault/note", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const body = route.request().postDataJSON();
    writes.push(body);
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (failWrite)
      return route.fulfill({ status: 409, json: { error: "Nota cambiata" } });
    return route.fulfill({
      json: detail(body.path, "B", body.items[0].done),
    });
  });

  await open(page);
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page.getByRole("button", { name: "Esplora Vault" }).click();
  const vault = page.getByRole("dialog", { name: "Vault Obsidian" });
  await vault.getByRole("button", { name: /^B/ }).click();
  await expect(vault.locator("h3")).toHaveText("B");
  releaseA();
  await expect(vault.locator("h3")).toHaveText("B");
  await expect(vault.locator("h3").filter({ hasText: "A" })).toHaveCount(0);

  const task = vault.getByRole("button", { name: "Task B", exact: true });
  await task.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect(task).toBeDisabled();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].version).toBe("a".repeat(64));
  expect(writes[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
  await expect(task).toBeEnabled();
  failWrite = true;
  await task.click();
  await expect(vault.getByRole("alert")).toContainText("Nota cambiata");
});

test("late agent completion does not close a different modal", async ({
  page,
}) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => (finish = resolve));
  await page.route("**/api/agent/ask", async (route) => {
    await pending;
    await route.fulfill({ json: { reply: "Fatto" } });
  });
  await open(page);
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page.getByRole("button", { name: /Crea con agenti AI/ }).click();
  const agent = page.getByRole("dialog", { name: "Crea con agenti AI" });
  await agent.getByLabel("La tua richiesta").fill("Crea una nota");
  await agent
    .getByRole("button", { name: "Crea con agenti AI", exact: true })
    .click();
  await agent.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(agent).toHaveCount(0);
  await page.keyboard.press("?");
  const shortcuts = page.getByRole("dialog", {
    name: "Scorciatoie da tastiera",
  });
  await expect(shortcuts).toBeVisible();
  finish();
  await expect(shortcuts).toBeVisible();
});

test("appearance preview mounts static tiles without live tile requests", async ({
  page,
}) => {
  await open(page);
  const weather = createTile("weather", baseline.tiles, { w: 2, h: 2 });
  weather.config.location = "Roma";
  await page.request.put("/api/desktop", {
    data: { ...baseline, tiles: [...baseline.tiles, weather] },
  });
  let weatherRequests = 0;
  await page.route("**/api/weather*", (route) => {
    weatherRequests++;
    return route.fulfill({
      json: {
        location: "Roma",
        temperature: 20,
        code: 0,
        isDay: true,
        wind: 1,
        min: 10,
        max: 22,
        updatedAt: new Date().toISOString(),
      },
    });
  });
  await page.reload();
  await expect(page.getByTestId("tile-weather")).toContainText("20°");
  const before = weatherRequests;
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click();
  const preview = page.getByRole("complementary", {
    name: "Anteprima aspetto",
  });
  await expect(preview.locator("[data-static-preview]")).toHaveCount(
    baseline.tiles.length + 1,
  );
  await expect(preview.locator("time")).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(weatherRequests).toBe(before);
});

test("late image uploads update only their initiating tile", async ({
  page,
}) => {
  await open(page);
  const first = createTile("image", baseline.tiles, { w: 1, h: 1 });
  first.title = "Prima immagine";
  const second = createTile("image", [...baseline.tiles, first], {
    w: 1,
    h: 1,
  });
  second.title = "Seconda immagine";
  const setup = await page.request.put("/api/desktop", {
    data: { ...baseline, tiles: [...baseline.tiles, first, second] },
  });
  expect(setup.ok()).toBe(true);
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => (finish = resolve));
  await page.route("**/api/uploads", async (route) => {
    await pending;
    await route.fulfill({ json: { url: "/uploads/late.png" } });
  });
  await page.reload();
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page.getByRole("button", { name: "Modifica", exact: true }).click();
  await page
    .getByRole("button", { name: "Modifica Prima immagine", exact: true })
    .click();
  await page
    .getByRole("complementary", { name: "Proprietà della tile" })
    .getByLabel("Carica immagine o GIF")
    .setInputFiles({
      name: "late.png",
      mimeType: "image/png",
      buffer: Buffer.from("image"),
    });
  await page
    .getByRole("button", { name: "Modifica Seconda immagine", exact: true })
    .click();
  finish();
  await expect
    .poll(async () => {
      const current = await (await page.request.get("/api/desktop")).json();
      return current.tiles.find((tile: { id: string }) => tile.id === first.id)
        .config.image;
    })
    .toBe("/uploads/late.png");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  const saved = await (await page.request.get("/api/desktop")).json();
  expect(
    saved.tiles.find((tile: { id: string }) => tile.id === second.id).config
      .image,
  ).toBe("");
});

test("a desktop save conflict offers reload instead of an endless retry", async ({
  page,
}) => {
  await page.route("**/api/desktop", (route) => {
    if (route.request().method() === "PUT")
      return route.fulfill({ status: 409, json: { error: "Conflitto" } });
    return route.continue();
  });
  await open(page);
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click();
  await page.getByLabel("Nome del desktop").fill("Modifica in conflitto");
  const alert = page.locator(".save-error");
  await expect(alert).toContainText("Ricarica per vedere la versione");
  await expect(
    alert.getByRole("button", { name: "Riprova salvataggio" }),
  ).toHaveCount(0);
  await expect(
    alert.getByRole("button", { name: "Ricarica desktop" }),
  ).toBeVisible();
});
