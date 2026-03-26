# CLAUDE.md

## Project Description

Alkemio Space Ingestion Service (`@alkemio/ingest-alkemio-data`) -- a message-driven TypeScript service that reads data from the Alkemio platform via its GraphQL API, chunks and summarizes text using Mistral AI, generates embeddings via Scaleway, and stores resulting vectors in ChromaDB. The pipeline is triggered by RabbitMQ messages and publishes results back to RabbitMQ.

## Architecture

```
RabbitMQ message (IngestBodyOfKnowledge)
  -> Fetch space/knowledge data from Alkemio GraphQL API
  -> Process callouts (links, posts, whiteboards, documents)
  -> Load documents (PDF, DOCX, XLSX, etc.)
  -> Chunk text (RecursiveCharacterTextSplitter, configurable size/overlap)
  -> Summarize via Mistral AI (LangGraph-based summarization pipeline)
  -> Embed via Scaleway (OpenAI-compatible embeddings endpoint)
  -> Store vectors in ChromaDB
  -> Publish IngestBodyOfKnowledgeResult to RabbitMQ
```

Entry point: `src/index.ts` -- connects to RabbitMQ, consumes messages, calls `embedBodyOfKnowledge`, and sends results back.

## Key Commands

| Command                 | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `npm run build`         | Compile TypeScript (runs `clean` first via `prebuild`)     |
| `npm run clean`         | Remove `dist/` directory                                   |
| `npm run lint`          | Type-check with `tsc --noEmit` then run ESLint             |
| `npm run lint:fix`      | Lint with auto-fix                                         |
| `npm run format`        | Prettier on `src/**/*.ts` and `graphql/**/*.graphql`       |
| `npm test`              | Run Jest tests                                             |
| `npm run test:coverage` | Run Jest with coverage reporting                           |
| `npm run codegen`       | Generate TypeScript types from GraphQL schema              |
| `npm run start:dev`     | Start with dotenvx loading `.env.development`, via nodemon |
| `npm start`             | Run compiled output (`node ./dist/index.js`)               |

## Project Structure

```
src/
  index.ts                  Entry point; RabbitMQ consumer loop
  embed.body.of.knowledge.ts  Top-level orchestrator for the ingest pipeline
  embed.documents.ts        Embeds chunked documents into ChromaDB
  process.callouts.ts       Routes callouts to type-specific handlers
  generate.document.ts      Builds LangChain Document objects from raw data
  document.type.ts          Document type definitions
  db.connect.ts             ChromaDB connection logic
  azure.embedding.function.ts  Embedding function adapter (Scaleway/OpenAI-compatible)
  constants.ts              Shared constants
  logger.ts                 Winston logger configuration

  callout.handlers/         Handlers per callout type (link collections, base handler)
  data.readers/             Reads spaces, knowledge bases, and space trees from Alkemio API
  event.bus/                RabbitMQ connection and event types (ingest request/result)
  graphql.client/           Alkemio GraphQL client (AlkemioCliClient)
  loaders/                  File loaders for documents and spreadsheets (PDF, DOCX, XLSX)
  summarize/                LangGraph-based summarization (body of knowledge, document, graph)
  generated/                Auto-generated GraphQL types (via codegen, do not edit)
```

## Coding Conventions

- **Formatting (Prettier):** single quotes, trailing commas (es5), 2-space indent, semicolons, bracket spacing, arrow parens avoided when possible.
- **Linting (ESLint):** TypeScript ESLint with Prettier integration. Single quotes enforced. No multiple empty lines. Unused vars are errors (prefix unused args with `_`).
- **TypeScript:** strict mode, target ES2018, CommonJS modules, decorators enabled.
- **Logging:** Winston for structured logging. Use `logger.info()`, `logger.error()`, etc.
- **Configuration:** All configuration via environment variables. No hardcoded secrets or endpoints.
- **Error handling:** Error objects in result events must be serialized with `message` and `code` properties. Always log errors with contextual info (e.g., bodyOfKnowledgeId).

## Testing Conventions

- **Framework:** Jest with ts-jest preset, Node test environment.
- **Test location:** `test/` directory, matching `**/test/**/*.test.ts`.
- **Mocks:** Shared mocks in `test/helpers/mocks.ts`.
- **Coverage thresholds:**
  - Lines: 90%
  - Statements: 90%
  - Functions: 85%
  - Branches: 80%
- **Exclusions:** `src/generated/**` is excluded from coverage collection.

## Environment Setup

Copy `.env.default` to `.env.development` and fill in secrets. All variables:

| Variable                                         | Description                                              |
| ------------------------------------------------ | -------------------------------------------------------- |
| `RABBITMQ_HOST`                                  | RabbitMQ hostname (default: `localhost`)                 |
| `RABBITMQ_USER`                                  | RabbitMQ username                                        |
| `RABBITMQ_PASSWORD`                              | RabbitMQ password                                        |
| `RABBITMQ_PORT`                                  | RabbitMQ port (default: `5672`)                          |
| `RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_QUEUE`        | Queue name for ingest requests                           |
| `RABBITMQ_INGEST_BODY_OF_KNOWLEDGE_RESULT_QUEUE` | Queue name for ingest results                            |
| `RABBITMQ_EVENT_BUS_EXCHANGE`                    | RabbitMQ exchange name                                   |
| `API_ENDPOINT_PRIVATE_GRAPHQL`                   | Alkemio private GraphQL API endpoint                     |
| `AUTH_ORY_KRATOS_PUBLIC_BASE_URL`                | Ory Kratos public base URL for authentication            |
| `AUTH_ADMIN_EMAIL`                               | Admin email for Alkemio API auth                         |
| `AUTH_ADMIN_PASSWORD`                            | Admin password for Alkemio API auth                      |
| `LOG_LEVEL`                                      | Winston log level (e.g., `debug`, `info`)                |
| `MISTRAL_API_KEY`                                | Mistral AI API key for summarization                     |
| `MISTRAL_SMALL_MODEL_NAME`                       | Mistral model name (default: `mistral-small-latest`)     |
| `EMBEDDINGS_API_KEY`                             | API key for Scaleway embeddings endpoint                 |
| `EMBEDDINGS_ENDPOINT`                            | Scaleway embeddings API URL                              |
| `EMBEDDINGS_MODEL_NAME`                          | Embedding model name (default: `qwen3-embedding-8b`)     |
| `VECTOR_DB_HOST`                                 | ChromaDB hostname (default: `localhost`)                 |
| `VECTOR_DB_PORT`                                 | ChromaDB port (default: `8765`)                          |
| `VECTOR_DB_CREDENTIALS`                          | ChromaDB credentials (`user:password`)                   |
| `CHUNK_SIZE`                                     | Text chunk size in characters (default: `2000`)          |
| `CHUNK_OVERLAP`                                  | Overlap between chunks in characters (default: `200`)    |
| `LANGCHAIN_TRACING_V2`                           | Enable LangSmith tracing (`true`/`false`)                |
| `LANGCHAIN_ENDPOINT`                             | LangSmith API endpoint                                   |
| `LANGCHAIN_API_KEY`                              | LangSmith API key                                        |
| `LANGCHAIN_PROJECT`                              | LangSmith project name                                   |
| `SUMMARY_LENGTH`                                 | Target summary length in characters (default: `10000`)   |
| `BATCH_SIZE`                                     | Number of documents to process per batch (default: `20`) |
