/**
 * OpenClaw Tools for Graphiti Memory
 * 
 * These tools integrate Graphiti Memory with the OpenClaw agent system
 */

import { GraphitiMemory, GraphitiMemoryConfig } from './index.js';

// Global instance (managed by OpenClaw)
let memoryInstance: GraphitiMemory | null = null;

export interface ToolContext {
  channelId?: string;
  threadId?: string;
  userId?: string;
}

/**
 * Initialize the Graphiti Memory skill
 */
export async function initializeGraphiti(config?: Partial<GraphitiMemoryConfig>): Promise<void> {
  if (memoryInstance) return;

  const fullConfig: GraphitiMemoryConfig = {
    databaseUrl: config?.databaseUrl || process.env.GRAPHITI_DB_URL || process.env.DATABASE_URL || '',
    openAiApiKey: config?.openAiApiKey || process.env.OPENAI_API_KEY || '',
    maxContextResults: config?.maxContextResults || 10,
    entityExtractionModel: config?.entityExtractionModel || 'gpt-4o-mini',
  };

  memoryInstance = new GraphitiMemory(fullConfig);
  await memoryInstance.initialize();
}

/**
 * Tool: graphiti_recall
 * Query the knowledge graph for relevant context
 */
export async function graphiti_recall(
  query: string,
  options?: {
    limit?: number;
    includeEntities?: boolean;
    includeRelationships?: boolean;
    includeEpisodes?: boolean;
  }
): Promise<string> {
  if (!memoryInstance) {
    throw new Error('Graphiti Memory not initialized. Call initializeGraphiti() first.');
  }

  const results = await memoryInstance.recall(query, {
    limit: options?.limit ?? 5,
    includeEntities: options?.includeEntities ?? true,
    includeRelationships: options?.includeRelationships ?? true,
    includeEpisodes: options?.includeEpisodes ?? true,
  });

  // Format as readable text
  const parts: string[] = ['## Graphiti Memory Results:\n'];

  if (results.entities.length > 0) {
    parts.push('### Entities:');
    results.entities.forEach(e => {
      parts.push(`- ${e.name} (${e.type})`);
    });
  }

  if (results.relationships.length > 0) {
    parts.push('\n### Relationships:');
    results.relationships.forEach(r => {
      parts.push(`- ${r.sourceName} → ${r.type} → ${r.targetName}`);
    });
  }

  if (results.episodes.length > 0) {
    parts.push('\n### Previous Conversations:');
    results.episodes.forEach(e => {
      parts.push(`- ${e.content.substring(0, 200)}${e.content.length > 200 ? '...' : ''}`);
    });
  }

  if (parts.length === 1) {
    parts.push('No relevant memories found.');
  }

  return parts.join('\n');
}

/**
 * Tool: graphiti_add_fact
 * Manually add a fact to the knowledge graph
 */
export async function graphiti_add_fact(
  fact: string,
  metadata?: Record<string, any>
): Promise<string> {
  if (!memoryInstance) {
    throw new Error('Graphiti Memory not initialized. Call initializeGraphiti() first.');
  }

  await memoryInstance.addFact(fact, metadata);
  return `Fact added to memory: "${fact.substring(0, 100)}${fact.length > 100 ? '...' : ''}"`;
}

/**
 * Tool: graphiti_get_context
 * Get formatted context for the current conversation (used internally)
 */
export async function graphiti_get_context(message: string): Promise<string> {
  if (!memoryInstance) {
    return '';
  }

  return memoryInstance.getContextForMessage(message);
}

/**
 * Tool: graphiti_capture
 * Capture conversation to memory (used internally after agent responds)
 */
export async function graphiti_capture(
  userMessage: string,
  assistantResponse: string,
  context?: ToolContext
): Promise<void> {
  if (!memoryInstance) return;

  await memoryInstance.captureConversation(
    userMessage,
    assistantResponse,
    context?.channelId,
    context?.threadId
  );
}

/**
 * Get the memory instance (for advanced usage)
 */
export function getMemoryInstance(): GraphitiMemory | null {
  return memoryInstance;
}

/**
 * Close the memory connection
 */
export async function closeGraphiti(): Promise<void> {
  if (memoryInstance) {
    await memoryInstance.close();
    memoryInstance = null;
  }
}

// Tool definitions for OpenClaw
export const toolDefinitions = [
  {
    name: 'graphiti_recall',
    description: 'Query the knowledge graph for relevant memories and context about a topic or entity',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant memories',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
        includeEntities: {
          type: 'boolean',
          description: 'Include entities in results (default: true)',
        },
        includeRelationships: {
          type: 'boolean',
          description: 'Include relationships in results (default: true)',
        },
        includeEpisodes: {
          type: 'boolean',
          description: 'Include conversation episodes in results (default: true)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'graphiti_add_fact',
    description: 'Add a fact or piece of information to the long-term memory knowledge graph',
    parameters: {
      type: 'object',
      properties: {
        fact: {
          type: 'string',
          description: 'The fact to remember',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata about the fact',
        },
      },
      required: ['fact'],
    },
  },
];
