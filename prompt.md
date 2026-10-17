# PROJECT: Personal Desktop
## A self-hosted, customizable, agent-native personal homepage

You are a senior full-stack engineer and UI/UX designer.

Your task is to design and IMPLEMENT a working MVP of a
self-hosted personal desktop application.

Do not produce only a plan or a static UI mockup.
Build a functional application with persistent storage,
a polished frontend, working APIs, and documentation.

You should make sensible implementation decisions autonomously,
prioritizing simplicity, maintainability, and visual quality.

Read this specification carefully before implementation.

---

# 1. PRODUCT VISION

Build a beautiful, highly customizable personal homepage
that behaves more like a futuristic computer desktop or
experimental operating system launcher than a conventional
productivity dashboard.

The application is primarily intended for personal use.

It is NOT intended to replace:
- Obsidian
- Paperclip
- Notion
- File managers
- Task managers
- Other productivity applications

Instead, it acts as a visually rich access layer over
external applications, documents, notes, and information.

The user should be able to open their homepage and immediately:

- Access frequently used applications.
- See important information at a glance.
- Access pinned notes and documents.
- View personalized widgets.
- Capture a quick note.
- Customize the entire visual composition.

Most importantly, AI agents should be able to programmatically
interact with the desktop.

An external agent should be able to create a new tile,
update its contents, pin information, or modify an
existing tile through a documented API.

The long-term vision is a programmable personal desktop.

However, this MVP must remain focused and manageable.

Core philosophy:

"Anything can become a tile.
 Anything can update a tile."

---

# 2. VISUAL DIRECTION

Visual quality is a FIRST-CLASS REQUIREMENT.

This application must NOT look like a conventional SaaS
dashboard, admin panel, or generic React starter template.

The intended aesthetic combines elements of:

- Nothing OS / CMF design language
- Dot matrix typography and iconography
- Neo-minimalism
- Swiss editorial graphic design
- Experimental typography
- Neo-Y2K graphic design
- Soft minimalism
- Frosted glass and subtle glassmorphism
- Industrial graphic design
- Dithering and halftone textures
- Minimalist gaming console interfaces
- Nintendo Wii-inspired modular launchers

Use the supplied visual references and mockups as inspiration.

Do not copy any existing product directly.

## Fundamental visual concept

A large, centered arrangement of modular square tiles.

Think of a hybrid between:

- A futuristic operating system homepage.
- A customizable Android launcher.
- An experimental editorial design.
- A modular grid of interactive digital objects.

The tiles must be the primary visual element.

Avoid traditional dashboard layouts with permanent sidebars,
large navigation headers, or dense administrative controls.

The interface should feel like a PERSONAL DIGITAL SPACE.

## Layout

Use a responsive grid-based canvas.

The grid should:

- Be centered in the viewport.
- Use square cells as its fundamental unit.
- Support tiles spanning multiple cells.
- Allow drag-and-drop repositioning.
- Allow resizing.
- Have configurable spacing.
- Persist the layout across refreshes.
- Avoid overlapping tiles.

Support 1x1, 2x1, 1x2 and 2x2 tile sizes initially.

Larger tiles may be supported if straightforward.

Use a sufficiently flexible layout system to support
different desktop compositions.

The layout should have breathing room around the edges.

Do not make the interface unnecessarily dense.

## Visual identity of individual tiles

CRITICAL:

Every tile must be allowed to have its own visual identity.

For example, the same desktop could contain:

- A black dot-matrix weather widget.
- A white minimal Obsidian shortcut.
- A lime-green typography-focused notes tile.
- An abstract animated GIF.
- A frosted-glass music tile.
- A monochrome photographic tile.
- A bold editorial-style project tile.

Do not enforce identical styling across all tiles.

However, the overall composition must remain coherent
through spacing, sizing, and consistent interaction behavior.

## Tile appearance properties

Tiles should support configurable:

- Background color.
- Text color.
- Background image.
- Border radius.
- Border style.
- Opacity.
- Typography variant.
- Internal padding.
- Background image positioning.
- Optional glass/blur effects.

Prefer a small set of useful design tokens and presets
over dozens of loosely defined CSS settings.

Provide at least three built-in tile appearance presets:

1. Minimal
2. Dot / Industrial
3. Soft Glass

Allow individual tiles to override their preset.

## Wallpaper

Support:

- Solid backgrounds.
- Gradients.
- Uploaded images.

The wallpaper should be an important part of the composition.

Animated wallpapers can be postponed.

## Motion

Use subtle, polished animations:

