# Implementation Plan: Migrate to Mistral Platform with Tests and CI

**Branch**: `001-mistral-migration-tests-ci` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mistral-migration-tests-ci/spec.md`

## Summary

Migrate the AI provider stack from Azure OpenAI/Mistral to native Mistral API
(summarization) and Scaleway OpenAI-compatible endpoint (embeddings), upgrade
ChromaDB client from v1.x to v3.x, improve summarization prompts and chunking
logic, add structured logging with timing metrics, then retrofit a comprehensive
Jest test suite (90%+ coverage excluding generated code), create CLAUDE.md, and
add a GitHub Actions CI pipeline for lint/format/build/test gates.

## Technical Context

**Language/Version**: TypeScript 5.3+ on Node.js 22 (Volta-pinned), target ES2018, CommonJS modules
**Primary Dependencies**: `@langchain/mistralai` (summarization), `@chroma-core/openai` + `openai` (embeddings), `chromadb` v3.3 (vector store), `amqplib` (RabbitMQ), `@alkemio/client-lib` + `graphql-request` (Alkemio API), `@langchain/langgraph` (summarization graph), Winston (logging)
**Storage**: ChromaDB (vector database, external service)
**Testing**: Jest with `ts-jest` preset, coverage thresholds enforced, `generated/` excluded
**Target Platform**: Linux containers (distroless Node.js 22), deployed via Kubernetes
**Project Type**: Background worker service (message-driven, no HTTP)
**Performance Goals**: Process a full space ingestion within reasonable time; AI provider latency dominates
**Constraints**: Single-instance queue consumer; all config via environment variables
**Scale/Scope**: ~27 source files (excluding generated), single service

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Message-Driven Architecture | PASS | Service triggered by RabbitMQ, publishes results to output queue. No HTTP endpoints. |
| II. Data Pipeline Integrity | PASS | fetch → chunk → summarise/embed → store pipeline maintained. ChromaDB collection uses delete-then-recreate pattern (not truly atomic — a brief window exists where the collection is absent; acceptable for single-consumer queue). |
| III. Test Coverage (NON-NEGOTIABLE) | PASS | US3 adds Vitest test suite with 90%+ coverage. Constitution requires tests for every module. |
| IV. Error Handling & Resilience | PASS | US2 adds structured error handling at every pipeline stage. Failure results published to output queue with error codes. |
| V. Observability | PASS | US2 adds structured Winston logging with timing metrics, stage context, and error metadata. |
| VI. Configuration Management | PASS | All AI provider config via env vars, validated at startup with fail-fast. Secrets not committed. |
| VII. Simplicity | PASS | Migration is a provider swap, not an architectural change. No new abstractions introduced. |

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-mistral-migration-tests-ci/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── index.ts                          # Entry point: RabbitMQ consumer
├── constants.ts                      # CHUNK_SIZE, CHUNK_OVERLAP, BATCH_SIZE
├── logger.ts                         # Winston logger config
├── document.type.ts                  # DocumentType enum + type mappings
├── db.connect.ts                     # ChromaDB client factory
├── azure.embedding.function.ts       # OpenAI-compatible embedding function
├── generate.document.ts              # Entity → Document converter
├── embed.body.of.knowledge.ts        # Orchestrator: full ingestion pipeline
├── embed.documents.ts                # Chunking, summarization, embedding
├── process.callouts.ts               # Callout content processing
├── callout.handlers/
│   ├── index.ts                      # Handler registry
│   ├── base.ts                       # Default message handler
│   └── link.collection.ts            # Link collection handler
├── data.readers/
│   ├── space.ts                      # Alkemio space data reader
│   ├── knowledge.base.ts             # Knowledge base data reader
│   ├── process.space.tree.ts         # Recursive space tree processor
│   └── types.d.ts                    # Reader type definitions
├── event.bus/
│   ├── connection.ts                 # RabbitMQ connection manager
│   └── events/
│       ├── ingest.body.of.knowledge.ts        # Ingestion event class
│       └── ingest.body.of.knowledge.result.ts # Result event class
├── graphql.client/
│   └── AlkemioCliClient.ts           # Alkemio API client wrapper
├── loaders/
│   ├── index.ts                      # Loader registry
│   ├── doc.loader.ts                 # Document file loader
│   └── spreadsheet.loader.ts         # Spreadsheet file loader
├── summarize/
│   ├── graph.ts                      # LangGraph summarization workflow
│   ├── document.ts                   # Document-level summarization
│   └── body.of.knowledge.ts          # BoK-level summarization
└── generated/
    └── graphql.ts                    # Auto-generated GraphQL types (excluded from coverage)

test/
├── unit/
│   ├── constants.test.ts
│   ├── document.type.test.ts
│   ├── generate.document.test.ts
│   ├── db.connect.test.ts
│   ├── azure.embedding.function.test.ts
│   ├── embed.documents.test.ts
│   ├── embed.body.of.knowledge.test.ts
│   ├── process.callouts.test.ts
│   ├── callout.handlers/
│   │   ├── base.test.ts
│   │   ├── index.test.ts
│   │   └── link.collection.test.ts
│   ├── event.bus/
│   │   ├── connection.test.ts
│   │   └── events/
│   │       ├── ingest.body.of.knowledge.test.ts
│   │       └── ingest.body.of.knowledge.result.test.ts
│   ├── loaders/
│   │   ├── doc.loader.test.ts
│   │   └── spreadsheet.loader.test.ts
│   ├── summarize/
│   │   ├── graph.test.ts
│   │   ├── document.test.ts
│   │   └── body.of.knowledge.test.ts
│   ├── data.readers/
│   │   ├── space.test.ts
│   │   ├── knowledge.base.test.ts
│   │   └── process.space.tree.test.ts
│   ├── graphql.client/
│   │   └── AlkemioCliClient.test.ts
│   └── logger.test.ts
└── helpers/
    └── mocks.ts                      # Shared mock factories

.github/workflows/
└── ci.yml                            # Lint + format + build + test pipeline

CLAUDE.md                             # Developer guidance for Claude Code
jest.config.ts                        # Jest configuration
```

**Structure Decision**: Single project with `src/` for source and `test/` for tests
mirroring source structure. Test files use `.test.ts` suffix in a parallel `test/unit/`
tree rather than co-located `__tests__` directories, to keep the source tree clean.
A shared `test/helpers/mocks.ts` provides reusable mock factories for external
dependencies (RabbitMQ, ChromaDB, Mistral, Alkemio client).

## Complexity Tracking

> No Constitution Check violations. This section intentionally left empty.
