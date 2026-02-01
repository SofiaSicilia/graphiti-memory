# Graphiti Memory Skill

## Overview

Knowledge graph memory system for OpenClaw agent. Stores entities, relationships, and conversation history in PostgreSQL.

## Tools

### graphiti_recall

Query the knowledge graph for relevant memories.

**Input**:
```json
{
  "query": "What does the user like?",
  "limit": 5,
  "includeEntities": true,
  "includeRelationships": true,
  "includeEpisodes": true
}
```

**Output**: Formatted string with entities, relationships, and previous conversations.

### graphiti_add_fact

Add a fact to the knowledge graph.

**Input**:
```json
{
  "fact": "User prefers dark mode",
  "metadata": { "source": "explicit" }
}
```

**Output**: Confirmation message.

## Configuration

Required environment variables:
- `OPENAI_API_KEY` - For entity extraction
- `GRAPHITI_DB_URL` or `DATABASE_URL` - PostgreSQL connection

Optional:
- `GRAPHITI_MAX_RESULTS` - Default: 10
- `GRAPHITI_MODEL` - Default: gpt-4o-mini
- `GRAPHITI_EMBEDDING_MODEL` - Default: text-embedding-3-small

## Files

- `index.ts` - Main exports
- `graphiti-client.ts` - PostgreSQL client
- `entity-extraction.ts` - OpenAI entity extraction
- `conversation-capture.ts` - Store conversations
- `query-context.ts` - Retrieve context
- `tools.ts` - OpenClaw tool definitions
- `skill.ts` - OpenClaw integration hooks

## Usage

```typescript
import { GraphitiMemory } from './skills/graphiti-memory/index.js';

const memory = new GraphitiMemory({
  databaseUrl: process.env.GRAPHITI_DB_URL,
  openAiApiKey: process.env.OPENAI_API_KEY
});

await memory.initialize();
const context = await memory.getContextForMessage(userMessage);
```
