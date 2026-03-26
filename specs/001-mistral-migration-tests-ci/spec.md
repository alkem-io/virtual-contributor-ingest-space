# Feature Specification: Migrate to Mistral Platform with Tests and CI

**Feature Branch**: `001-mistral-migration-tests-ci`
**Created**: 2026-03-26
**Status**: Draft
**Input**: Migrate AI provider from Azure OpenAI/Mistral to native Mistral platform with Scaleway embeddings; add comprehensive test coverage (90%+), CLAUDE.md, and CI pipeline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingest Space Data Using Mistral Models (Priority: P1)

As a platform operator, I want the ingestion service to use Mistral's
native API for summarization and Scaleway's OpenAI-compatible endpoint
for embeddings, so that the service no longer depends on Azure OpenAI
infrastructure.

**Why this priority**: This is the core functional migration — the
service cannot operate without a working AI provider for summarization
and embeddings. All other stories depend on this working correctly.

**Independent Test**: Can be verified by sending an ingestion message
via RabbitMQ and confirming that documents are summarized using Mistral,
embedded via Scaleway, and stored in ChromaDB with correct metadata.

**Acceptance Scenarios**:

1. **Given** a RabbitMQ ingestion message for a valid Alkemio space,
   **When** the service processes it,
   **Then** documents are fetched, chunked, summarized via Mistral,
   embedded via Scaleway, and stored in ChromaDB with a success result
   published to the output queue.

2. **Given** an ingestion message with a body-of-knowledge containing
   multiple documents of varying sizes,
   **When** the service processes them,
   **Then** documents with more than 3 chunks are summarized individually
   before being combined into a body-of-knowledge summary, and documents
   with 3 or fewer chunks are used directly.

3. **Given** environment configuration for Mistral API key and Scaleway
   embeddings endpoint,
   **When** the service starts,
   **Then** it validates all required configuration is present and fails
   fast with a clear error if any are missing.

---

### User Story 2 - Reliable Error Handling and Observability (Priority: P2)

As a platform operator, I want structured, actionable error messages
and timing metrics throughout the ingestion pipeline, so that I can
diagnose failures without reading source code.

**Why this priority**: The migration introduces new external
dependencies (Mistral API, Scaleway). Operators need visibility into
failures at each pipeline stage to distinguish between configuration
errors, API failures, and data issues.

**Independent Test**: Can be verified by simulating failures at each
pipeline stage (missing config, API timeout, invalid data) and
confirming that structured log entries with context are produced and
failure result messages are published.

**Acceptance Scenarios**:

1. **Given** an embedding API failure during ingestion,
   **When** the error occurs,
   **Then** a structured log entry is produced containing error message,
   stack trace, batch context, and a failure result message with
   error code is published to the output queue.

2. **Given** a successful ingestion run,
   **When** the run completes,
   **Then** timing metrics are logged for total ingestion time, each
   document summarization, and body-of-knowledge summarization.

3. **Given** a document that fails summarization,
   **When** the error occurs,
   **Then** the pipeline continues processing remaining documents and
   logs the specific document that failed with its identifier.

---

### User Story 3 - Automated Test Suite with 90% Coverage (Priority: P3)

As a developer, I want a comprehensive test suite covering at least 90%
of the codebase, so that I can make changes with confidence that
existing functionality is protected by regression tests.

**Why this priority**: The codebase currently has no tests. Adding tests
after the migration ensures the new Mistral/Scaleway integration is
validated and provides a safety net for future changes.

**Independent Test**: Can be verified by running the test suite and
checking that coverage reports show at least 90% line coverage across
all source modules.

**Acceptance Scenarios**:

1. **Given** the test suite is run,
   **When** all tests pass,
   **Then** the coverage report shows at least 90% line coverage across
   source files (excluding the `generated/` directory).

2. **Given** a unit test for the chunk-merging logic,
   **When** short chunks (under 200 characters) are encountered,
   **Then** they are merged with adjacent chunks rather than remaining
   as standalone fragments.

3. **Given** a unit test for the document generation logic,
   **When** a document entity with all fields is processed,
   **Then** the output contains intro, body, context, and reference
   sections formatted for optimal chunking.

---

### User Story 4 - CLAUDE.md Developer Guidance (Priority: P4)

As a developer using Claude Code, I want a CLAUDE.md file in the
repository root that describes the project structure, conventions,
and common commands, so that AI-assisted development sessions start
with the right context.

**Why this priority**: CLAUDE.md improves developer experience but
does not affect runtime behavior. It builds on the understanding
gained from writing the test suite.

**Independent Test**: Can be verified by checking that CLAUDE.md
exists, is accurate to the project structure, and contains build,
test, and lint commands.

**Acceptance Scenarios**:

1. **Given** a new Claude Code session in this repository,
   **When** the session starts,
   **Then** CLAUDE.md provides accurate project description,
   architecture overview, key commands, and coding conventions.

---

### User Story 5 - CI Pipeline for Quality Gates (Priority: P5)

As a developer, I want an automated CI pipeline that runs linting,
formatting checks, and the test suite on every push and pull request,
so that code quality is enforced before merging.

**Why this priority**: CI depends on having a working test suite
(US3) and is the final piece that enforces quality gates
automatically.

