# CLAUDE.md

Guidance for AI agents working in this repository. Setup and commands for humans are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Project

pnpm monorepo (run pnpm via `corepack pnpm` if `pnpm` is not on PATH):

- `apps/api-*`: NestJS APIs (patient, doctor, assistant, admin). Controllers use Prisma directly.
- `apps/*-portal`: Vite + React portals. `apps/patient-mobile` is React Native (separate npm project).
- `packages/shared-types`: types and shared business rules (`scheduling.ts`, `appointment-status.ts`). Used by APIs and portals.
- `packages/api-common`: shared Nest services (mail, auth, Prisma, timezone). `packages/portal-common`: shared frontend helpers.

## Deliberate bugs: do not fix them

This is a training app for testers. Feature toggles named `bug:*` (see `FEATURE_TOGGLE_KEYS`) switch on bugs **on purpose**. Never remove or "fix" a toggle's bug behaviour unless the task explicitly says so. Their tests have a "toggle ON (deliberate bug)" block. If one of those fails after your change, you broke the training bug.

## After every change

1. `pnpm test` (about 5 s, no Docker needed). Use `pnpm test:changed` for a quick check while iterating.
2. `pnpm lint` and `pnpm format`.
3. For type changes: `pnpm typecheck` (or `pnpm typecheck:tests` for test files only).

CI runs format check, lint, typecheck and tests. All must stay green.

## Writing tests

- Vitest. Test files sit next to the source: `foo.ts` → `foo.test.ts`.
- Test business rules and edge cases, not wiring, DTOs or markup. Prefer adding a row to an existing `it.each` table over adding a new test file.
- Put new rules in pure functions (e.g. in `packages/shared-types/src/scheduling.ts`) and keep controllers thin: they call the rule and throw the Nest exception.
- Use the helpers from `@clinic/test-utils` (`test-utils/index.ts`):
  - `createPrismaMock()`: deep Prisma mock; all toggles OFF; `$transaction` uses the same mock.
  - `mockToggles(prisma, { "bug:x": true })`: switch toggles on.
  - `freezeTime(iso)`: fix "now". Never depend on the real date.
  - `createMailMock()`, `createEventsMock()`, `tokenFor(sub, roles)`.
- Tests run in `TZ=Europe/Amsterdam`. All scheduling rules are in UTC, while emails and portals show the client's local time. Cover both summer and winter time when touching time code.
- A test for a `bug:*` toggle has both blocks: `toggle OFF – correct` and `toggle ON – deliberate bug`.
- Test files follow the same lint rules as source (explicit return types, typed `vi.fn<...>()`, no conditional `expect`).