- Tile hover feedback.
- Smooth drag-and-drop interactions.
- Pleasant resizing transitions.
- Subtle appearance/disappearance animations.
- Smooth transition into edit mode.

Animations should feel responsive and tactile.

Avoid excessive motion.

Respect prefers-reduced-motion.

## Typography

Combine modern sans-serif typography with monospace
and optionally dot-matrix-inspired display typography.

Typography should be used deliberately to create
visual hierarchy and personality.

Avoid relying exclusively on generic UI typography.

Use appropriately licensed fonts.

## Default aesthetic

The initial application should lean toward:

- Nothing-inspired monochrome UI.
- Soft minimalism.
- Experimental editorial compositions.
- Occasional bright accent colors.
- Subtle grain, texture, and abstract imagery.

Start from a visually striking default desktop.

The application should look appealing BEFORE the user
starts customizing it.

---

# 3. APPLICATION STRUCTURE

The MVP consists of a SINGLE customizable homepage.

Do not implement multiple pages/workspaces yet.

The interface has two primary modes.

## VIEW MODE

The normal desktop experience.

Tiles are interactive.

Users can:

- Open links.
- View information.
- Interact with supported widgets.
- Capture a note.
- Access external applications.

Editing controls should not dominate the interface.

Keep the visual chrome minimal.

## EDIT MODE

Activated through a small button or keyboard shortcut.

Users can:

- Drag tiles.
- Resize tiles.
- Add tiles.
- Delete tiles.
- Edit tile properties.
- Change tile appearance.
- Change the wallpaper.

Use a simple property inspector for editing a selected tile.

The editor must feel intuitive and visually integrated
with the desktop.

Do not build a complicated visual page builder.

---

# 4. TILE SYSTEM

Implement a modular tile architecture.

All tiles must share a common underlying data model.

Each tile should have:

- Unique identifier.
- Tile type.
- Position.
- Width and height in grid units.
- Appearance configuration.
- Type-specific configuration.
- Optional external URL.
- Created/updated timestamps.
- Optional expiration timestamp.
- Origin: user or agent.

The system should support creating tiles dynamically
without editing the application's source code.

## Required tile types

### 4.1 Link Tile

A customizable shortcut to an external URL or application.

Properties:

- Title
- Subtitle
- Icon or image
- Destination URL
- Appearance settings

Clicking it opens the destination.

Support custom URL schemes such as obsidian:// where
browser and operating system restrictions permit.

Examples:

Obsidian, Paperclip, GitHub, terminal web UI,
self-hosted applications, personal websites.

### 4.2 Image Tile

Displays:

- Uploaded image.
- GIF.
- Image URL.

Support cover/contain fitting.

Clicking can optionally open a configured destination.

This tile may be purely decorative.

### 4.3 Text Tile

Displays text or a limited Markdown subset.

Useful for:

- Personal notes.
- Quotes.
- Reminders.
- Short project summaries.
- Pinned information.

Keep rendering clean and secure.

Do not allow arbitrary embedded scripts.

### 4.4 Data Tile

A structured tile whose content can be updated
through the application API.

It should support a small but flexible declarative schema.

Possible content:

- Title
- Subtitle
- Body
- List of items
- Status indicator
- Small metadata labels
- Optional image
- Optional primary link

Examples:

- Daily news summary.
- Weather information.
- Meeting decisions.
- Important reminders.
- Project status.

An AI agent must be able to create or update these tiles.

The content must survive page refreshes and server restarts.

Support optional automatic expiration.

### 4.5 Obsidian Tile

A shortcut or preview associated with an Obsidian note.

Minimum functionality:

- Display note title.
- Show a short preview when accessible.
- Open the note in Obsidian.
- Support pinning a specific note.

More details about Obsidian integration follow below.

### 4.6 Clock Tile

A visually customizable clock/date tile.

Support local time and a configurable time zone.

This should be implemented as a normal tile,
not a special fixed element outside the grid.

---

# 5. AGENT-NATIVE ARCHITECTURE

This is one of the most important requirements.

The application must be designed to work with
EXTERNAL AI AGENTS.

Examples include:

- Hermes Agent
- OpenAI Codex
- Claude-based agents
- Other MCP-compatible systems

The application must NOT depend on a specific LLM.

Do NOT implement a built-in chatbot or LLM inference
system for the MVP.

Instead, expose programmatic capabilities through:

1. REST API
2. MCP server

Both must use the same underlying application services.

## Required agent capabilities

An agent should be able to:

- List existing tiles.
- Inspect tile metadata.
- Create a tile.
- Update tile content.
- Update tile appearance.
- Delete an agent-created tile.
- Create or update a tile by a stable external key.
- Retrieve the available tile types and their schemas.
- Retrieve the current layout.