**Independent Test**: Can be verified by pushing a commit and
confirming that the CI pipeline runs lint, format check, build, and
tests, and that it blocks merging on failure.

**Acceptance Scenarios**:

1. **Given** a push to any branch or a pull request against develop,
   **When** the CI pipeline triggers,
   **Then** it runs linting, formatting check, build, and test suite
   in sequence, failing the pipeline if any step fails.

2. **Given** a pull request with a linting violation,
   **When** the CI pipeline runs,
   **Then** the pipeline fails and reports which lint rule was violated.

3. **Given** a pull request where all checks pass,
   **When** the CI pipeline completes,
   **Then** the pull request shows a green status check.

---

### Edge Cases

- What happens when the Mistral API key is valid but the model name
  is incorrect or unavailable?
- What happens when a document has zero content after HTML parsing?
- What happens when all chunks in a document are shorter than the
  minimum chunk length (200 characters)?
- What happens when ChromaDB is unreachable during embedding insertion?
- What happens when the Scaleway embeddings endpoint returns
  differently-dimensioned vectors than ChromaDB expects?
- What happens when a RabbitMQ message has an unrecognized
  `summarizationModel` value?

## Clarifications

### Session 2026-03-26

- Q: Should auto-generated files (`generated/` directory, ~3500 lines) be excluded from the 90% coverage target? → A: Yes, exclude `generated/` directory from coverage calculations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Service MUST use Mistral's native API for all
  summarization tasks (document and body-of-knowledge level).
- **FR-002**: Service MUST use an OpenAI-compatible endpoint
  (Scaleway) for generating text embeddings.
- **FR-003**: Service MUST validate all required AI provider
  configuration at startup and fail fast with descriptive error
  messages if any are missing.
- **FR-004**: Service MUST merge text chunks shorter than 200
  characters with adjacent chunks to avoid low-quality fragments.
- **FR-005**: Service MUST only summarize documents that produce more
  than 3 chunks, using chunk content directly for smaller documents.
- **FR-006**: Service MUST sanitize document metadata to contain only
  primitive values before storing in the vector database.
- **FR-007**: Service MUST use progressive summary length scaling,
  allowing summaries to grow proportionally as more chunks are
  processed.
- **FR-008**: Service MUST produce structured log entries with
  timestamps, stage names, space identifiers, and timing metrics at
  each pipeline stage.
- **FR-009**: Service MUST publish a failure result message to the
  output queue when an unrecoverable error occurs, including an error
  code and descriptive message.
- **FR-010**: Service MUST handle the `Memo` callout contribution type
  in addition to existing types (Post, Whiteboard, Link).
- **FR-011**: The automated test suite MUST achieve at least 90% line
  coverage across all source modules, excluding auto-generated files
  (the `generated/` directory).
- **FR-012**: A CLAUDE.md file MUST exist at the repository root with
  accurate project description, architecture, commands, and conventions.
- **FR-013**: A CI pipeline MUST run linting, formatting checks, build,
  and test suite on every push and pull request to develop.
- **FR-014**: The CI pipeline MUST block merging when any quality gate
  fails.

### Key Entities

- **Ingestion Event**: A message received from RabbitMQ containing a
  body-of-knowledge identifier, type, purpose, persona, and optional
  summarization model selection.
- **Body of Knowledge**: A collection of documents fetched from the
  Alkemio platform that represents a space's content. Gets summarized
  into a single overview.
- **Document Chunk**: A segment of a document produced by the text
  splitter, with metadata sanitized for vector database compatibility.
- **Embedding**: A vector representation of a text chunk or summary,
  generated via the embeddings provider and stored in the vector
  database.
- **Ingestion Result**: A message published to the output queue
  indicating success or failure, with timing metadata and optional
  error details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The ingestion pipeline successfully processes spaces end
  to end using the new AI providers, producing identical functional
  outcomes (documents chunked, summarized, embedded, stored) as the
  previous Azure-based pipeline.
- **SC-002**: The automated test suite achieves at least 90% line
  coverage across all source modules (excluding auto-generated files).
- **SC-003**: Every pipeline failure produces a structured log entry
  with enough context to diagnose the root cause without reading
  source code.
- **SC-004**: The CI pipeline catches 100% of linting violations and
  test failures before code reaches the develop branch.
- **SC-005**: A developer starting a new Claude Code session can
  orient themselves using CLAUDE.md within the first minute.

## Assumptions

- The Mistral API and Scaleway embeddings endpoint are stable,
  production-ready services with acceptable latency and uptime.
- The existing RabbitMQ message format is extended (not replaced)
  with the optional `summarizationModel` field, maintaining backward
  compatibility with existing message producers.
- ChromaDB v3.x is a stable release suitable for production use,
  and the migration from v1.x requires only client-side code changes.
- The CI pipeline will use GitHub Actions, as the repository is
  hosted on GitHub.
- The test framework will be Jest, as it is the standard for
  TypeScript projects and supports coverage reporting natively.
- External service calls (Mistral API, Scaleway, ChromaDB, Alkemio
  GraphQL) will be mocked in unit tests; integration tests against
  real services are out of scope for this feature.
