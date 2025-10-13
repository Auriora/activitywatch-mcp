# Contributing to ActivityWatch MCP

Thanks for your interest in improving the ActivityWatch MCP server! This
document outlines how to propose changes, report issues, and collaborate with
the maintainers and broader community.

## Ways to contribute

- **Report bugs** or request features via GitHub issues. Please include
  reproduction steps, logs, or representative ActivityWatch data where possible.
- **Discuss forward-looking work** by drafting or updating plans in
  [`docs/plans/`](docs/plans/). Plans help align multi-step efforts before
  implementation begins.
- **Log completed work** in [`docs/updates/`](docs/updates/) using the
  provided template so others can understand the impact of your changes.
- **Improve documentation** anywhere in `docs/`, keeping navigation and cross
  references up to date.
- **Fix bugs or add features** in `src/`, ensuring behavior remains consistent
  with ActivityWatch expectations.

## Development setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/bcherrington/activitywatcher-mcp.git
   cd activitywatcher-mcp
   npm install
   ```
2. Run `npm run build` to compile TypeScript sources.
3. For rapid iteration, start the HTTP transport via `npm run start:http` and
   point your MCP client at `http://localhost:3000/mcp` (see
   [DEVELOPMENT-SETUP.md](DEVELOPMENT-SETUP.md)).

## Coding standards

- TypeScript is compiled with strict settings; ensure new code passes
  `npm run build` without warnings.
- Follow existing patterns for services, transports, and utilities. Tool
  schemas live in `src/tools`, services in `src/services`, and helpers in
  `src/utils`.
- Prefer small, focused commits with clear messages (Conventional Commit style
  encouraged: e.g., `feat(http-server): add session telemetry`).
- Add concise code comments only where behavior is not self-explanatory.

## Planning & updates

- Use `docs/plans/` for forward-looking, multi-step initiatives (coverage
  programmes, migrations, new transports). Plans should describe scope,
  milestones, risks, and references.
- After landing code, capture the implementation details in
  `docs/updates/`—the README and template there outline the structure and
  naming conventions.

## Testing

- Run `npm test` (Vitest) before submitting a pull request. If changes only
  affect a subset, include the specific commands you executed in the PR (e.g.,
  `npm run test:unit -- --run tests/unit/services/query.test.ts`).
- Ensure `npm run test:coverage` remains healthy when coverage-related code is
  touched. Plans in `docs/plans/` describe the current thresholds and goals.

## Documentation expectations

- Update relevant documentation when behavior, configuration, or public APIs
  change. The docs are organised by topic (`concepts/`, `reference/`,
  `developer/`, `updates/`, `plans/`).
- When adding new environment variables or setup steps, document them in both
  the appropriate doc section and, if relevant, `DEVELOPMENT-SETUP.md`.

## Submitting a pull request

1. Fork the repository and create a topic branch.
2. Make your changes, including tests and documentation as appropriate.
3. Run the relevant test suites.
4. Commit with a descriptive message.
5. Open a pull request describing the change, referencing any related plans or
   issues. Include testing details and screenshots/logs for behavioral changes.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md). Instances of
abusive, harassing, or otherwise unacceptable behavior can be reported to the
maintainers through the contact methods listed in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
project's [GNU GPL v3.0](LICENSE).
