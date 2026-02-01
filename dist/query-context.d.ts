/**
 * Query Context
 *
 * Retrieves relevant context from the knowledge graph
 */
import { GraphitiClient, Entity, Relationship, Episode } from './graphiti-client.js';
export interface QueryOptions {
    limit?: number;
    includeEntities?: boolean;
    includeRelationships?: boolean;
    includeEpisodes?: boolean;
}
export interface QueryResult {
    entities: Entity[];
    relationships: Relationship[];
    episodes: Array<Episode & {
        relevance: number;
    }>;
}
export declare class QueryContext {
    private client;
    constructor(client: GraphitiClient);
    /**
     * Search for relevant context
     */
    search(query: string, options?: QueryOptions): Promise<QueryResult>;
    /**
     * Get recent conversation history
     */
    getRecentHistory(limit?: number): Promise<Episode[]>;
    /**
     * Get all information about a specific entity
     */
    getEntityContext(entityName: string): Promise<{
        entity: Entity | null;
        relationships: Relationship[];
        relatedEpisodes: Episode[];
    }>;
    /**
     * Format query result as a string for LLM context
     */
    formatAsContext(result: QueryResult): string;
}
//# sourceMappingURL=query-context.d.ts.map