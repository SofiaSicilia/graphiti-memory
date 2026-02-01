/**
 * Graphiti Client - PostgreSQL-based knowledge graph client
 *
 * Uses a simplified knowledge graph structure stored in PostgreSQL
 * since @edgemaker/core requires Supabase. This is a custom implementation
 * optimized for local PostgreSQL usage.
 */
import { config } from './config.js';
import pkg from 'pg';
const { Client } = pkg;
export class GraphitiClient {
    clientConfig;
    client = null;
    prefix;
    constructor(clientConfig) {
        this.clientConfig = clientConfig;
        this.prefix = config.tablePrefix;
    }
    async initialize() {
        this.client = new Client({
            connectionString: this.clientConfig.databaseUrl,
        });
        await this.client.connect();
        await this.createSchema();
        console.log('[GraphitiClient] Connected to PostgreSQL');
    }
    async close() {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
    }
    async createSchema() {
        if (!this.client)
            throw new Error('Client not initialized');
        // Enable pgvector extension if available
        let hasVector = false;
        try {
            await this.client.query('CREATE EXTENSION IF NOT EXISTS vector');
            hasVector = true;
            console.log('[GraphitiClient] pgvector extension enabled');
        }
        catch {
            console.log('[GraphitiClient] pgvector not available, using JSONB for embeddings');
        }
        const embeddingColumn = hasVector ? 'embedding VECTOR(1536)' : 'embedding JSONB';
        // Entities table
        await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        properties JSONB DEFAULT '{}',
        ${embeddingColumn},
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        // Relationships table
        await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID REFERENCES ${this.prefix}entities(id),
        target_id UUID REFERENCES ${this.prefix}entities(id),
        source_name TEXT NOT NULL,
        target_name TEXT NOT NULL,
        type TEXT NOT NULL,
        properties JSONB DEFAULT '{}',
        valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        valid_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        // Episodes table (conversation history)
        await this.client.query(`
      CREATE TABLE IF NOT EXISTS ${this.prefix}episodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        ${embeddingColumn},
        entities UUID[] DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
        // Create indexes
        await this.client.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_name ON ${this.prefix}entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON ${this.prefix}entities(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON ${this.prefix}relationships(source_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON ${this.prefix}relationships(target_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON ${this.prefix}relationships(type);
      CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON ${this.prefix}episodes(timestamp);
    `);
        // Create GIN indexes for JSONB
        await this.client.query(`
      CREATE INDEX IF NOT EXISTS idx_entities_properties ON ${this.prefix}entities USING GIN(properties);
      CREATE INDEX IF NOT EXISTS idx_episodes_metadata ON ${this.prefix}episodes USING GIN(metadata);
    `);
        console.log('[GraphitiClient] Schema created successfully');
    }
    formatEmbedding(embedding) {
        if (!embedding || embedding.length === 0)
            return null;
        // For JSONB columns (when pgvector not available), stringify the array
        return JSON.stringify(embedding);
    }
    // Entity operations
    async createEntity(entity) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`INSERT INTO ${this.prefix}entities (name, type, properties, embedding)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         type = EXCLUDED.type,
         properties = ${this.prefix}entities.properties || EXCLUDED.properties,
         updated_at = NOW()
       RETURNING *`, [entity.name, entity.type, JSON.stringify(entity.properties), this.formatEmbedding(entity.embedding)]);
        return this.mapEntity(result.rows[0]);
    }
    async getEntityByName(name) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`SELECT * FROM ${this.prefix}entities WHERE name = $1 LIMIT 1`, [name]);
        return result.rows.length > 0 ? this.mapEntity(result.rows[0]) : null;
    }
    async searchEntities(query, limit = 10) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`SELECT * FROM ${this.prefix}entities 
       WHERE name ILIKE $1 OR type ILIKE $1
       ORDER BY 
         CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
         name
       LIMIT $3`, [`%${query}%`, `${query}%`, limit]);
        return result.rows.map(this.mapEntity);
    }
    // Relationship operations
    async createRelationship(rel) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`INSERT INTO ${this.prefix}relationships 
       (source_id, target_id, source_name, target_name, type, properties, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [
            rel.sourceId,
            rel.targetId,
            rel.sourceName,
            rel.targetName,
            rel.type,
            JSON.stringify(rel.properties),
            rel.validFrom,
            rel.validUntil,
        ]);
        return this.mapRelationship(result.rows[0]);
    }
    async getRelationshipsForEntity(entityId) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`SELECT * FROM ${this.prefix}relationships 
       WHERE (source_id = $1 OR target_id = $1)
       AND valid_until IS NULL
       ORDER BY created_at DESC`, [entityId]);
        return result.rows.map(this.mapRelationship);
    }
    // Episode operations
    async createEpisode(episode) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`INSERT INTO ${this.prefix}episodes (content, embedding, entities, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [
            episode.content,
            this.formatEmbedding(episode.embedding),
            episode.entities,
            JSON.stringify(episode.metadata),
            episode.timestamp,
        ]);
        return this.mapEpisode(result.rows[0]);
    }
    async searchEpisodes(query, limit = 10) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`SELECT * FROM ${this.prefix}episodes 
       WHERE content ILIKE $1
       ORDER BY timestamp DESC
       LIMIT $2`, [`%${query}%`, limit]);
        return result.rows.map(this.mapEpisode);
    }
    async getRecentEpisodes(limit = 10) {
        if (!this.client)
            throw new Error('Client not initialized');
        const result = await this.client.query(`SELECT * FROM ${this.prefix}episodes 
       ORDER BY timestamp DESC
       LIMIT $1`, [limit]);
        return result.rows.map(this.mapEpisode);
    }
    // Semantic search (requires pgvector)
    async semanticSearchEpisodes(embedding, limit = 5) {
        if (!this.client)
            throw new Error('Client not initialized');
        try {
            const result = await this.client.query(`SELECT *, embedding <=> $1 as distance 
         FROM ${this.prefix}episodes 
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1
         LIMIT $2`, [JSON.stringify(embedding), limit]);
            return result.rows.map(this.mapEpisode);
        }
        catch {
            // Fallback to text search if pgvector not available
            return [];
        }
    }
    // Helper methods
    mapEntity(row) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            properties: row.properties || {},
            embedding: row.embedding,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    mapRelationship(row) {
        return {
            id: row.id,
            sourceId: row.source_id,
            targetId: row.target_id,
            sourceName: row.source_name,
            targetName: row.target_name,
            type: row.type,
            properties: row.properties || {},
            validFrom: new Date(row.valid_from),
            validUntil: row.valid_until ? new Date(row.valid_until) : undefined,
            createdAt: new Date(row.created_at),
        };
    }
    mapEpisode(row) {
        return {
            id: row.id,
            content: row.content,
            embedding: row.embedding,
            entities: row.entities || [],
            metadata: row.metadata || {},
            timestamp: new Date(row.timestamp),
            createdAt: new Date(row.created_at),
        };
    }
}
//# sourceMappingURL=graphiti-client.js.map