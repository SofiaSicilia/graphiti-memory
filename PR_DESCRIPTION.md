# OpenClaw Integration for Graphiti Memory

This PR integrates Graphiti Memory with the OpenClaw agent system for Sofía.

## 🎯 What's Included

### 1. OpenClaw Integration Layer (`src/openclaw-integration.ts`)
Provides middleware hooks for the agent:
- **`onBeforeResponse()`** - Retrieves relevant context from the knowledge graph before the agent responds
- **`onAfterResponse()`** - Captures the conversation to memory after the agent responds
- **`initializeGraphitiIntegration()`** - One-time setup on agent startup
- **`shutdownGraphitiIntegration()`** - Graceful cleanup on shutdown

### 2. Cost Tracking System (`src/cost-tracker.ts`)
- Tracks API usage costs for embeddings and entity extraction
- Stores data in `~/.openclaw/memory/cost-log.jsonl`
- Provides `getCostStats()` for monitoring

**Cost estimates per operation:**
| Operation | Cost |
|-----------|------|
| Recall (context retrieval) | ~$0.00001 - $0.0001 |
| Capture (store conversation) | ~$0.0001 - $0.001 |

### 3. Initialization Script (`init-graphiti.js`)
One-time database setup:
```bash
node init-graphiti.js
```
Creates tables with `graphiti_` prefix:
- `graphiti_entities` - People, places, concepts
- `graphiti_relationships` - Connections between entities
- `graphiti_episodes` - Conversation history

### 4. Agent Configuration Patch (`agent-config.patch`)
Shows exactly how to modify the OpenClaw agent to use Graphiti Memory.

### 5. Integration Test (`test-integration.mjs`)
Validates all components:
```bash
npm run build
node test-integration.mjs
```

### 6. Updated Documentation (`README.md`)
- Integration instructions
- Cost estimates and pricing details
- Environment variables reference
- Troubleshooting guide

## 🚀 How to Enable

1. **Run initialization** (one-time):
   ```bash
   node init-graphiti.js
   ```

2. **Update your agent code** (see `agent-config.patch`):
   ```typescript
   import {
     initializeGraphitiIntegration,
     onBeforeResponse,
     onAfterResponse,
   } from './skills/graphiti-memory/dist/openclaw-integration.js';
   ```

3. **Set environment variables**:
   ```bash
   export OPENAI_API_KEY=sk-...
   # Optional: export GRAPHITI_DB_URL=postgresql://...
   ```

4. **Rebuild and restart**:
   ```bash
   npm run build
   # Restart your OpenClaw agent
   ```

## 🧪 Testing

```bash
cd /Users/aitorortega/clawd/skills/graphiti-memory
npm run build
node test-integration.mjs
```

## 💰 Cost Considerations

- Uses `gpt-4o-mini` for entity extraction (most cost-effective)
- Uses `text-embedding-3-large` for embeddings
- Estimated monthly cost for 100 conversations/day: $5-10
- All costs tracked in `~/.openclaw/memory/cost-log.jsonl`

## 🔒 Database Safety

- All tables use `graphiti_` prefix to avoid conflicts
- Uses existing PostgreSQL database (`secondbrain`)
- Safe to run alongside existing applications

## 📋 Checklist

- [x] Integration layer created
- [x] Cost tracking implemented
- [x] Initialization script working
- [x] Database tables created and tested
- [x] Documentation updated
- [x] Integration test passing (structure verified)
- [x] Tables use `graphiti_` prefix

---

**Note:** This requires `OPENAI_API_KEY` to be set for entity extraction and embeddings.