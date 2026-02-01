/**
 * Graphiti Memory Skill for OpenClaw Agent
 *
 * Knowledge graph memory system inspired by Zep's Graphiti
 * Uses PostgreSQL for storage via @edgemaker/core
 */
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
export declare class GraphitiMemory {
    private skillConfig;
    private client;
    private capture;
    private extraction;
    private query;
    private initialized;
    constructor(skillConfig: GraphitiMemoryConfig);
    /**
     * Initialize the knowledge graph
     */
    initialize(): Promise<void>;
    /**
     * Query the knowledge graph for relevant context
     */
    recall(query: string, options?: {
        limit?: number;
        includeEntities?: boolean;
        includeRelationships?: boolean;
        includeEpisodes?: boolean;
    }): Promise<RecallResult>;
    /**
     * Add a fact to the knowledge graph
     */
    addFact(fact: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Process a conversation turn
     */
    processConversation(userMessage: string, assistantResponse: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Get context for an incoming message (to be called before agent responds)
     */
    getContextForMessage(message: string): Promise<string>;
    /**
     * Capture conversation after agent responds
     */
    captureConversation(userMessage: string, assistantResponse: string, channelId?: string, threadId?: string): Promise<void>;
    /**
     * Format recall results as context for the agent prompt
     */
    private formatContextForPrompt;
    /**
     * Close the connection
     */
    close(): Promise<void>;
    private checkInitialized;
}
export { GraphitiClient } from './graphiti-client.js';
export { ConversationCapture } from './conversation-capture.js';
export { EntityExtraction } from './entity-extraction.js';
export { QueryContext } from './query-context.js';
export { config } from './config.js';
export default GraphitiMemory;
//# sourceMappingURL=index.d.ts.map