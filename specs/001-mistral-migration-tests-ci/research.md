# Research: Migrate to Mistral Platform with Tests and CI

## R1: Vitest Configuration for TypeScript Projects

**Decision**: Use Vitest with `vitest.config.ts` and v8 coverage provider.

**Rationale**: Vitest is the standard testing framework across the Alkemio stack.
It provides native TypeScript support, fast execution, and built-in coverage
reporting. The project uses TypeScript with CommonJS modules, which Vitest
handles via its transform pipeline.

**Configuration choices**:
- Coverage provider: v8
- Test match: `test/**/*.test.ts`
- Coverage: enabled with `--coverage` flag, thresholds enforced at 90% lines
- Coverage exclusions: `src/generated/`, `node_modules/`, `dist/`
- Module name mapper: not needed (project uses relative imports, no path aliases)
- Test environment: `node` (no DOM needed for a backend service)

**Alternatives considered**:
- Jest + ts-jest: Initially chosen, then migrated to Vitest for consistency
  with the rest of the stack and faster test execution.
- Mocha + Chai + nyc: more setup required, less integrated coverage.

## R2: Mocking Strategy for External Dependencies

**Decision**: Use Vitest's built-in `vi.mock()` for module-level mocks and manual
mock factories in `test/helpers/mocks.ts` for shared test doubles.

**Rationale**: The service has 5 external dependencies that must be mocked:
1. **RabbitMQ (amqplib)**: Mock `connect`, channel creation, `consume`, `sendToQueue`
2. **ChromaDB (chromadb)**: Mock `ChromaClient`, `getOrCreateCollection`, `add`, `delete`
3. **Mistral (ChatMistralAI)**: Mock invoke to return predictable summaries
4. **Scaleway embeddings (OpenAI)**: Mock `embeddings.create` to return fixed vectors
5. **Alkemio GraphQL client**: Mock `AlkemioCliClient` methods

Vitest's `vi.mock()` with factory functions is the standard approach. Creating a shared
`mocks.ts` helper avoids duplication across 20+ test files.

**Alternatives considered**:
- Nock (HTTP-level mocking): Too low-level for SDK-wrapped clients. Would need to
  replicate internal SDK HTTP patterns. Module mocking is cleaner.
- Testcontainers: Excellent for integration tests but out of scope (spec excludes
  integration tests against real services).

## R3: Coverage Enforcement Strategy

**Decision**: Enforce coverage thresholds in Vitest config with `coverage.thresholds`
set to 90% for lines, and also enforce in CI via the same mechanism (Vitest exits
non-zero when thresholds are not met).

**Rationale**: Single source of truth for coverage — configured in `vitest.config.ts`,
enforced locally and in CI without separate tooling.

**Configuration**:
```typescript
coverageThreshold: {
  global: {
    lines: 90,
    branches: 80,
    functions: 85,
    statements: 90,
  },
}
```

Branch coverage set lower (80%) because some error-handling branches are difficult to
trigger in unit tests without complex setup. Function coverage at 85% accounts for
re-exported functions and type guards that may not need direct testing.

## R4: GitHub Actions CI Pipeline Design

**Decision**: Single workflow file `.github/workflows/ci.yml` triggered on push and
pull_request to `develop`. Steps: checkout → Node.js setup (Volta-pinned version) →
`npm ci` → lint → format check → build → test with coverage.

**Rationale**: The project already has 4 deployment workflows. Adding a single CI
workflow for quality gates keeps the pipeline simple. Using `npm ci` ensures
reproducible installs from lockfile.

**Key decisions**:
- Node version: 22.x (matching Volta pin in package.json)
- Lint step: `npm run lint` (existing script: `tsc --noEmit && eslint`)
- Format check: `npx prettier --check "src/**/*.ts" "graphql/**/*.graphql"`
- Build: `npm run build`
- Test: `npx vitest run --coverage` (coverage thresholds enforced by Vitest config)
- No caching for now — npm ci is fast enough for this project size

**Alternatives considered**:
- Separate jobs for lint/test/build: Overkill for a small project. Sequential steps
  in a single job are simpler and the total run time is under 3 minutes.
- Matrix testing across Node versions: Not needed — service targets a specific
  distroless Node.js 22 container. Testing on 22 only.

## R5: CLAUDE.md Content Strategy

**Decision**: CLAUDE.md provides project overview, architecture diagram (text-based),
key commands, file structure guide, coding conventions, and testing conventions.

**Rationale**: CLAUDE.md is read at session start by Claude Code. It should contain
stable, structural information that rarely changes — not transient project state.

**Sections**:
1. Project description (one paragraph)
2. Architecture (pipeline stages, external dependencies)
3. Key commands (build, lint, format, test, codegen, start)
4. Project structure (key directories and their purpose)
5. Coding conventions (from constitution: naming, error handling, logging)
6. Testing conventions (Vitest, mock strategy, coverage requirements)
7. Environment setup (required env vars, .env files)

## R6: Test File Organization

**Decision**: Tests in `test/unit/` mirroring `src/` directory structure. Shared mocks
in `test/helpers/mocks.ts`.

**Rationale**: The constitution states "Test files MUST live alongside or mirror the
source structure." A parallel `test/` tree was chosen over co-located `__tests__`
directories because:
- Keeps `src/` clean (no test files in source)
- Easier to configure coverage exclusions
- Clear separation in the file tree
- Standard pattern for Node.js services

**Alternatives considered**:
- Co-located `__tests__/` directories: Valid but clutters source tree in a small project
  where every directory has only 1-3 source files.
- `src/**/*.test.ts` (same directory): Risk of accidentally including test files in
  production build. Requires tsconfig exclusions.