Agents should NOT automatically rearrange user-created tiles.

Agent-created tiles should be placed in an available area
without overlapping existing tiles.

The user must remain in control of the desktop.

## REST API

Implement a small, documented JSON API.

Suggested endpoints:

GET    /api/tiles
POST   /api/tiles
GET    /api/tiles/:id
PATCH  /api/tiles/:id
DELETE /api/tiles/:id

PUT    /api/tiles/by-key/:key

GET    /api/tile-types
GET    /api/layout
PUT    /api/layout

The exact API structure may be refined.

The important requirement is that external agents
can reliably create and update tiles.

The stable-key operation should be idempotent.

For example:

An agent publishing daily news should update the existing
news tile rather than create a duplicate every morning.

Provide input validation and consistent error responses.

## MCP Server

Expose the core tile operations through MCP.

Required tools:

- list_tiles
- create_tile
- update_tile
- upsert_tile
- delete_tile
- get_layout
- list_tile_types

Use the official MCP SDK where practical.

The MCP implementation should be a thin adapter over
the same backend services used by the REST API.

Provide an example configuration for connecting
an external MCP-compatible agent.

Document how Hermes could use these tools.

Do not assume the agent runs inside the same process.

## Agent example: meeting summary

The following workflow should be possible:

1. An external agent receives a meeting transcript.
2. The agent saves the transcript in Obsidian using
   its own Obsidian integration.
3. The agent calls the dashboard API.
4. The dashboard creates a Data Tile.
5. The tile contains:
   - Meeting title.
   - Key decisions.
   - Action items.
   - Link to the Obsidian note.
6. The tile appears on the homepage.
7. The tile can optionally expire after seven days.

The dashboard itself does not need to process transcripts.

## Agent example: daily news

An external agent runs a scheduled task.

It retrieves news and generates a summary.

It calls the API using a stable tile key:

daily-news

The dashboard updates the corresponding tile.

Do NOT implement the news retrieval or scheduler.

Those responsibilities belong to the external agent.

## Agent example: weather

An external agent collects weather information.

It creates or updates a Data Tile with:

- Temperature.
- Current conditions.
- Location.
- Forecast summary.
- Relevant icon/image.
- Appearance configuration.

The dashboard should display the information without
having to implement the weather provider itself.

---

# 6. CUSTOM WIDGETS: FUTURE EXTENSIBILITY

The long-term project must support agent-generated
custom widgets.

For example, an AI agent should eventually be able
to create a completely custom weather widget with
unique animations and rendering behavior.

However:

DO NOT implement a full arbitrary-code widget SDK
in this MVP.

This would add significant complexity and introduce
security risks.

For now:

- Keep tile rendering modular.
- Define clear TypeScript interfaces for tile types.
- Separate tile data from tile presentation.
- Support declarative appearance customization.
- Document how a future custom widget system could work.

Do not execute arbitrary JavaScript submitted
through the REST or MCP API.

Do not use unsafe dynamic code execution.

The architecture should make future custom widgets
possible without requiring a complete rewrite.

A future implementation could use sandboxed iframes,
explicit capabilities, and a restricted communication API.

But that is outside the MVP scope.

---

# 7. OBSIDIAN INTEGRATION

Obsidian is the primary external content system.

The dashboard should NOT become a replacement
for Obsidian.

Do not implement:

- A full Markdown editor.
- A knowledge graph.
- A document database.
- Complex note organization.
- A second independent note management system.

## Required integration

Support Obsidian deep links.

Users must be able to create tiles pointing to
specific Obsidian notes.

Support the obsidian:// URI scheme.

## Optional local vault integration

Allow the application to access a configured
Obsidian vault directory.

The vault directory should be mounted into
the Docker container.

When configured, support:

- Listing Markdown files.
- Selecting a note.
- Displaying a short preview.
- Opening the note through Obsidian.

Use secure path handling.

Never allow path traversal outside the configured vault.

Handle missing or unavailable vaults gracefully.

## Quick Capture

Provide a minimal quick-capture feature.

The user should be able to:

1. Click a small capture button.
2. Type a short note.
3. Save it.

If a writable Obsidian vault is configured,
save the note as a Markdown file in a configurable
Inbox folder inside the vault.

Use collision-safe filenames.

If no writable vault is configured,
explain clearly that capture requires configuration.

Do not silently create a separate note database.

Avoid modifying existing Obsidian notes unless
explicitly requested.

---

# 8. DATA STORAGE

The application should store only information
required to operate the desktop.

Use SQLite.

Persist:

