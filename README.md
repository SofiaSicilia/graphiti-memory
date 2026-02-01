# Graphiti Memory Skill for OpenClaw

A knowledge graph memory system for the OpenClaw agent (Sofía), inspired by [Zep's Graphiti](https://github.com/getzep/graphiti). This skill enables the agent to remember facts, relationships, and conversation history in a structured graph format.

## Features

- 🧠 **Entity Extraction**: Automatically extracts entities and relationships from conversations using OpenAI
- 🔗 **Knowledge Graph**: Stores information as entities, relationships, and episodes in PostgreSQL
- 🔍 **Semantic Search**: Retrieves relevant context before generating responses
- 📝 **Conversation Capture**: Automatically stores conversation history
- 🛠️ **Manual Fact Entry**: Add facts manually via the `graphiti_add_fact` tool

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

## Installation

1. **Install dependencies**:
```bash
cd /Users/aitorortega/clawd/skills/graphiti-memory
npm install
npm run build
```

2. **Set up environment variables** in `/Users/aitorortega/clawd/.env`:
```env
# Database (uses existing PostgreSQL)
GRAPHITI_DB_URL=postgresql://localhost:5432/graphiti

# OpenAI (required for entity extraction)
OPENAI_API_KEY=sk-...

# Optional settings
GRAPHITI_MAX_RESULTS=10
GRAPHITI_MODEL=gpt-4o-mini
GRAPHITI_EMBEDDING_MODEL=text-embedding-3-small
```

3. **Create the database**:
```bash
createdb graphiti
```

## Configuration

Optional configuration file at `/Users/aitorortega/clawd/data/graphiti-config.json`:

```json
{
  "databaseUrl": "postgresql://localhost:5432/graphiti",
  "enableEntityExtraction": true,
  "enableEmbeddings": true,
  "tablePrefix": "graphiti_"
}
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

## Integration with OpenClaw

The skill hooks into OpenClaw's message processing:

1. **Before Response**: Queries the knowledge graph for relevant context
2. **After Response**: Captures the conversation to the graph
3. **Tools Available**: Agent can manually recall or add facts

### Usage in Agent Code

```typescript
import { 
  onStartup, 
  onBeforeResponse, 
  onAfterResponse,
  graphiti_recall,
  graphiti_add_fact 
} from './skills/graphiti-memory/src/skill.js';

// On startup
await onStartup();

// Before generating response
const context = await onBeforeResponse(message);
// Add context to system prompt

// After generating response
await onAfterResponse(message, response);
```

## Database Schema

### Entities
```sql
CREATE TABLE graphiti_entities (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- Person, Organization, Concept, etc.
  properties JSONB,
  embedding VECTOR(1536),  -- For semantic search
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Relationships
```sql
CREATE TABLE graphiti_relationships (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES entities(id),
  target_id UUID REFERENCES entities(id),
  source_name TEXT,
  target_name TEXT,
  type TEXT,  -- works_for, likes, located_in, etc.
  properties JSONB,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP  -- For temporal tracking
);
```

### Episodes
```sql
CREATE TABLE graphiti_episodes (
  id UUID PRIMARY KEY,
  content TEXT,  -- Conversation text
  embedding VECTOR(1536),
  entities UUID[],  -- Referenced entities
  metadata JSONB,
  timestamp TIMESTAMP
);
```

## Testing

Run tests:
```bash
npm test
```

Manual test:
```bash
npm run build
node -e "
import('./dist/index.js').then(async ({ default: GraphitiMemory }) => {
  const memory = new GraphitiMemory({
    databaseUrl: 'postgresql://localhost:5432/graphiti',
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

## How It Works

1. **Entity Extraction**: Uses OpenAI's structured output to extract entities and relationships from text
2. **Storage**: Stores entities, relationships, and episodes in PostgreSQL
3. **Retrieval**: Searches by keyword and (optionally) semantic similarity
4. **Context Building**: Formats retrieved information for the agent's context window

## Future Improvements

- [ ] pgvector support for semantic similarity search
- [ ] Graph traversal for multi-hop queries
- [ ] Temporal reasoning (when facts were valid)
- [ ] Community detection for entity clustering
- [ ] Integration with LanceDB for hybrid search

## License

MIT

## Credits

Inspired by [Zep's Graphiti](https://github.com/getzep/graphiti) - A temporal knowledge graph architecture for agent memory.
