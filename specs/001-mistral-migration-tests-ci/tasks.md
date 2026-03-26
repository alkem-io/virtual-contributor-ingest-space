# Tasks: Migrate to Mistral Platform with Tests and CI

**Input**: Design documents from `/specs/001-mistral-migration-tests-ci/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: Explicitly requested — 90%+ line coverage excluding `generated/`.

**Organization**: Tasks grouped by user story. US1 (Mistral migration) and US2
(error handling/observability) are already implemented on the branch. Remaining
work focuses on US3 (test suite), US4 (CLAUDE.md), and US5 (CI pipeline).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install test tooling and create project structure for testing

- [x] T001 Install Jest dev dependencies: `jest`, `ts-jest`, `@types/jest` in package.json
- [x] T002 Create Jest configuration in jest.config.ts with ts-jest preset, test match `test/**/*.test.ts`, coverage thresholds (90% lines, 90% statements, 85% functions, 80% branches), coverage exclusions for `src/generated/`, `node_modules/`, `dist/`
- [x] T003 Add `test` and `test:coverage` scripts to package.json (`jest` and `jest --coverage`)
- [x] T004 Create test directory structure: test/unit/, test/unit/callout.handlers/, test/unit/data.readers/, test/unit/event.bus/, test/unit/event.bus/events/, test/unit/loaders/, test/unit/summarize/, test/unit/graphql.client/, test/helpers/

**Checkpoint**: `npx jest --showConfig` runs without errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared mock factories that all test files depend on

**⚠️ CRITICAL**: No test writing can begin until this phase is complete

- [x] T005 Create shared mock factories in test/helpers/mocks.ts: mock ChromaClient (getOrCreateCollection, add, delete), mock amqplib (connect, createChannel, consume, sendToQueue, ack), mock ChatMistralAI (invoke returns predictable content), mock OpenAI embeddings client (embeddings.create returns fixed vectors), mock AlkemioCliClient (initialise, logUser, sdkClient), mock Winston logger

**Checkpoint**: Mock factories importable and type-safe

---

## Phase 3: User Story 1 — Ingest Space Data Using Mistral Models (Priority: P1) 🎯 MVP

**Goal**: Verify the Mistral/Scaleway migration works correctly

**Status**: Implementation complete on branch. Tasks below validate the migration via tests.

**Independent Test**: Run `npx jest test/unit/summarize/ test/unit/azure.embedding.function.test.ts test/unit/embed.documents.test.ts test/unit/db.connect.test.ts` and confirm all pass.

### Tests for User Story 1

- [ ] T006 [P] [US1] Write tests for Mistral model initialization and config validation in test/unit/summarize/graph.test.ts: test `modelMistralSmall` creation, `buildGraph` wiring, `calculateProgressiveLength` at various ratios, missing env var throws
- [ ] T007 [P] [US1] Write tests for document-level summarization in test/unit/summarize/document.test.ts: test `summarizeDocument` invokes graph with correct prompts, returns summary content, handles chunk arrays of varying sizes
- [ ] T008 [P] [US1] Write tests for body-of-knowledge summarization in test/unit/summarize/body.of.knowledge.test.ts: test `summariseBodyOfKnowledge` invokes graph, passes recursion limit, returns summary
- [ ] T009 [P] [US1] Write tests for OpenAI-compatible embedding function in test/unit/azure.embedding.function.test.ts: test `OpenAICompatibleEmbeddingFunction.generate` calls OpenAI SDK, returns vectors, logs debug info, handles API errors
- [ ] T010 [P] [US1] Write tests for ChromaDB connection in test/unit/db.connect.test.ts: test `dbConnect` creates client with correct host/port/headers, handles missing credentials
- [ ] T011 [P] [US1] Write tests for embed.documents chunking and embedding pipeline in test/unit/embed.documents.test.ts: test short-chunk merging (<200 chars), summarization threshold (>3 chunks), metadata sanitization (strip non-primitives), progressive summary length, batch insertion to ChromaDB, missing config returns false
- [ ] T012 [P] [US1] Write tests for document generation in test/unit/generate.document.test.ts: test `generateDocument` produces intro/body/context/references sections, handles missing optional fields, HTML description parsing, fallback on parse error
- [ ] T013 [P] [US1] Write tests for constants in test/unit/constants.test.ts: test default values and env var overrides for CHUNK_SIZE, CHUNK_OVERLAP, BATCH_SIZE

**Checkpoint**: All US1 tests pass; migration-specific code paths covered

---

## Phase 4: User Story 2 — Reliable Error Handling and Observability (Priority: P2)

**Goal**: Verify structured error handling and timing metrics

**Status**: Implementation complete on branch. Tasks below validate via tests.

**Independent Test**: Run `npx jest test/unit/embed.body.of.knowledge.test.ts test/unit/event.bus/` and confirm all pass.

### Tests for User Story 2

- [ ] T014 [P] [US2] Write tests for ingestion orchestrator in test/unit/embed.body.of.knowledge.test.ts: test `embedBodyOfKnowledge` success path publishes result, test `setResultError` sets error fields and timestamps, test AlkemioClient init failure returns error result, test failed document read returns error result, test failed embedding returns error result with VECTOR_INSERT code, test timing metrics logged
- [ ] T015 [P] [US2] Write tests for RabbitMQ connection in test/unit/event.bus/connection.test.ts: test Connection class connect/consume/send/disconnect, test message parsing (valid JSON, invalid JSON), test async consumer handler, test summarizationModel field parsing with default fallback
- [ ] T016 [P] [US2] Write tests for ingestion event classes in test/unit/event.bus/events/ingest.body.of.knowledge.test.ts: test IngestBodyOfKnowledge constructor with all fields, default summarizationModel, BodyOfKnowledgeType enum values, SummarizationModel enum values
- [ ] T017 [P] [US2] Write tests for ingestion result class in test/unit/event.bus/events/ingest.body.of.knowledge.result.test.ts: test IngestBodyOfKnowledgeResult constructor, ErrorCode enum values, IngestionResult enum values

**Checkpoint**: All US2 tests pass; error paths and observability covered

---

## Phase 5: User Story 3 — Automated Test Suite with 90% Coverage (Priority: P3)

**Goal**: Complete remaining test files to reach 90%+ line coverage

**Independent Test**: Run `npx jest --coverage` and verify 90%+ lines excluding generated/.

### Tests for User Story 3

- [ ] T018 [P] [US3] Write tests for callout base handler in test/unit/callout.handlers/base.test.ts: test `baseHandler` processes messages, handles missing sender profile (optional chaining), formats dates, skips empty messages
- [ ] T019 [P] [US3] Write tests for callout handler registry in test/unit/callout.handlers/index.test.ts: test `handleCallout` dispatches to correct handler by CalloutContributionType, test Memo type routes to baseHandler, test NONE fallback
- [ ] T020 [P] [US3] Write tests for link collection handler in test/unit/callout.handlers/link.collection.test.ts: test `linkCollectionHandler` processes link callouts, handles empty collections
- [ ] T021 [P] [US3] Write tests for document type mappings in test/unit/document.type.test.ts: test DocumentType enum values, test `typesMap` mappings for SpaceLevel and CalloutFramingType, test `mapType` function, test MimeTypeDocumentMap entries
- [ ] T022 [P] [US3] Write tests for process.callouts in test/unit/process.callouts.test.ts: test callout processing dispatches to handlers, aggregates documents
- [ ] T023 [P] [US3] Write tests for doc loader in test/unit/loaders/doc.loader.test.ts: test document file loading for PDF, DOCX, ODT mime types, handles load errors
- [ ] T024 [P] [US3] Write tests for spreadsheet loader in test/unit/loaders/spreadsheet.loader.test.ts: test spreadsheet loading for XLS, XLSX, ODS mime types
- [ ] T025 [P] [US3] Write tests for loader index in test/unit/loaders/index.test.ts: test loader registry dispatches to correct loader by mime type
- [ ] T026 [P] [US3] Write tests for AlkemioCliClient in test/unit/graphql.client/AlkemioCliClient.test.ts: test initialise authenticates, test logUser logs display name, test optional chaining on missing profile
- [ ] T027 [P] [US3] Write tests for index.ts entry point in test/unit/index.test.ts: test main function sets up connection and consumer, test result logging for success vs failure
- [ ] T028 [P] [US3] Write tests for space data reader in test/unit/data.readers/space.test.ts: test space data fetching via mocked AlkemioCliClient, test document generation from space tree, test error handling on API failure
- [ ] T029 [P] [US3] Write tests for knowledge base data reader in test/unit/data.readers/knowledge.base.test.ts: test knowledge base fetching, test document aggregation, test error handling
- [ ] T030 [P] [US3] Write tests for space tree processor in test/unit/data.readers/process.space.tree.test.ts: test recursive subspace traversal, test callout processing at each level, test empty subspace handling
- [ ] T031 [P] [US3] Write tests for logger in test/unit/logger.test.ts: test `serializeError` extracts message/stack from Error objects, test `getErrorMessage` handles string and Error inputs, test logger transports configured for production vs non-production
- [x] T032 [US3] Run `npx jest --coverage` and verify all thresholds met (90% lines, 90% statements, 85% functions, 80% branches). If any module is below threshold, add targeted tests for uncovered branches.

**Checkpoint**: `npx jest --coverage` passes with all thresholds met

---

## Phase 6: User Story 4 — CLAUDE.md Developer Guidance (Priority: P4)

**Goal**: Create CLAUDE.md with accurate project context for Claude Code sessions

**Independent Test**: Read CLAUDE.md and verify it matches current project structure, commands, and conventions.

- [x] T033 [US4] Write CLAUDE.md at repository root with sections: project description (Alkemio space ingestion service), architecture (RabbitMQ → fetch → chunk → summarise → embed → ChromaDB pipeline), key commands (build, lint, lint:fix, format, test, test:coverage, codegen, start:dev, start), project structure (src/ directories and their purpose), coding conventions (single quotes, trailing comma es5, 2-space indent, Winston structured logging, env vars for config), testing conventions (Jest + ts-jest, mocks in test/helpers/mocks.ts, 90% coverage threshold, exclude generated/), environment setup (list all env vars from .env.default with descriptions)

**Checkpoint**: CLAUDE.md exists and is accurate

---

## Phase 7: User Story 5 — CI Pipeline for Quality Gates (Priority: P5)

**Goal**: GitHub Actions workflow that enforces lint, format, build, and test gates

**Independent Test**: Push a commit and verify the CI workflow runs all steps.

- [x] T034 [US5] Create GitHub Actions workflow in .github/workflows/ci.yml: trigger on push to any branch and pull_request to develop, single job on ubuntu-latest, steps: checkout, setup Node.js 22.x, npm ci, run `npm run lint`, run `npx prettier --check "src/**/*.ts" "graphql/**/*.graphql"`, run `npm run build`, run `npx jest --coverage`; fail pipeline if any step fails
- [x] T035 [US5] Verify CI workflow syntax is valid by running `act --list` or reviewing YAML structure manually

**Checkpoint**: CI pipeline runs and reports pass/fail correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T036 Run full quality gate locally: `npm run lint && npx prettier --check "src/**/*.ts" "graphql/**/*.graphql" && npm run build && npx jest --coverage`
- [x] T037 Verify no secrets or credentials in committed files (scan .env.default, CLAUDE.md)
- [x] T038 Run quickstart.md validation: verify all commands listed in specs/001-mistral-migration-tests-ci/quickstart.md work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Jest installed and configured)
- **US1 Tests (Phase 3)**: Depends on Phase 2 (mock factories available)
- **US2 Tests (Phase 4)**: Depends on Phase 2 (mock factories available); can run in parallel with Phase 3
- **US3 Tests (Phase 5)**: Depends on Phase 2 (mock factories available); can run in parallel with Phases 3-4
- **US4 CLAUDE.md (Phase 6)**: No code dependencies; can start any time after Phase 1
- **US5 CI (Phase 7)**: Depends on Phases 3-5 (needs working test suite to validate)
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Code done. Tests depend only on Phase 2 mock factories.
- **US2 (P2)**: Code done. Tests depend only on Phase 2 mock factories. Independent of US1 tests.
- **US3 (P3)**: Tests depend on Phase 2 mock factories. Independent of US1/US2 tests but runs coverage check that implicitly includes them.
- **US4 (P4)**: Fully independent — no code dependencies.
- **US5 (P5)**: Depends on having a passing test suite (US3 T032 must pass).

### Parallel Opportunities

- T006–T013 (US1 tests): All [P] — can run in parallel (different test files)
- T014–T017 (US2 tests): All [P] — can run in parallel (different test files)
- T018–T031 (US3 tests): All [P] — can run in parallel (different test files)
- Phases 3, 4, 5 can run in parallel (all depend only on Phase 2)
- Phase 6 (CLAUDE.md) can run in parallel with any test phase
- T033 (CLAUDE.md) has zero code dependencies and can start any time

---

## Parallel Example: Test Phases

```bash
# After Phase 2 completes, launch all test files in parallel:
# US1 tests (T006-T013):
Task: "Write tests for Mistral model init in test/unit/summarize/graph.test.ts"
Task: "Write tests for document summarization in test/unit/summarize/document.test.ts"
Task: "Write tests for BoK summarization in test/unit/summarize/body.of.knowledge.test.ts"
Task: "Write tests for embedding function in test/unit/azure.embedding.function.test.ts"
Task: "Write tests for ChromaDB connection in test/unit/db.connect.test.ts"
Task: "Write tests for embed.documents in test/unit/embed.documents.test.ts"
Task: "Write tests for document generation in test/unit/generate.document.test.ts"
Task: "Write tests for constants in test/unit/constants.test.ts"

