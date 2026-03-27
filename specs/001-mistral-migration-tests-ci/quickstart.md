# Quickstart: Alkemio Space Ingestion Service

## Prerequisites

- Node.js 22.x (use Volta: `volta install node@22.20.0`)
- npm 8.5+
- Running RabbitMQ instance
- Running ChromaDB instance
- Access to Alkemio platform API
- Mistral API key
- Scaleway embeddings API key

## Setup

```bash
# Clone and install
git clone <repo-url>
cd virtual-contributor-ingest-space
npm ci

# Configure environment
cp .env.default .env.development
# Edit .env.development with your credentials:
#   MISTRAL_API_KEY, EMBEDDINGS_API_KEY, EMBEDDINGS_ENDPOINT,
#   AUTH_ADMIN_EMAIL, AUTH_ADMIN_PASSWORD, RABBITMQ_*, VECTOR_DB_*
```

## Key Commands

```bash
# Build
npm run build

# Run (development with hot reload)
npm run start:dev

# Run (production)
npm start

# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format
npm run format

# Run tests
npx vitest run

# Run tests with coverage
npx vitest run --coverage

# Regenerate GraphQL types (after schema changes)
npm run codegen
```

## Trigger an Ingestion

Send a message to the RabbitMQ input queue
(`virtual-contributor-ingest-body-of-knowledge`):

```json
{
  "bodyOfKnowledgeId": "<space-id>",
  "type": "alkemio-space",
  "purpose": "knowledge",
  "personaId": "<persona-id>"
}
```

The service will process the space and publish a result to the output
queue (`virtual-contributor-ingest-body-of-knowledge-result`).

## Verify Success

1. Check logs for `Ingest SUCCESS for: <space-id>`
2. Check ChromaDB for a collection named after the `bodyOfKnowledgeId`
3. Check the RabbitMQ result queue for the success message
