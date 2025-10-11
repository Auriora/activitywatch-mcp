# Repository Guidelines

## Project Structure & Module Organization
`src/` holds transports (`http-server.ts`), services, tools, and ActivityWatch clients; shared types and helpers live in `types.ts` and `utils/`. Builds land in `dist/`, automation in `scripts/`, docs in `docs/`, and quick-start guides at repo root. Tests mirror runtime code in `tests/`, supported by `tests/helpers/` and `tests/fixtures/`.

## Build, Test, and Development Commands
Run `npm install` once per clone. `npm run build` emits `dist/`, while `npm run watch` rebuilds on change. Use `npm run start` for stdio, `npm run start:http` for the HTTP loop, and `npm run dev:http` to rebuild before launch. Vitest commands: `npm test` (all), `npm run test:unit|test:integration|test:e2e` (scoped), and `npm run test:coverage` (coverage). Validate docs with `npm run check:links`.

## Coding Style & Naming Conventions
Write ES2020 TypeScript under the strict `tsconfig.json` flags. Indent two spaces, prefer single quotes, and add explicit return types on exported APIs. Name services `<Domain>Service`, schemas `*Schema`, and helpers in camelCase. Match config and doc samples in `config/` and `docs/`.

## Testing Guidelines
Vitest specs end with `.test.ts`. Keep unit cases in `tests/unit/`, cross-service flows in `tests/integration/`, and agent interactions in `tests/e2e/`. Reuse mocks from `tests/helpers/` and fixtures from `tests/fixtures/`. Cover new branches before review and confirm with `npm test`; run `npm run test:coverage` when behavior shifts.

## Commit & Pull Request Guidelines
Use conventional commits as in `git log` (e.g., `feat(query-builder): add category filters`). Bundle related changes, include tests or docs, and ensure `npm run build` passes. Pull requests should describe impact, note schema or config changes, link issues, and attach samples or screenshots when APIs shift. Flag follow-up work explicitly.

## Configuration & Environment
Default ActivityWatch endpoint is `http://localhost:5600`; override with `AW_URL`. Expose the HTTP MCP endpoint with `MCP_PORT=3000 npm run start:http` or `./scripts/dev-server.sh`. Set `LOG_LEVEL=DEBUG` for verbose logs. Document new env flags in `DEVELOPMENT-SETUP.md` and keep sample configs aligned with `claude_desktop_config*.json`.

## Augment Agent Protocol
Load `.augment/rules/` at task start and apply the highest-priority instructions. Keep doc updates inside `docs/` and log task-scoped notes in `docs/updates/` using the repository template. When tests change, follow `testing.md` placement guidance and update the checklist. Note consulted rules in implementation notes or PR descriptions. For complex multi-file work, follow the staged planning flow in `planning.md` and pause for approval before execution.
