/**
 * Graphiti Memory Skill for OpenClaw Agent
 * 
 * Knowledge graph memory system inspired by Zep's Graphiti
 * Uses PostgreSQL for storage via @edgemaker/core
 */

import { config } from './config.js';
import { GraphitiClient } from './graphiti-client.js';
import { ConversationCapture } from './conversation-capture.js';
import { EntityExtraction } from './entity-extraction.js';
import { QueryContext } from './query-context.js';

export interface GraphitiMemoryConfig {
  databaseUrl: string;
  openAiApiKey: string;
  maxContextResults?: number;
  entityExtractionModel?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface RecallResult {
  entities: Array<{
    name: string;
    type: string;
    properties: Record<string, any>;
  }>;
  relationships: Array<{
    sourceName: string;
    targetName: string;
    type: string;
    properties: Record<string, any>;
  }>;
  episodes: Array<{
    content: string;
    timestamp: Date;
    relevance: number;
  }>;
}

export class GraphitiMemory {
  private client: GraphitiClient;
  private capture: ConversationCapture;
  private extraction: EntityExtraction;
  private query: QueryContext;
  private initialized: boolean = false;

  constructor(private skillConfig: GraphitiMemoryConfig) {
    this.client = new GraphitiClient(skillConfig);
    this.extraction = new EntityExtraction(skillConfig.openAiApiKey);
    this.capture = new ConversationCapture(this.client, this.extraction);
    this.query = new QueryContext(this.client);
  }

  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.client.initialize();
    this.initialized = true;
    console.log('[GraphitiMemory] Initialized successfully');
  }

  /**
   * Query the knowledge graph for relevant context
   */
  async recall(query: string, options?: {
    limit?: number;
    includeEntities?: boolean;
    includeRelationships?: boolean;
    includeEpisodes?: boolean;
  }): Promise<RecallResult> {
    this.checkInitialized();
    return this.query.search(query, {
      limit: options?.limit ?? this.skillConfig.maxContextResults ?? 10,
      includeEntities: options?.includeEntities ?? true,
      includeRelationships: options?.includeRelationships ?? true,
      includeEpisodes: options?.includeEpisodes ?? true,
    });
  }

  /**
   * Add a fact to the knowledge graph
   */
  async addFact(fact: string, metadata?: Record<string, any>): Promise<void> {
    this.checkInitialized();
    await this.capture.addFact(fact, metadata);
  }

  /**
   * Process a conversation turn
   */
  async processConversation(
    userMessage: string,
    assistantResponse: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.checkInitialized();
    await this.capture.processTurn(userMessage, assistantResponse, metadata);
  }

  /**
   * Get context for an incoming message (to be called before agent responds)
   */
  async getContextForMessage(message: string): Promise<string> {
    this.checkInitialized();
    const results = await this.recall(message, {
      limit: 5,
      includeEntities: true,
      includeRelationships: true,
      includeEpisodes: true,
    });

    return this.formatContextForPrompt(results);
  }

  /**
   * Capture conversation after agent responds
   */
  async captureConversation(
    userMessage: string,
    assistantResponse: string,
    channelId?: string,
    threadId?: string
  ): Promise<void> {
    await this.processConversation(userMessage, assistantResponse, {
      channelId,
      threadId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Format recall results as context for the agent prompt
   */
  private formatContextForPrompt(results: RecallResult): string {
    const parts: string[] = [];

    if (results.entities.length > 0) {
      parts.push('## Relevant Entities:');
      results.entities.forEach(e => {
        parts.push(`- ${e.name} (${e.type})`);
        if (Object.keys(e.properties).length > 0) {
          parts.push(`  Properties: ${JSON.stringify(e.properties)}`);
        }
      });
    }

    if (results.relationships.length > 0) {
      parts.push('\n## Relevant Relationships:');
      results.relationships.forEach(r => {
        parts.push(`- ${r.sourceName} → ${r.type} → ${r.targetName}`);
      });
    }

    if (results.episodes.length > 0) {
      parts.push('\n## Previous Related Conversations:');
      results.episodes.forEach(e => {
        parts.push(`- [${e.timestamp.toISOString()}] ${e.content.substring(0, 200)}...`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.client.close();
    this.initialized = false;
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('GraphitiMemory not initialized. Call initialize() first.');
    }
  }
}

// Export individual modules for advanced usage
export { GraphitiClient } from './graphiti-client.js';
export { ConversationCapture } from './conversation-capture.js';
export { EntityExtraction } from './entity-extraction.js';
export { QueryContext } from './query-context.js';
export { config } from './config.js';

// Default export
export default GraphitiMemory;