# US2 tests (T014-T017) — in parallel with above:
Task: "Write tests for ingestion orchestrator in test/unit/embed.body.of.knowledge.test.ts"
Task: "Write tests for RabbitMQ connection in test/unit/event.bus/connection.test.ts"
Task: "Write tests for event classes in test/unit/event.bus/events/"

# US3 tests (T018-T027) — in parallel with above:
Task: "Write tests for callout handlers in test/unit/callout.handlers/"
Task: "Write tests for document types in test/unit/document.type.test.ts"
Task: "Write tests for loaders in test/unit/loaders/"
Task: "Write tests for AlkemioCliClient in test/unit/graphql.client/"
```

---

## Implementation Strategy

### MVP First (US1 Tests Only)

1. Complete Phase 1: Setup (Jest infra)
2. Complete Phase 2: Foundational (mock factories)
3. Complete Phase 3: US1 tests
4. **STOP and VALIDATE**: `npx jest` passes for migration-critical code
5. Continue to remaining stories

### Incremental Delivery

1. Setup + Foundational → Jest working
2. US1 tests → Migration validated
3. US2 tests → Error handling validated
4. US3 tests → Full coverage achieved (90%+)
5. US4 → CLAUDE.md created
6. US5 → CI pipeline enforcing gates
7. Polish → Final validation

---

## Notes

- US1 and US2 code is already implemented on the branch — tasks are test-only
- All test tasks are [P] (parallelizable) within their phase — each writes to a different file
- T032 is the coverage gate — if it fails, add targeted tests before proceeding
- T005 (mock factories) is the critical bottleneck — all test phases depend on it
- CLAUDE.md (T033) is fully independent and can be done at any time
