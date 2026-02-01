/**
 * Graphiti Client - PostgreSQL-based knowledge graph client with pgvector support
 *
 * Uses a simplified knowledge graph structure stored in PostgreSQL
 * since @edgemaker/core requires Supabase. This is a custom implementation
 * optimized for local PostgreSQL usage with vector similarity search.
 */
export interface Entity {
    id: string;
    name: string;
    type: string;
    properties: Record<string, any>;
    embedding?: number[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Relationship {
    id: string;
    sourceId: string;
    targetId: string;
    sourceName: string;
    targetName: string;
    type: string;
    properties: Record<string, any>;
    validFrom: Date;
    validUntil?: Date;
    createdAt: Date;
}
export interface Episode {
    id: string;
    content: string;
    embedding?: number[];
    entities: string[];
    metadata: Record<string, any>;
    timestamp: Date;
    createdAt: Date;
}
interface VectorCapabilities {
    hasVectorExtension: boolean;
    hasVectorColumns: boolean;
    embeddingDimension: number;
}
export declare class GraphitiClient {
    private clientConfig;
    private client;
    private readonly prefix;
    private vectorCapabilities;
    constructor(clientConfig: {
        databaseUrl: string;
    });
    initialize(): Promise<void>;
    close(): Promise<void>;
    private detectVectorCapabilities;
    getVectorCapabilities(): VectorCapabilities | null;
    private createSchema;
    /**
     * Format embedding for database storage
     * Uses vector column if available, falls back to JSONB
     */
    private formatEmbedding;
    /**
     * Parse embedding from database row
     * Handles both vector and JSONB formats
     */
    private parseEmbedding;
    createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
    getEntityByName(name: string): Promise<Entity | null>;
    searchEntities(query: string, limit?: number): Promise<Entity[]>;
    /**
     * Semantic search for entities using vector similarity
     * Requires pgvector extension
     */
    semanticSearchEntities(embedding: number[], limit?: number, threshold?: number): Promise<Entity[]>;
    createRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship>;
    getRelationshipsForEntity(entityId: string): Promise<Relationship[]>;
    createEpisode(episode: Omit<Episode, 'id' | 'createdAt'>): Promise<Episode>;
    searchEpisodes(query: string, limit?: number): Promise<Episode[]>;
    getRecentEpisodes(limit?: number): Promise<Episode[]>;
    /**
     * Semantic search for episodes using vector similarity
     * Uses cosine distance for best semantic matching
     */
    semanticSearchEpisodes(embedding: number[], limit?: number, threshold?: number): Promise<Episode[]>;
    /**
     * Hybrid search: combines semantic similarity with text search
     * Returns episodes that match either by meaning or by text content
     */
    hybridSearchEpisodes(queryText: string, queryEmbedding: number[], limit?: number, semanticWeight?: number): Promise<Array<Episode & {
        score: number;
    }>>;
    private mapEntity;
    private mapRelationship;
    private mapEpisode;
}
export {};
//# sourceMappingURL=graphiti-client.d.ts.map