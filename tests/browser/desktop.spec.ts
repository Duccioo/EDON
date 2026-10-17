import { test, expect, type BrowserContext, type Page } from "@playwright/test";
const password = "browser-test-password";
// Login is rate limited (8 per minute), so sign in once and reuse the session.
let session: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
test.beforeEach(async ({ page }) => {
  if (session) await page.context().addCookies(session);
  else {
    const auth = await (await page.request.get("/api/auth")).json();
    await page.request.post(auth.configured ? "/api/login" : "/api/setup", {
      data: { password },
    });
    session = await page.context().cookies();
    const initial = await (await page.request.get("/api/desktop")).json();
    await page.request.put("/api/desktop", {
      data: { ...initial, settings: { ...initial.settings, rows: 12 } },
    });
  }
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
});
async function capture(
  page: Page,
  title: string,
  body: string,
  kind: "text" | "data" = "text",
) {
  const input = page.getByRole("textbox", {
    name: "Appunta qualcosa",
    exact: true,
  });
  await input.fill(`# ${title}\n\n${body}`);
  if (kind === "data")
    await page
      .getByRole("button", { name: "Trasforma in TODO", exact: true })
      .click();
  await input.press("ControlOrMeta+Enter");
  await expect(input).toHaveValue("");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
}
test("curated desktop and mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByTestId("tile-clock").first().locator("time"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId("tile-data").first().locator(".check-item").count(),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("tile-clock").first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(page.locator(".mobile-tile-grid")).toBeVisible();
  await expect(
    page.getByTestId("tile-image").first().locator("img"),
  ).toBeVisible();
  await expect(
    page.getByTestId("tile-image").first().locator("article"),
  ).toHaveCSS("position", "relative");
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("create, style, resize and persist an ordinary clock tile", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Orologio Il tuo tempo, ovunque" })
    .click();
  const inspector = page.getByRole("complementary", {
    name: "Proprietà della tile",
  });
  await inspector
    .getByLabel("Titolo", { exact: true })
    .fill("Orologio di prova");
  await inspector.getByRole("button", { name: "2 × 2" }).click();
  await inspector.getByRole("button", { name: "Dot / Industrial" }).click();
  await inspector.getByLabel("Fuso orario").fill("Europe/Rome");
  await inspector.getByLabel("Fuso orario").press("Tab");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await expect(
    page.getByText("Orologio di prova", { exact: true }),
  ).toBeVisible();
  const tile = page
    .getByTestId("tile-clock")
    .filter({ hasText: "Orologio di prova" });
  await expect(tile).toHaveClass(/size-2-2/);
  const state = await (await page.request.get("/api/desktop")).json();
  const clock = state.tiles.find(
    (t: { title: string }) => t.title === "Orologio di prova",
  );
  expect(clock.config.timezone).toBe("Europe/Rome");
  expect(clock.appearance.preset).toBe("industrial");
});
test("create a link and upload a persistent image", async ({ page }) => {
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collegamento App, siti e scorciatoie" })
    .click();
  let inspector = page.getByRole("complementary", {
    name: "Proprietà della tile",
  });
  await inspector.getByLabel("Titolo", { exact: true }).fill("Sito di prova");
  await inspector.getByLabel("Destinazione").fill("https://example.com");
  await inspector.getByLabel("Destinazione").press("Tab");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.getByRole("button", { name: "Fine", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Apri Sito di prova" }),
  ).toHaveAttribute("href", "https://example.com");
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Immagine Fotografie, illustrazioni e GIF" })
    .click();
  inspector = page.getByRole("complementary", { name: "Proprietà della tile" });
  await inspector
    .getByLabel("Titolo", { exact: true })
    .fill("Immagine di prova");
  await inspector.getByLabel("Carica immagine o GIF").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Immagine di prova" }),
  ).toHaveAttribute("src", /\/uploads\//);
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Immagine di prova" }),
  ).toBeVisible();
});
test("dragging, resizing, keyboard editing, wallpaper and deletion", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
  await page.keyboard.press("e");
  const tile = page
    .getByTestId("tile-clock")
    .filter({ hasText: "Orologio di prova" });
  const before = await (await page.request.get("/api/desktop")).json();
  const original = before.tiles.find(
    (t: { title: string }) => t.title === "Orologio di prova",
  );
  const box = (await tile.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 85);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 85 - 380, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  const after = await (await page.request.get("/api/desktop")).json();
  expect(
    after.tiles.find((t: { id: string }) => t.id === original.id).y,
  ).not.toBe(original.y);
  const handle = tile.locator(".react-resizable-handle");
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + 8, hb.y + 8);
  await page.mouse.down();
  await page.mouse.move(hb.x + 8, hb.y + 8 - 190, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  const resized = await (await page.request.get("/api/desktop")).json();
  expect(
    resized.tiles.find((t: { id: string }) => t.id === original.id).h,
  ).toBe(1);
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Impostazioni globali", exact: true })
    .click();
  await page.getByRole("button", { name: "Gradiente", exact: true }).click();
  await page.getByLabel("Nome del desktop").fill("Spazio di prova");
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await expect(
    page.getByText("Spazio di prova", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
  await page.keyboard.press("e");
  await page
    .getByRole("button", { name: "Modifica Orologio di prova", exact: true })
    .click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await page.getByRole("button", { name: "Elimina tile", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await expect(
    page.getByText("Orologio di prova", { exact: true }),
  ).toHaveCount(0);
});

test("quick Markdown notes expand with complete content and persist", async ({
  page,
}) => {
  const text = Array.from(
    { length: 60 },
    (_, i) => `Paragrafo ${i + 1}: idee per il prossimo progetto.`,
  ).join("\n");
  await capture(page, "Appunti lunghi", text);
  await page
    .getByRole("button", { name: "Apri Appunti lunghi", exact: true })
    .click();
  const focus = page.getByRole("dialog", { name: "Vista completa" });
  await expect(focus.locator(".text-body")).toContainText("Paragrafo 60");
  expect(
    await focus
      .locator("article")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Apri Appunti lunghi", exact: true })
    .click();
  await expect(focus.locator(".text-body")).toContainText("Paragrafo 60");
});

test("long TODO preview fits whole rows, expands all items and persists checkboxes", async ({
  page,
}) => {
  await capture(
    page,
    "Lista lunga",
    Array.from({ length: 25 }, (_, i) => `- [ ] Attività ${i + 1}`).join("\n"),
    "data",
  );
  await page
    .getByRole("button", { name: "Apri Lista lunga", exact: true })
    .click();
  const focus = page.getByRole("dialog", { name: "Vista completa" });
  await expect(
    focus.getByRole("button", { name: "Attività 25", exact: true }),
  ).toHaveCount(1);
  await focus.getByRole("button", { name: "Attività 25", exact: true }).click();
  await expect(
    focus.getByRole("button", { name: "Attività 25", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/expanded-todo.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  const preview = page
    .getByTestId("tile-data")
    .filter({ hasText: "Lista lunga" });
  const rows = preview.locator(".check-item");
  expect(await rows.count()).toBeLessThan(25);
  for (const row of await rows.all()) {
    expect(
      await row.evaluate((el) => {
        const a = el.getBoundingClientRect();
        const b = el.parentElement!.getBoundingClientRect();
        return a.bottom <= b.bottom + 1;
      }),
    ).toBe(true);
  }
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await page
    .getByRole("button", { name: "Apri Lista lunga", exact: true })
    .click();
  await expect(
    focus.getByRole("button", { name: "Attività 25", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("global shape applies to every tile, wallpaper persists, individual editor has no shape controls", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Impostazioni globali", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "Impostazioni globali" });
  await settings.getByLabel("Angoli").fill("30");
  await settings.getByLabel("Bordo", { exact: true }).selectOption("strong");
  await settings.getByLabel("Spazio interno").fill("18");
  await settings
    .getByRole("button", { name: "Tinta unita", exact: true })
    .click();
  await settings.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  for (const tile of await page.locator(".tile-grid article.tile").all()) {
    await expect(tile).toHaveCSS("border-radius", "30px");
    await expect(tile).toHaveCSS("border-top-width", "2px");
    await expect(tile).toHaveCSS("padding-top", "18px");
  }
  const saved = await (await page.request.get("/api/desktop")).json();
  expect(saved.settings.wallpaper).toBe("solid");
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
  await page.keyboard.press("e");
  await page
    .getByRole("button", { name: "Modifica Obsidian", exact: true })
    .click();
  const inspector = page.getByRole("complementary", {
    name: "Proprietà della tile",
  });
  await expect(inspector.getByLabel("Angoli")).toHaveCount(0);
  await expect(inspector.getByLabel("Bordo", { exact: true })).toHaveCount(0);
});

test("drag over an incompatible tile restores position without moving neighbours", async ({
  page,
}) => {
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
  await page.keyboard.press("e");
  const before = await (await page.request.get("/api/desktop")).json();
  const target = page.getByTestId("tile-link").filter({ hasText: "Obsidian" });
  const box = (await target.boundingBox())!;
  const image = (await page.getByTestId("tile-image").first().boundingBox())!;
  await page.mouse.move(box.x + 45, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(image.x + 40, image.y + 55, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.getByText("Spazio occupato:", { exact: false }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/desktop")).json();
  expect(
    after.tiles.map((t: { id: string; x: number; y: number }) => ({
      id: t.id,
      x: t.x,
      y: t.y,
    })),
  ).toEqual(
    before.tiles.map((t: { id: string; x: number; y: number }) => ({
      id: t.id,
      x: t.x,
      y: t.y,
    })),
  );
});

test("notes and lists can be edited and deleted; the + menu groups the other actions", async ({
  page,
}) => {
  await capture(page, "Spesa", "- [ ] Latte\n- [ ] Pane", "data");
  await page.getByRole("button", { name: "Apri Spesa", exact: true }).click();
  const focus = page.getByRole("dialog", { name: "Vista completa" });
  await focus.getByText("Pane").click();
  await focus.getByRole("button", { name: "Modifica", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Modifica", exact: true });
  await expect(
    form.getByRole("textbox", { name: "Contenuto Markdown", exact: true }),
  ).toHaveValue(/- \[x\] Pane/);
  await form
    .getByRole("textbox", { name: "Titolo", exact: true })
    .fill("Spesa del sabato");
  await form
    .getByRole("textbox", { name: "Contenuto Markdown", exact: true })
    .fill("- [ ] Latte\n- [x] Pane\n- [ ] Uova");
  await form.getByRole("button", { name: "Salva TODO", exact: true }).click();
  await expect(focus.getByText("Uova")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await page.getByRole("button", { name: /Apri Spesa del sabato/ }).click();
  await expect(focus.getByText("Uova")).toBeVisible();
  await focus.getByRole("button", { name: "Elimina" }).click();
  const confirm = page.getByRole("dialog", { name: "Eliminare questa tile?" });
  await confirm.getByRole("button", { name: "Elimina tile" }).click();
  await expect(page.getByText("Spesa del sabato")).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Impostazioni globali" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await expect(
    page.getByRole("button", { name: "Impostazioni globali" }),
  ).toBeVisible();
  await expect(page.getByText("Uno spazio tutto tuo.")).toHaveCount(0);
});

test("editing shows the grid guides and compacting removes the gaps", async ({
  page,
}) => {
  await expect(page.locator(".grid-guides")).toBeVisible();
  await expect(page.locator(".corner-mark")).toHaveCount(0);
  const snapshot = await (await page.request.get("/api/desktop")).json();
  const tiles = snapshot.tiles.map((t: { y: number }, i: number) =>
    i === 0 ? t : { ...t, y: t.y + 6 },
  );
  expect(
    (
      await page.request.put("/api/desktop", {
        data: {
          ...snapshot,
          settings: {
            ...snapshot.settings,
            rows: Math.max(
              snapshot.settings.rows,
              ...tiles.map((t: { y: number; h: number }) => t.y + t.h),
            ),
          },
          tiles,
        },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  const bottom = async () => {
    const desktop = await (await page.request.get("/api/desktop")).json();
    return Math.max(
      ...desktop.tiles.map((t: { y: number; h: number }) => t.y + t.h),
    );
  };
  const before = await bottom();
  await page
    .getByRole("textbox", { name: "Appunta qualcosa", exact: true })
    .press("Escape");
  await page.keyboard.press("e");
  await expect(
    page.locator('.grid-guides span[style*="visible"]').first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/edit-guides.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Compatta tile" }).click();
  await expect(page.getByText("Spazi vuoti rimossi.")).toBeVisible();
  await expect.poll(bottom).toBeLessThan(before);
  await page.getByRole("button", { name: "Compatta tile" }).click();
  await expect(page.getByText("Il desktop è già compatto.")).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
});

test("folders hold child tiles and persist them", async ({ page }) => {
  await capture(page, "Appunto interno", "Da ricordare");
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page.getByRole("button", { name: /Cartella Un contenitore/ }).click();
  const inspector = page.getByRole("complementary", {
    name: "Proprietà della tile",
  });
  await inspector.getByLabel("Titolo", { exact: true }).fill("Progetto alfa");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.getByRole("button", { name: "Fine", exact: true }).click();
  const folderTile = page
    .getByTestId("tile-folder")
    .filter({ hasText: "Progetto alfa" });
  await expect(folderTile).toBeVisible();
  await folderTile.getByRole("button", { name: /Apri cartella/ }).click();
  const folder = page.getByRole("dialog", { name: "Progetto alfa" });
  await expect(folder).toBeVisible();
  await folder.getByRole("button", { name: "Aggiungi tile" }).click();
  await folder
    .getByRole("button", { name: "Aggiungi Appunto interno alla cartella" })
    .click();
  await expect(folder.getByText("Appunto interno").first()).toBeVisible();
  await expect(
    page.getByTestId("tile-text").filter({ hasText: "Appunto interno" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.keyboard.press("Escape");
  await expect(folderTile.getByText("1 elemento")).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByTestId("tile-folder")
      .filter({ hasText: "Progetto alfa" })
      .getByText("1 elemento"),
  ).toBeVisible();
});

test("settings open fullscreen with sections for agents, data and security", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Impostazioni globali", exact: true })
    .click();
  const settings = page.getByRole("dialog", { name: "Impostazioni globali" });
  await expect(settings.getByLabel("Angoli")).toBeVisible();
  await settings.getByRole("button", { name: "Agente AI" }).click();
  await expect(settings.getByLabel("Indirizzo di Hermes")).toBeVisible();
  await settings.getByRole("button", { name: "Dati e backup" }).click();
  await expect(settings.getByText("tile (max 100)")).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Esporta JSON" }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Sicurezza" }).click();
  await expect(
    settings.getByLabel("Nuova password", { exact: true }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Info" }).click();
  await expect(settings.getByText("Scorciatoie")).toBeVisible();
  await settings.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(settings).toHaveCount(0);
});

test("AI creation lives in the tile catalog and explains missing configuration", async ({
  page,
}) => {
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page.getByRole("button", { name: /Crea con agenti AI/ }).click();
  const dialog = page.getByRole("dialog", { name: "Crea con agenti AI" });
  await dialog
    .getByRole("textbox", { name: "La tua richiesta" })
    .fill("Crea un promemoria per il viaggio");
  await dialog
    .getByRole("button", { name: "Crea con agenti AI", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Configura agente AI" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Impostazioni globali" })
      .getByLabel("Indirizzo di Hermes"),
  ).toBeVisible();
});

test("unified capture converts Markdown tasks and preserves inline additions", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Nota rapida", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "TODO rapido", exact: true }),
  ).toHaveCount(0);
  await capture(
    page,
    "Passi piccoli",
    "Un po’ di **contesto**.\n\n- [x] Primo passo\n- [ ] Secondo passo",
    "data",
  );
  await page
    .getByRole("button", { name: "Apri Passi piccoli", exact: true })
    .click();
  const focus = page.getByRole("dialog", { name: "Vista completa" });
  await expect(focus.locator("strong")).toContainText("contesto");
  await expect(
    focus.getByRole("button", { name: "Primo passo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await focus.getByRole("button", { name: "Da fare", exact: true }).click();
  await expect(
    focus.getByRole("button", { name: "Primo passo", exact: true }),
  ).toHaveCount(0);
  await focus.getByLabel("Nuova attività").fill("Terzo passo");
  await focus.getByLabel("Nuova attività").press("Enter");
  await expect(
    focus.getByRole("button", { name: "Terzo passo", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await page.reload();
  await page
    .getByRole("button", { name: "Apri Passi piccoli", exact: true })
    .click();
  await expect(
    focus.getByRole("button", { name: "Terzo passo", exact: true }),
  ).toBeVisible();
});

test("appearance previews update live and the desktop composition stays above the dock", async ({
  page,
}) => {
  const snapshot = await (await page.request.get("/api/desktop")).json();
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Altre azioni" }).click();
    await page
      .getByRole("button", { name: "Impostazioni globali", exact: true })
      .click();
    const settings = page.getByRole("dialog", { name: "Impostazioni globali" });
    await settings.getByRole("button", { name: "Aria", exact: true }).click();
    await settings.getByRole("slider", { name: /Angoli/ }).press("End");
    const preview = settings.getByRole("complementary", {
      name: "Anteprima aspetto",
    });
    await expect(preview.locator(".preview-metrics")).toContainText("28px");
    await expect(preview.locator(".appearance-detail")).toHaveCSS(
      "border-radius",
      "40px",
    );
    await settings.getByRole("button", { name: "Cielo", exact: true }).click();
    await expect(preview.locator(".appearance-mini-desktop")).toHaveCSS(
      "background-color",
      "rgb(188, 207, 228)",
    );
    await expect(preview).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
    await page.reload();
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(() =>
          page.locator(".desktop-main .tile-shell").evaluateAll((tiles) => {
            const dock = document
              .querySelector(".desktop-tools")!
              .getBoundingClientRect();
            return (
              document.documentElement.scrollHeight <= innerHeight &&
              tiles.every((tile) => {
                const r = tile.getBoundingClientRect();
                return (
                  r.top >= 0 &&
                  r.left >= 0 &&
                  r.right <= innerWidth + 1 &&
                  r.bottom <= dock.top
                );
              })
            );
          }),
        )
        .toBe(true);
    }
  } finally {
    const current = await (await page.request.get("/api/desktop")).json();
    await page.request.put("/api/desktop", {
      data: { ...snapshot, revision: current.revision },
    });
  }
});

test("grid columns and rows persist and a too-small grid keeps all tiles", async ({
  page,
}) => {
  const snapshot = await (await page.request.get("/api/desktop")).json();
  try {
    await page.getByRole("button", { name: "Altre azioni" }).click();
    await page
      .getByRole("button", { name: "Impostazioni globali", exact: true })
      .click();
    const settings = page.getByRole("dialog", { name: "Impostazioni globali" });
    await settings
      .getByRole("combobox", { name: "Colonne (orizzontali)" })
      .selectOption("8");
    await settings
      .getByRole("combobox", { name: "Righe (verticali)" })
      .selectOption("12");
    await expect(settings.locator(".preview-grid-cell")).toHaveCount(96);
    await settings
      .getByRole("combobox", { name: "Righe (verticali)" })
      .selectOption("2");
    await expect(settings.getByRole("alert")).toContainText("non entrano");
    await expect(
      settings.getByRole("combobox", { name: "Righe (verticali)" }),
    ).toHaveValue("12");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
    await page.reload();
    const saved = await (await page.request.get("/api/desktop")).json();
    expect(saved.settings.columns).toBe(8);
    expect(saved.settings.rows).toBe(12);
    expect(saved.tiles.map((t: { id: string }) => t.id)).toEqual(
      snapshot.tiles.map((t: { id: string }) => t.id),
    );
  } finally {
    const current = await (await page.request.get("/api/desktop")).json();
    await page.request.put("/api/desktop", {
      data: { ...snapshot, revision: current.revision },
    });
  }
});

const pdfBase64 = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 20 100 Td (Ciao EDON) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF",
).toString("base64");

test("dropping files creates tiles: PDFs get a preview, other files a download tile", async ({
  page,
}) => {
  await page.evaluate(async (pdf) => {
    const bytes = (b64: string) =>
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(
      new File([bytes(pdf)], "Contratto.pdf", { type: "application/pdf" }),
    );
    data.items.add(new File(["ciao"], "appunti.txt", { type: "text/plain" }));
    window.dispatchEvent(
      new DragEvent("dragenter", { dataTransfer: data, bubbles: true }),
    );
    window.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, pdfBase64);
  const pdf = page.getByTestId("tile-file").filter({ hasText: "Contratto" });
  await expect(pdf).toBeVisible();
  await expect(pdf.locator(".pdf-preview canvas")).toBeVisible();
  await expect(
    page.getByTestId("tile-file").filter({ hasText: "appunti" }),
  ).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  await pdf.getByRole("button", { name: "Apri Contratto" }).click();
  await expect(
    page.getByRole("dialog").locator("iframe.pdf-frame"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const saved = await (await page.request.get("/api/desktop")).json();
  expect(
    saved.tiles.filter((t: { type: string }) => t.type === "file"),
  ).toHaveLength(2);
});

test("weather and timer tiles come from the catalog", async ({ page }) => {
  await page.route("**/api/weather*", (route) =>
    route.fulfill({
      json: {
        location: "Firenze",
        temperature: 21,
        code: 0,
        isDay: true,
        wind: 5,
        min: 12,
        max: 24,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page.getByRole("button", { name: /Meteo Il tempo/ }).click();
  const inspector = page.getByRole("complementary", {
    name: "Proprietà della tile",
  });
  await inspector.getByLabel("Città").fill("Firenze");
  await inspector.getByLabel("Città").blur();
  const weather = page.getByTestId("tile-weather").first();
  await expect(weather.getByText("21°")).toBeVisible();
  await page.getByRole("button", { name: "Fine", exact: true }).click();
  await page.getByRole("button", { name: "Altre azioni" }).click();
  await page
    .getByRole("button", { name: "Aggiungi tile", exact: true })
    .click();
  await page.getByRole("button", { name: /Timer o scadenza/ }).click();
  const timer = page.getByTestId("tile-progress").first();
  await expect(timer.getByRole("progressbar")).toBeVisible();
  await expect(timer).toContainText(/2[45]:\d\d/);
  await page.getByRole("button", { name: "Fine", exact: true }).click();
  await timer.getByRole("button", { name: "Pausa" }).click();
  await expect(timer.getByText("In pausa")).toBeVisible();
  const frozen = await timer.locator(".progress-main").textContent();
  await page.waitForTimeout(2200);
  await expect(timer.locator(".progress-main")).toHaveText(frozen!);
  await timer.getByRole("button", { name: "Riprendi" }).click();
  await expect(timer.getByText("In pausa")).toHaveCount(0);
  await timer.getByRole("button", { name: "Riavvia" }).click();
  await expect(timer).toContainText(/2[45]:\d\d/);
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
});

test("holding a tile lets you reposition it in one gesture", async ({
  page,
}) => {
  await capture(page, "Da spostare", "una nota");
  const tile = page.getByTestId("tile-text").filter({ hasText: "Da spostare" });
  const id = (await tile.getAttribute("id"))!.replace("tile-", "");
  const read = async () =>
    (await (await page.request.get("/api/desktop")).json()).tiles.find(
      (t: { id: string }) => t.id === id,
    );
  const before = await read();
  const box = (await tile.boundingBox())!;
  await page.keyboard.press("e");
  const guide = (await page.locator(".grid-guides span").last().boundingBox())!;
  await page.keyboard.press("Escape");
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await expect(page.locator(".desktop.editing")).toBeVisible();
  await page.mouse.move(box.x + box.width / 2, guide.y + 8, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
  expect((await read()).y).toBeGreaterThan(before.y);
});

test("animated wallpapers are chosen in settings", async ({ page }) => {
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Impostazioni globali" });
  await settings.getByRole("button", { name: "Rumore" }).click();
  await settings.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.locator("canvas.wallpaper-noise")).toBeVisible();
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click();
  await settings.getByRole("button", { name: "ASCII" }).click();
  await settings.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.locator("canvas.wallpaper-ascii")).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Tutto salvato");
});
