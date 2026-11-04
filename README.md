# RedMind recreation

An independent recreation of the public pages and browser workspace at https://redmind.onrender.com. Built with React, Vite, Express, Lucide, and React Markdown. The original repository files (`Approval1` and `Approvaltxt`) are unchanged.

## Run locally

Requires Node.js 22.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The server binds to `0.0.0.0` and accepts the Arena preview hostname. Browser requests use relative API URLs. You do not need credentials to explore the interface, use notes, attach files, or manage your workspace.

## Connect live AI

```sh
cp .env.example .env
# Edit .env with your provider key, base URL, and model.
npm run dev
```

The server accepts an OpenAI-compatible chat completions provider using `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`. Environment files load automatically through Node. Restart the server after changing configuration. Keys never enter browser storage or responses. The provider must be reachable from the deployment; Arena's sandbox outbound network restrictions may prevent calling external AI endpoints even with valid credentials.

Messages stream through `/api/chat`; `/api/status` reports whether a key is configured (not whether the upstream key/model is valid). Without a key, the app explicitly shows setup guidance and a useful error instead of generating fake replies. The selected model is controlled by server configuration, not an unverified browser dropdown.

## Included

- Responsive landing page with hero chat preview, capabilities, workflow, project principles, and call-to-action.
- Home, chat, about, sign-in status, and not-found pages.
- Collapsible workspace navigation and mobile drawer.
- Local chat history, new chat, deletion, and text exports.
- Server-backed streamed Markdown responses, GFM code/tables/lists, stop generation, copy, and save-to-note.
- Text/code file attachments, drag-and-drop, attachment removal, and image previews.
- Autosaving notes with copy, download, word count, and confirmed deletion.
- Persistent light/dark theme, custom instructions, and reasoning preference.
- Android announcement dialog, confirmation dialogs, local data reset, and feedback notifications.
- Accessible button labels, modal keyboard containment, reduced-motion support, and responsive layouts.

## Fidelity and integration boundaries

Public text for `/`, `/chat`, `/about`, and `/login` was inspected. Raw source, original CSS/assets, authenticated states, and private APIs were not available; visual styling is independently reconstructed, not verified pixel-identical.

The original site advertises a private free-model pool, automatic fallback/continuation, web search, Google sign-in, and internal model thinking. Those services are **not connected** here. This implementation does not claim to reproduce the original providers or expose private chain-of-thought. The thinking selector stores a preference only. Web search is clearly marked disconnected. Google sign-in and Android are status screens, not fake authentication or downloads. Live AI follows the connected provider's capabilities and policies; the original landing-page copy is reference content, not a guarantee about this backend.

Text attachments are included in prompts. Images are retained for preview/history; image analysis is **not** wired into the text-only provider integration. File size and count limits are enforced in the browser. History/notes/settings live in this browser's localStorage, not on the server. Sending a chat shares that conversation and text attachment contents with the configured AI provider. Very large attachment histories can exhaust browser storage; the app warns if persistence fails. Avoid storing secrets, and export important work.

## Production

```sh
npm run build
npm start
```

Set the same provider variables in the deployment environment. `PORT` defaults to 3000. Before exposing a configured provider publicly, add authentication, rate limiting, usage controls, and a suitable data handling policy. The reference's private free pool is not available, and provider usage may cost money.

## Tests

```sh
npm test                 # build + 7 server/API tests using a local mock provider
npx playwright install chromium  # first-time browser setup
npm run test:e2e         # 10 browser tests; starts/reuses the app on port 3000
```

An existing Chromium can be supplied using `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`. `TEST_URL` can override the browser test base URL. Tests cover navigation, desktop/mobile layout, theme persistence, missing-provider handling, conversation deletion, notes, downloads, settings/reset, attachments, mocked SSE rendering, and dialogs. API tests check production routes, request validation, token streaming, and upstream errors; no external API key or AI access is required.
