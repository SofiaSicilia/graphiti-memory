# Graphiti Memory Skill for OpenClaw

A knowledge graph memory system for the OpenClaw agent (Sofía), inspired by [Zep's Graphiti](https://github.com/getzep/graphiti). This skill enables the agent to remember facts, relationships, and conversation history in a structured graph format.

## Features

- 🧠 **Entity Extraction**: Automatically extracts entities and relationships from conversations using OpenAI
- 🔗 **Knowledge Graph**: Stores information as entities, relationships, and episodes in PostgreSQL
- 🔍 **Semantic Search**: Retrieves relevant context before generating responses
- 📝 **Conversation Capture**: Automatically stores conversation history
- 🛠️ **Manual Fact Entry**: Add facts manually via the `graphiti_add_fact` tool
- 💰 **Cost Tracking**: Built-in tracking of API usage costs

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenClaw Agent │────▶│  Graphiti Skill  │────▶│   PostgreSQL    │
│    (Sofía)      │     │  (TypeScript)    │     │  (Knowledge     │
│                 │◄────│                  │◄────│    Graph)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   OpenAI API     │
                        │ (Entity Extract) │
                        └──────────────────┘
```

## Quick Start

### 1. Installation

```bash
cd /Users/aitorortega/clawd/skills/graphiti-memory
npm install
npm run build
```

### 2. Database Setup

Run the initialization script (one-time setup):

```bash
node init-graphiti.js
```

This creates the necessary tables in your PostgreSQL database:
- `graphiti_entities` - Stores people, places, concepts, etc.
- `graphiti_relationships` - Stores connections between entities
- `graphiti_episodes` - Stores conversation history

### 3. Environment Variables

Make sure these are set in your environment:

```bash
# Required
export OPENAI_API_KEY=sk-...

# Optional (uses sensible defaults)
export GRAPHITI_DB_URL=postgresql://aitorortega@localhost:5432/secondbrain
export GRAPHITI_MODEL=gpt-4o-mini
export GRAPHITI_MAX_RESULTS=10
```

### 4. Enable in OpenClaw

See [agent-config.patch](./agent-config.patch) for the exact changes needed in your agent code.

## Integration with OpenClaw

### Option A: Using the Integration Layer (Recommended)

The `openclaw-integration.ts` file provides a middleware layer that wraps your agent's message processing:

```typescript
import {
  initializeGraphitiIntegration,
  onBeforeResponse,
  onAfterResponse,
  shutdownGraphitiIntegration,
} from './skills/graphiti-memory/openclaw-integration.js';

// On agent startup
await initializeGraphitiIntegration();

// Before generating response - gets context from memory
const memoryContext = await onBeforeResponse(message);
// Add memoryContext to your system prompt

// After generating response - stores conversation
await onAfterResponse(message, response);

// On agent shutdown
await shutdownGraphitiIntegration();
```

### Option B: Direct Tool Usage

For more control, use the tools directly:

```typescript
import {
  graphiti_recall,
  graphiti_add_fact,
} from './skills/graphiti-memory/openclaw-integration.js';

// Manually recall information
const context = await graphiti_recall("What projects is Aitor working on?");

// Manually add a fact
await graphiti_add_fact("Aitor prefers TypeScript over Python");
```

## Tools

### `graphiti_recall`
Query the knowledge graph for relevant memories.

**Parameters**:
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 5)
- `includeEntities` (boolean, optional): Include entities (default: true)
- `includeRelationships` (boolean, optional): Include relationships (default: true)
- `includeEpisodes` (boolean, optional): Include conversations (default: true)

**Example**:
```typescript
const context = await graphiti_recall("What projects is Aitor working on?");
```

### `graphiti_add_fact`
Manually add a fact to the knowledge graph.

**Parameters**:
- `fact` (string, required): The fact to remember
- `metadata` (object, optional): Additional metadata

**Example**:
```typescript
await graphiti_add_fact("Aitor prefers TypeScript over Python for web development");
```

## Cost Tracking

Graphiti Memory tracks API usage costs automatically. Costs are stored in `~/.openclaw/memory/cost-log.jsonl`.

### Cost Estimates

| Operation | Model | Cost per Operation* |
|-----------|-------|---------------------|
| **Recall** (context retrieval) | text-embedding-3-large | ~$0.00001 - $0.0001 |
| **Capture** (store conversation) | gpt-4o-mini + embedding | ~$0.0001 - $0.001 |
| **Entity Extraction** | gpt-4o-mini | ~$0.0001 - $0.0005 |
| **Embedding** | text-embedding-3-large | ~$0.00001 - $0.00005 |

*Approximate costs based on typical conversation lengths (100-500 tokens)

### Pricing Details (February 2025)

| Service | Model | Input | Output |
|---------|-------|-------|--------|
| Embeddings | text-embedding-3-large | $0.13 / 1M tokens | - |
| Embeddings | text-embedding-3-small | $0.02 / 1M tokens | - |
| Entity Extraction | gpt-4o-mini | $0.15 / 1M tokens | $0.60 / 1M tokens |
| Entity Extraction | gpt-4o | $2.50 / 1M tokens | $10.00 / 1M tokens |

### Viewing Cost Stats

```typescript
import { getCostStats } from './skills/graphiti-memory/openclaw-integration.js';

const stats = await getCostStats();
console.log('Total cost:', stats.totalEstimatedCost);
console.log('Operations by type:', stats.operationsByType);
```

Or view the log directly:
```bash
cat ~/.openclaw/memory/cost-log.jsonl | jq .
```

### Estimated Monthly Costs

Assuming 100 conversations per day:
- **Low usage** (short conversations): ~$1-3/month
- **Medium usage** (typical conversations): ~$5-10/month
- **High usage** (long conversations, frequent entity extraction): ~$20-30/month

## Database Schema

### Entities
```sql
CREATE TABLE graphiti_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,  -- Person, Organization, Concept, etc.
  properties JSONB DEFAULT '{}',
  embedding VECTOR(1536),  -- For semantic search (requires pgvector)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Relationships
```sql
CREATE TABLE graphiti_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES graphiti_entities(id),
  target_id UUID REFERENCES graphiti_entities(id),
  source_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  type TEXT NOT NULL,  -- works_for, likes, located_in, etc.
  properties JSONB DEFAULT '{}',
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,  -- For temporal tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Episodes
```sql
CREATE TABLE graphiti_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,  -- Conversation text
  embedding VECTOR(1536),  -- For semantic search
  entities UUID[] DEFAULT '{}',  -- Referenced entity IDs
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing

### Run Integration Tests

```bash
npm run build
node test-integration.mjs
```

This tests:
1. ✅ Initialization
2. ✅ Adding facts to memory
3. ✅ Recalling information
4. ✅ Context retrieval (onBeforeResponse)
5. ✅ Conversation capture (onAfterResponse)
6. ✅ Cost tracking

### Manual Test

```bash
npm run build
node -e "
import('./dist/index.js').then(async ({ default: GraphitiMemory }) => {
  const memory = new GraphitiMemory({
    databaseUrl: 'postgresql://localhost:5432/secondbrain',
    openAiApiKey: process.env.OPENAI_API_KEY
  });
  await memory.initialize();
  await memory.addFact('Test fact about OpenClaw');
  const results = await memory.recall('OpenClaw');
  console.log(results);
  await memory.close();
});
"
```

## Configuration

Optional configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPHITI_DB_URL` | `postgresql://aitorortega@localhost:5432/secondbrain` | PostgreSQL connection string |
| `GRAPHITI_TABLE_PREFIX` | `graphiti_` | Prefix for database tables |
| `GRAPHITI_MODEL` | `gpt-4o-mini` | Model for entity extraction |
| `GRAPHITI_MAX_RESULTS` | `10` | Maximum results for recall |

## How It Works

1. **Entity Extraction**: Uses OpenAI's structured output to extract entities and relationships from text
2. **Storage**: Stores entities, relationships, and episodes in PostgreSQL
3. **Retrieval**: Searches by keyword and (optionally) semantic similarity
4. **Context Building**: Formats retrieved information for the agent's context window
5. **Cost Tracking**: Logs every API call with estimated costs

## Performance Considerations

- **Latency**: Context retrieval adds ~50-200ms to response time
- **Database**: Uses indexed queries for fast lookups
- **Embeddings**: Optional (falls back to text search if pgvector unavailable)
- **Caching**: Consider caching frequent queries in production

## Troubleshooting

### Database connection errors
- Verify PostgreSQL is running: `pg_isready`
- Check connection string: `psql $GRAPHITI_DB_URL`
- Ensure pgvector extension is available (optional)

### API errors
- Verify `OPENAI_API_KEY` is set correctly
- Check API rate limits
- Review cost log for failed operations

### Missing context
- Verify tables exist: `\dt graphiti_*` in psql
- Check if entities are being extracted: look for extraction logs
- Test manual recall: `node test-integration.mjs`

## Future Improvements

- [ ] pgvector support for semantic similarity search
- [ ] Graph traversal for multi-hop queries
- [ ] Temporal reasoning (when facts were valid)
- [ ] Community detection for entity clustering
- [ ] Integration with LanceDB for hybrid search
- [ ] Memory pruning and consolidation
- [ ] User-specific memory namespaces

## License

MIT

## Credits

Inspired by [Zep's Graphiti](https://github.com/getzep/graphiti) - A temporal knowledge graph architecture for agent memory.
