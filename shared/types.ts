/**
 * Shared types entrypoint for the monorepo.
 *
 * IMPORTANT:
 * - `apps/web` resolves `@/shared/*` to `../../shared/*` via tsconfig paths.
 * - Many web pages import from `@/shared/types`, expecting `User`, `ServiceLead`,
 *   pickup/audit types, etc.
 *
 * The canonical definitions live in `shared/types/` (barrel + domain files).
 */

export * from './types/index';