- Application settings.
- Layout configuration.
- Tile definitions.
- Tile appearance.
- Small tile content payloads.
- External references.
- Widget metadata.
- Authentication and API token metadata.

Do not duplicate entire Obsidian vaults.

Do not build a universal document database.

Do not introduce:

- PostgreSQL unless necessary.
- Redis.
- Vector databases.
- Message queues.
- Complex microservices.

Uploaded wallpapers and images may be stored
in a persistent filesystem directory.

Keep the system lightweight.

---

# 9. TECHNICAL STACK

Preferred stack:

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- A mature draggable/resizable grid library

Backend:
- Node.js
- TypeScript
- Fastify or equivalent lightweight framework

Database:
- SQLite
- Lightweight ORM or typed database layer

Agent integration:
- REST
- MCP TypeScript SDK

Deployment:
- Docker
- Docker Compose

Use a simple monorepo structure if useful.

Suggested structure:

/
  apps/
    web/
    server/
  packages/
    shared/
  docker-compose.yml
  README.md

Feel free to adjust the structure if there
is a clear technical justification.

Prefer maintainable, understandable code
over excessive architectural abstraction.

Use strict TypeScript types.

Avoid unnecessary dependencies.

---

# 10. SECURITY

Even though this is a personal self-hosted application,
basic security is required.

Implement:

- Single-user authentication.
- Secure password hashing.
- API token authentication for agents.
- Server-side validation.
- Safe Markdown rendering.
- Safe image/file handling.
- Protection against path traversal.
- Secure handling of external URLs.
- No unauthenticated write endpoints.

API tokens should support restricted capabilities
where practical.

In particular, distinguish reading tiles from
creating/updating them.

Do not expose the server's filesystem through
the widget system.

Do not execute arbitrary code provided by agents.

Assume deployment may eventually be accessed
through a VPN or reverse proxy.

Document safe deployment practices.

---

# 11. DEFAULT DESKTOP

The application must start with a visually compelling
example desktop.

Do not show an empty screen on first launch.

Populate the initial layout with example tiles.

Suggested default composition:

- Large clock/date tile.
- Obsidian shortcut tile.
- Paperclip shortcut tile.
- Example notes tile.
- Example project summary tile.
- Decorative abstract image tile.
- Quick Capture control.
- Example agent-updated information tile.

Use a balanced composition with multiple tile sizes.

Give different tiles distinct visual styles.

For example:

Clock:
Black background, white dot-matrix typography.

Obsidian:
Soft white background, minimal iconography.

Notes:
Bright lime accent, experimental typography.

Project:
Monochrome photography, editorial layout.

Decorative:
Abstract geometric imagery.

Agent data:
Minimal card with clear hierarchy.

These are examples, not strict requirements.

The final composition should be visually curated.

Use locally available assets, generated geometric
artwork, or appropriately licensed imagery.

Do not rely on broken external image URLs.

Important:

The design should feel like an experimental
desktop environment, not a template dashboard.

---

# 12. USER EXPERIENCE DETAILS

Support:

- Persistent layout editing.
- Drag-and-drop.
- Tile resizing.
- Tile creation and deletion.
- Appearance editing.
- Wallpaper customization.
- Keyboard shortcut for edit mode.
- Responsive behavior.
- Empty/loading/error states.

Keyboard interactions should be accessible.

Avoid forcing mobile users to manipulate
a dense desktop-sized grid.

For the MVP, mobile may use a simplified layout
with the same tile content.

Full independent mobile layout editing
can be postponed.

The application must remain reasonably usable
on smaller screens.

---

# 13. EXPLICITLY OUT OF SCOPE

Do not implement the following in the MVP:

- Multiple dashboard pages.
- Multi-user collaboration.
- User accounts and organizations.
- AI chat interface.
- Embedded LLM inference.
- Advanced contextual recommendation engine.
- Automatic calendar/travel detection.
- Full Obsidian editor.
- Full Paperclip integration.
- Complex task management.
- Custom executable widget marketplace.
- Arbitrary agent-generated JavaScript execution.
- Native desktop application.
- Native mobile application.
- Cloud hosting infrastructure.
- Complex plugin marketplace.

Focus on delivering a polished, functional,
extensible personal desktop.

---

# 14. DELIVERABLES

Produce a complete working repository.

Include:

1. Functional React frontend.
2. Functional backend.
3. SQLite persistence.
4. REST API.
5. Working MCP server.
6. Obsidian integration described above.
7. Docker Compose configuration.
8. Example environment configuration.
9. Setup documentation.
10. API documentation.
11. Basic automated tests.
12. A polished default desktop.

The README must explain:

