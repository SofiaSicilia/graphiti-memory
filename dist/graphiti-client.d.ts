/**
 * Graphiti Client - PostgreSQL-based knowledge graph client
 *
 * Uses a simplified knowledge graph structure stored in PostgreSQL
 * since @edgemaker/core requires Supabase. This is a custom implementation
 * optimized for local PostgreSQL usage.
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
export declare class GraphitiClient {
    private clientConfig;
    private client;
    private readonly prefix;
    constructor(clientConfig: {
        databaseUrl: string;
    });
    initialize(): Promise<void>;
    close(): Promise<void>;
    private createSchema;
    private formatEmbedding;
    createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity>;
    getEntityByName(name: string): Promise<Entity | null>;
    searchEntities(query: string, limit?: number): Promise<Entity[]>;
    createRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship>;
    getRelationshipsForEntity(entityId: string): Promise<Relationship[]>;
    createEpisode(episode: Omit<Episode, 'id' | 'createdAt'>): Promise<Episode>;
    searchEpisodes(query: string, limit?: number): Promise<Episode[]>;
    getRecentEpisodes(limit?: number): Promise<Episode[]>;
    semanticSearchEpisodes(embedding: number[], limit?: number): Promise<Episode[]>;
    private mapEntity;
    private mapRelationship;
    private mapEpisode;
}
//# sourceMappingURL=graphiti-client.d.ts.map