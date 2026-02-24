# Chatbot Replacement Rollup

## Scope

Replaced legacy MyFNG chatbot logic with the external chatbot flow from `myfng-chatbot-main/my-fng-app`, while preserving existing app routes used by web and mobile clients.

## What Was Replaced

- API implementation:
  - `apps/web/src/app/api/chatbot/v2/route.ts` now runs the external-style LLM + tool-calling flow.
- Chatbot core modules moved into:
  - `apps/web/src/lib/chatbot_v2/`
  - Added modules: `supabase.ts`, `session.ts`, `telecrm.ts`, `error-handler.ts`, `database-queries.ts`, `booking.ts`, `checklist-queries.ts`, `chatbot-tools.ts`, `chatbot-system-prompt.ts`.
- Compatibility endpoint:
  - `apps/web/src/app/api/chatbot/route.ts` now re-exports `POST` from `v2` to keep old client path working without old logic.

## What Was Decommissioned

Removed legacy chatbot helper files:

- `apps/web/src/app/api/chatbot/bookingTrigger.ts`
- `apps/web/src/app/api/chatbot/serviceResolver.ts`
- `apps/web/src/app/api/chatbot/pricingResolver.ts`
- `apps/web/src/app/api/chatbot/prompt.ts`
- `apps/web/src/app/api/chatbot/dialogManager.ts`
- `apps/web/src/app/api/chatbot/intentDetector.ts`
- `apps/web/src/app/api/chatbot/route.ts.backup`

Removed old internal `chatbot_v2` implementation files:

- `apps/web/src/lib/chatbot_v2/router.ts`
- `apps/web/src/lib/chatbot_v2/types.ts` (legacy version removed and replaced by new module set)
- `apps/web/src/lib/chatbot_v2/memory/context.ts`
- `apps/web/src/lib/chatbot_v2/intent/classifier.ts`
- `apps/web/src/lib/chatbot_v2/reply/builder.ts`
- `apps/web/src/lib/chatbot_v2/reply/language.ts`
- `apps/web/src/lib/chatbot_v2/agent/agent.ts`
- `apps/web/src/lib/chatbot_v2/agent/tools.ts`
- `apps/web/src/lib/chatbot_v2/kb/retriever.ts`

Retained for shared typing compatibility:

- `apps/web/src/app/api/chatbot/types.ts` (used by payments type imports, no runtime chatbot logic)

## Contract Alignment (Web + Mobile)

- API response now includes:
  - `assistantMessage`
  - `message`
  - `session_id`
  - `data.contextPatch.conversationId`
- Added compatibility fallback in clients to support either `assistantMessage` or `response`:
  - `apps/web/src/app/ai-booking/page.tsx`
  - `apps/mobile/src/screens/AIBookingScreen.tsx`
- Fixed Next.js route config compatibility for legacy endpoint:
  - `apps/web/src/app/api/chatbot/route.ts` now imports and re-exports `POST` from `v2`, while defining its own `dynamic` constant (avoids invalid config re-export).

## UI Additions

- Added floating web CTA button:
  - `apps/web/src/components/landing/AskMyFngFloatingButton.tsx`
  - Mounted in `apps/web/src/app/layout.tsx`
- Button label: `Ask MyFNG`
- Behavior: fixed bottom-right CTA opens in-page popup chat widget (iframe to `/ai-booking?embed=1`); hidden when already on `/ai-booking`.
- Embedded mode update:
  - `apps/web/src/app/ai-booking/page.tsx` supports `?embed=1` and hides full-page header/back-link for compact popup chat experience.
  - Header status text no longer exposes raw API path (`AI Assistant • Online/Starting...`).

## Compatibility Shim Added

- Added `apps/web/src/lib/chatbot_v2/db/supabase.ts` with `fetchActiveCategories()` to preserve `apps/web/src/app/services/page.tsx` import after chatbot module replacement.

## Dependency Changes

- No permanent dependency additions required for this replacement.

## Verification Notes

- Lint diagnostics on changed files: no new linter issues reported.
- Full workspace TypeScript check has pre-existing unrelated errors; chatbot replacement changes were validated via targeted file diagnostics and import compatibility updates.
- Runtime smoke tests executed with active web dev server:
  - `POST /api/chatbot/v2` returned valid chatbot JSON response.
  - `POST /api/chatbot` (legacy path) returned valid chatbot JSON response via compatibility route.
