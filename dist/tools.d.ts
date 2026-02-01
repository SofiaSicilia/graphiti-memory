/**
 * OpenClaw Tools for Graphiti Memory
 *
 * These tools integrate Graphiti Memory with the OpenClaw agent system
 */
import { GraphitiMemory, GraphitiMemoryConfig } from './index.js';
export interface ToolContext {
    channelId?: string;
    threadId?: string;
    userId?: string;
}
/**
 * Initialize the Graphiti Memory skill
 */
export declare function initializeGraphiti(config?: Partial<GraphitiMemoryConfig>): Promise<void>;
/**
 * Tool: graphiti_recall
 * Query the knowledge graph for relevant context
 */
export declare function graphiti_recall(query: string, options?: {
    limit?: number;
    includeEntities?: boolean;
    includeRelationships?: boolean;
    includeEpisodes?: boolean;
}): Promise<string>;
/**
 * Tool: graphiti_add_fact
 * Manually add a fact to the knowledge graph
 */
export declare function graphiti_add_fact(fact: string, metadata?: Record<string, any>): Promise<string>;
/**
 * Tool: graphiti_get_context
 * Get formatted context for the current conversation (used internally)
 */
export declare function graphiti_get_context(message: string): Promise<string>;
/**
 * Tool: graphiti_capture
 * Capture conversation to memory (used internally after agent responds)
 */
export declare function graphiti_capture(userMessage: string, assistantResponse: string, context?: ToolContext): Promise<void>;
/**
 * Get the memory instance (for advanced usage)
 */
export declare function getMemoryInstance(): GraphitiMemory | null;
/**
 * Close the memory connection
 */
export declare function closeGraphiti(): Promise<void>;
export declare const toolDefinitions: ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            includeEntities: {
                type: string;
                description: string;
            };
            includeRelationships: {
                type: string;
                description: string;
            };
            includeEpisodes: {
                type: string;
                description: string;
            };
            fact?: undefined;
            metadata?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            fact: {
                type: string;
                description: string;
            };
            metadata: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            includeEntities?: undefined;
            includeRelationships?: undefined;
            includeEpisodes?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=tools.d.ts.map