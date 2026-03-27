<!--
Sync Impact Report
===================
- Version change: 0.0.0 → 1.0.0 (initial ratification)
- Added principles:
  - I. Message-Driven Architecture
  - II. Data Pipeline Integrity
  - III. Test Coverage (NON-NEGOTIABLE)
  - IV. Error Handling & Resilience
  - V. Observability
  - VI. Configuration Management
  - VII. Simplicity
- Added sections:
  - Technology Stack Constraints
  - Development Workflow
  - Governance
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no updates needed (generic)
  - .specify/templates/spec-template.md ✅ no updates needed (generic)
  - .specify/templates/tasks-template.md ✅ no updates needed (generic)
- Follow-up TODOs: none
-->

# Alkemio Space Ingestion Service Constitution

## Core Principles

### I. Message-Driven Architecture

All processing MUST be triggered by messages received from a RabbitMQ
queue. The service MUST NOT expose HTTP endpoints or accept direct
invocations. Result notifications MUST be published to a designated
output queue upon completion or failure. Message contracts MUST be
explicitly typed and validated at the boundary.

### II. Data Pipeline Integrity

The ingestion pipeline has four sequential stages: **fetch → chunk →
summarise/embed → store**. Each stage MUST produce a well-defined
output consumed by the next. Data MUST NOT be partially written to
ChromaDB — either the full set of embeddings for a space is persisted
or the operation is treated as failed. Stale data from a previous
ingestion run MUST be replaced atomically.

### III. Test Coverage (NON-NEGOTIABLE)

Every new module and every bug fix MUST include accompanying tests.
Unit tests MUST cover pure logic (chunking, data transformation,
message parsing). Integration tests MUST verify external-system
interactions (RabbitMQ message handling, ChromaDB read/write,
GraphQL client calls) using appropriate test doubles or real
instances. Test files MUST live alongside or mirror the source
structure. The test suite MUST pass before any merge to `develop`.

### IV. Error Handling & Resilience

All external calls (Alkemio GraphQL API, Mistral/Scaleway AI
endpoints, ChromaDB, RabbitMQ) MUST have explicit error handling
with meaningful error messages. Transient failures on external
services SHOULD employ retry with exponential backoff. Unrecoverable
errors MUST be logged, MUST publish a failure result message to the
output queue, and MUST NOT crash the process. The service MUST
gracefully handle RabbitMQ connection loss and attempt reconnection.

### V. Observability

All pipeline stages MUST emit structured log entries via Winston
with at minimum: timestamp, level, stage name, and space identifier.
Errors MUST include stack traces and contextual metadata (e.g.,
which document or chunk failed). Log levels MUST follow standard
semantics: `error` for failures requiring attention, `warn` for
degraded operations, `info` for pipeline progress, `debug` for
detailed diagnostics.

### VI. Configuration Management

All external service connection details (RabbitMQ URL, ChromaDB
host, Alkemio API endpoint, AI provider credentials) MUST be
sourced from environment variables. Secrets MUST NOT be committed
to the repository. Default values MAY be provided for non-sensitive
configuration only. Environment variable names MUST be documented
and validated at startup — the service MUST fail fast with a clear
message if required configuration is missing.

### VII. Simplicity

Prefer direct, straightforward implementations. Do not introduce
abstractions, patterns, or indirection layers unless they solve a
concrete, present problem. Three similar lines of code are
preferable to a premature abstraction. YAGNI applies: do not
build for hypothetical future requirements. LangChain usage MUST
be limited to where it provides clear value (text splitting,
embeddings, summarisation chains); raw SDK calls are preferred
when LangChain adds complexity without benefit.

## Technology Stack Constraints

- **Runtime**: Node.js ≥ 16.15, TypeScript (strict mode)
- **Message Broker**: RabbitMQ via `amqplib`
- **Data Source**: Alkemio GraphQL API via `@alkemio/client-lib`
  and `graphql-request`
- **AI/ML**: LangChain with `@langchain/mistralai` for
  summarisation; Scaleway/OpenAI-compatible endpoint for embeddings
- **Vector Store**: ChromaDB via `chromadb` client
- **Document Parsing**: `pdf-parse`, `mammoth`, `officeparser`,
  `xlsx` for document extraction
- **Logging**: Winston
- **Build**: `tsc` with strict config; ESLint + Prettier for
  linting/formatting
- New dependencies MUST be justified — prefer existing dependencies
  over adding new ones for marginal gains.

## Development Workflow

- All feature work MUST branch from `develop` and merge back via
  pull request.
- Commits MUST be atomic and descriptive — one logical change per
  commit.
- `npm run lint` and `npm run build` MUST pass before pushing.
- Test suite MUST pass in CI before merge.
- GraphQL type generation (`npm run codegen`) MUST be re-run after
  any `.graphql` schema changes and the generated output committed.
- Environment-specific configuration MUST use `.env.*` files that
  are gitignored; only `.env.example` templates are committed.

## Governance

This constitution is the authoritative reference for architectural
decisions and development practices in this project. All pull
requests and code reviews MUST verify compliance with these
principles. Deviations MUST be documented and justified in the
PR description. Amendments to this constitution require:

1. A written proposal describing the change and its rationale.
2. Update to this document with incremented version number.
3. Review of dependent templates for consistency.

Versioning follows semantic versioning: MAJOR for principle
removals or incompatible redefinitions, MINOR for new principles
or material expansions, PATCH for clarifications and wording fixes.

**Version**: 1.0.0 | **Ratified**: 2026-03-26 | **Last Amended**: 2026-03-26
