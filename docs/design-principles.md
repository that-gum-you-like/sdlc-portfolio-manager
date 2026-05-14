# Design Principles

> *"Simplicity is not the absence of clutter; that's a consequence of simplicity. Simplicity is somehow essentially describing the purpose and place of an object and product."* — Jony Ive

These principles govern every UI decision in `sdlc-portfolio-manager`. They are not preferences. When two implementation choices conflict, the one that better serves these principles wins.

## 1. Quiet by default

Restrained color. Generous whitespace. Type carries hierarchy.

- One accent color, used sparingly to signal action or current state. Everything else is grayscale.
- Status uses both **color and shape** (a green dot is also a different shape from a red dot) so color-blind users get full information.
- No gradients, no shadows-as-decoration, no patterns. Shadows only where they reinforce affordance (a draggable card lifts on grab).
- Borders are thin and the same weight everywhere. Dividers are spaces, not lines, wherever possible.

## 2. One canonical surface per concept

The board is the board. The inbox is the inbox. We don't show the same data three ways with different chrome.

- `/board` and `/projects/:slug/board` are the same component, scoped differently — not two different boards.
- A discovery is reviewed on `/discoveries/:id`. There is no second review mode in a modal somewhere.
- If a user wants a different cut of the data, they filter — they don't switch to a different surface.

## 3. Progressive disclosure

Essentials on first paint. Depth on intent.

- The dashboard shows four sections (Today's focus, Active work, Health, Recent activity). Maturation, drift, full override history, full automation history live behind "See all" links — not as additional dashboard blocks.
- The graph view defaults to 2 hops. There is no depth toggle in the UI. Users who want 3+ hops navigate by clicking nodes.
- A work item shows title, status, assignee, and 4-dot validation indicator on the card. Everything else is one click away on the detail page.
- Validation findings are summarized as pass/fail/running/skipped. Full stdout/stderr appears only when the user opens that gate's row.

## 4. Direct manipulation over modal dialogs

The interface should respond to the user's hands, not interrupt them.

- Drag a card to change status. Drag in the backlog to reorder. Click a title to edit in place.
- "New item" is a focused side panel that doesn't blur the rest of the screen. Forms inline whenever feasible.
- Modal dialogs are the fallback — used only for destructive confirmations (overrides, deletes that cascade).
- An override-with-reason is a single text field that appears inline on the failed transition, not a multi-step wizard.

## 5. Keyboard-first

Every primary action is reachable from the keyboard. No required mouse paths.

- `cmd-k` opens a command palette that can do everything the UI can do.
- Arrow keys navigate lists. Enter opens. Escape closes.
- Drag-and-drop has a keyboard equivalent (e.g., `j` / `k` to move card between columns).
- Tabbing through forms follows source order; focus rings are visible and meet accessibility contrast.

## 6. Honest materials

Web is the medium. We use web conventions.

- No fake desktop chrome (title bars, traffic lights, native-style toolbars).
- Scrolling behaves like the web — momentum, overscroll, focus rings on focused elements.
- Links look like links. Buttons look like buttons.
- The URL bar is the truth: every state worth bookmarking is in the URL.

## 7. Care in every empty state and every error

Empty states explain the next step. Errors include a fix path.

- Empty `/discoveries` says: "Start with a braindump. Paste meeting notes, voice transcripts, or just type." Below that, a button to `/discoveries/new`.
- Empty board column says nothing — just whitespace. (The board already implies the workflow.)
- A failing validation gate doesn't just say "failed" — it shows the command that ran, the output, and a "Run again" button.
- A 404 page links to `/board`, `/inbox`, and `/library` because those are the three places the user probably meant to be.
- Errors are written in human language. "We couldn't reach the database" beats "Error E12345: SQLITE_CANTOPEN."

## 8. Consistency over novelty

Same widget for the same concept everywhere.

- A status badge looks the same on a board card, on the item detail page, on the dashboard, in the inbox.
- The relationship "Related" panel renders identically on a portfolio, a project, and a work item.
- The library editor (markdown + structured frontmatter form) is the same component for rules, skills, automations, validators, and docs — different schemas, one editor.
- A "Run again" button looks the same whether it's a validation gate, an automation, or a discovery regeneration.

---

## What this means for review

When reviewing a PR that adds UI:

- Does it introduce a new way to look at existing data? If so, consolidate.
- Does it add a setting that users won't change? If so, pick a default and remove the setting.
- Does it use color to signal information? If so, also use shape or text.
- Does it use a modal? If so, justify why an inline panel won't work.
- Does it require the mouse for any primary action? If so, add the keyboard path.
- Does it have an empty state? If so, does the empty state tell the user what to do next?

If the answer to any of those is wrong, the PR is not ready.

## Source

The phrasing borrows from Jony Ive's work at Apple and post-Apple at io (the AI hardware company acquired by OpenAI). The principles also draw on the Linear, Notion, and Things 3 product design schools, which themselves are descendants of Apple HIG and the Bret-Victor school of direct manipulation.

We do not literally copy Apple's UI. We borrow the philosophy: restraint, focus, materiality, care.