- How to install the application.
- How to run it locally.
- How to deploy it with Docker Compose.
- How to configure Obsidian.
- How to customize the desktop.
- How to create tiles.
- How to connect an AI agent.
- How to create/update a tile through the REST API.
- How to use the MCP tools.
- How data is stored and backed up.

Provide practical examples using curl.

---

# 15. ACCEPTANCE CRITERIA

The MVP is complete when all the following work:

TEST 1 — FIRST LAUNCH

Run Docker Compose.

Open the application in a browser.

Authenticate.

A polished default desktop appears.

The application does not require cloud services.

TEST 2 — CUSTOMIZATION

Enter edit mode.

Move a tile.

Resize a tile.

Change its appearance.

Refresh the browser.

The layout and appearance remain unchanged.

TEST 3 — CREATE A TILE

Create a new link tile.

Assign a title, icon, and URL.

Place it on the desktop.

Clicking the tile opens the configured destination.

TEST 4 — IMAGE CUSTOMIZATION

Create an image tile.

Upload an image or GIF.

Resize and reposition it.

The media remains available after restarting
the application.

TEST 5 — OBSIDIAN

Configure an Obsidian vault.

Create a tile linked to a note.

Display a preview when the vault is accessible.

Open the note using the Obsidian URI.

TEST 6 — QUICK CAPTURE

Open Quick Capture.

Enter a note.

Save it.

Verify that a Markdown file appears in the
configured Obsidian Inbox.

TEST 7 — AGENT TILE CREATION

Using an authenticated API request,
create a Data Tile containing a meeting summary.

The tile should immediately appear on the desktop
without refreshing the entire application.

TEST 8 — AGENT TILE UPDATE

Use the stable-key API to update the same tile.

Verify that its contents change.

Verify that no duplicate tile is created.

TEST 9 — MCP

Connect an MCP client.

List the available tools.

Create a tile using an MCP tool.

Verify that the tile appears in the frontend.

TEST 10 — PERSISTENCE

Restart all application containers.

Verify that:

- Settings are preserved.
- Tiles are preserved.
- Layouts are preserved.
- Uploaded assets remain available.
- Agent-generated tile content remains available.

TEST 11 — SECURITY

Verify that unauthenticated requests cannot
create or modify tiles.

Verify that attempts to access paths outside
the Obsidian vault are rejected.

Verify that rendered Markdown cannot execute scripts.

---

# 16. IMPLEMENTATION STRATEGY

Implement the project incrementally.

Suggested order:

PHASE 1:
Project scaffolding, application shell,
database, and initial tile model.

PHASE 2:
Grid rendering, drag-and-drop,
tile resizing, persistence.

PHASE 3:
Visual styling, tile appearance presets,
wallpaper support, polished default desktop.

PHASE 4:
Obsidian links, note previews,
and Quick Capture.

PHASE 5:
REST API and agent-managed Data Tiles.

PHASE 6:
MCP integration.

PHASE 7:
Testing, polish, documentation,
and Docker deployment.

Do not sacrifice core functionality
for speculative future features.

However, do not postpone visual quality
until the very end.

The visual design is central to the product.

Continuously verify the UI while implementing it.

Use screenshots or browser-based visual inspection
when tooling is available.

---

# 17. ENGINEERING EXPECTATIONS

Before implementation:

- Inspect the existing repository, if present.
- Briefly describe the implementation approach.
- Identify important architectural decisions.
- Identify any obvious risks.

Then proceed with implementation.

Do not stop after planning.

Prefer working software over theoretical architecture.

Implement the simplest reasonable solution
that fulfills the acceptance criteria.

Where requirements are ambiguous,
make a sensible decision and document it.

Avoid unnecessary clarification questions
unless a decision would substantially change
the project.

After implementation:

- Run the application.
- Run available tests.
- Fix build and runtime errors.
- Verify the main user workflows.
- Report implemented functionality.
- Report incomplete functionality.
- Document how to run the application.

Never claim a feature is working unless
it has actually been implemented and verified.

---

# 18. FINAL PRODUCT PRINCIPLE

The user should feel like they are opening
a beautiful, personalized digital desktop.

Not a project management application.

Not an admin dashboard.

Not another note-taking application.

It should be an expressive, modular, lightweight
personal environment where information,
applications, images, and AI-generated content
coexist as customizable tiles.

The desktop should be useful even without AI.

But AI agents should be able to extend its usefulness
through simple, documented interfaces.

Prioritize:

VISUAL QUALITY
CUSTOMIZATION
SIMPLICITY
AGENT INTEROPERABILITY
SELF-HOSTING

Build the MVP.