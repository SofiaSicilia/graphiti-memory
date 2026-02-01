/**
 * Graphiti Client - PostgreSQL-based knowledge graph client with pgvector support
 * 
 * Uses a simplified knowledge graph structure stored in PostgreSQL
 * since @edgemaker/core requires Supabase. This is a custom implementation
 * optimized for local PostgreSQL usage with vector similarity search.
 */

import { config } from './config.js';
import pkg from 'pg';
const { Client } = pkg;

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
  entities: string[]; // Entity IDs referenced
  metadata: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

interface VectorCapabilities {
  hasVectorExtension: boolean;
  hasVectorColumns: boolean;
  embeddingDimension: number;
}

export class GraphitiClient {
  private client: InstanceType<typeof Client> | null = null;
  private readonly prefix: string;
  private vectorCapabilities: VectorCapabilities | null = null;

  constructor(private clientConfig: { databaseUrl: string }) {
    this.prefix = config.tablePrefix;
  }

  async initialize(): Promise<void> {
    this.client = new Client({
      connectionString: this.clientConfig.databaseUrl,
    });

    await this.client.connect();
    await this.detectVectorCapabilities();
    await this.createSchema();
    console.log('[GraphitiClient] Connected to PostgreSQL');
    console.log(`[GraphitiClient] Vector support: ${this.vectorCapabilities?.hasVectorExtension ? 'enabled' : 'disabled'}`);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  private async detectVectorCapabilities(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    let hasVectorExtension = false;
    let hasVectorColumns = false;
    let embeddingDimension = 1536; // Default for text-embedding-3-small

    try {
      // Check if pgvector extension is available
      const extResult = await this.client.query(
        "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
      );
      hasVectorExtension = extResult.rows.length > 0;

      if (hasVectorExtension) {
        // Check if tables have vector columns
        const colResult = await this.client.query(`
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = '${this.prefix}entities' 
          AND column_name = 'embedding_vector'
        `);
        hasVectorColumns = colResult.rows.length > 0;
      }
    } catch (err) {
      console.log('[GraphitiClient] Error detecting vector capabilities:', err);
    }

    this.vectorCapabilities = {
      hasVectorExtension,
      hasVectorColumns,
      embeddingDimension,
    };
  }

  getVectorCapabilities(): VectorCapabilities | null {
    return this.vectorCapabilities;
  }

  private async createSchema(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    const hasVector = this.vectorCapabilities?.hasVectorExtension ?? false;
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    // Use vector type if available, otherwise JSONB
    const embeddingColumn = hasVector && hasVectorCols 
      ? 'embedding JSONB, embedding_vector VECTOR(1536)' 
      : 'embedding JSONB';

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

    // Create vector indexes if pgvector is available and columns exist
    if (hasVector && hasVectorCols) {
      try {
        await this.client.query(`
          CREATE INDEX IF NOT EXISTS idx_entities_embedding_cosine 
          ON ${this.prefix}entities 
          USING ivfflat (embedding_vector vector_cosine_ops) 
          WITH (lists = 100)
        `);
        
        await this.client.query(`
          CREATE INDEX IF NOT EXISTS idx_episodes_embedding_cosine 
          ON ${this.prefix}episodes 
          USING ivfflat (embedding_vector vector_cosine_ops) 
          WITH (lists = 100)
        `);
        
        console.log('[GraphitiClient] Vector indexes created');
      } catch (err) {
        console.log('[GraphitiClient] Warning: Could not create vector indexes:', err);
      }
    }

    console.log('[GraphitiClient] Schema created successfully');
  }

  /**
   * Format embedding for database storage
   * Uses vector column if available, falls back to JSONB
   */
  private formatEmbedding(embedding?: number[]): { jsonb: any; vector: any } {
    if (!embedding || embedding.length === 0) {
      return { jsonb: null, vector: null };
    }
    
    return {
      jsonb: JSON.stringify(embedding),
      vector: `[${embedding.join(',')}]`, // pgvector format: [x,y,z,...]
    };
  }

  /**
   * Parse embedding from database row
   * Handles both vector and JSONB formats
   */
  private parseEmbedding(row: any): number[] | undefined {
    if (row.embedding_vector) {
      // pgvector returns arrays as strings like "[x,y,z]" or actual arrays
      const vec = row.embedding_vector;
      if (Array.isArray(vec)) return vec;
      if (typeof vec === 'string') {
        // Parse string representation
        return vec.replace(/[\[\]]/g, '').split(',').map((x: string) => parseFloat(x.trim()));
      }
    }
    
    if (row.embedding) {
      // JSONB format
      if (Array.isArray(row.embedding)) return row.embedding;
      if (typeof row.embedding === 'string') {
        try {
          return JSON.parse(row.embedding);
        } catch {
          return undefined;
        }
      }
    }
    
    return undefined;
  }

  // Entity operations
  async createEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entity> {
    if (!this.client) throw new Error('Client not initialized');

    const embedding = this.formatEmbedding(entity.embedding);
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    let query: string;
    let params: any[];

    if (hasVectorCols) {
      // Use both columns during transition
      query = `
        INSERT INTO ${this.prefix}entities (name, type, properties, embedding, embedding_vector)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          properties = ${this.prefix}entities.properties || EXCLUDED.properties,
          embedding = EXCLUDED.embedding,
          embedding_vector = EXCLUDED.embedding_vector,
          updated_at = NOW()
        RETURNING *
      `;
      params = [entity.name, entity.type, JSON.stringify(entity.properties), embedding.jsonb, embedding.vector];
    } else {
      // JSONB only
      query = `
        INSERT INTO ${this.prefix}entities (name, type, properties, embedding)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          properties = ${this.prefix}entities.properties || EXCLUDED.properties,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
        RETURNING *
      `;
      params = [entity.name, entity.type, JSON.stringify(entity.properties), embedding.jsonb];
    }

    const result = await this.client.query(query, params);
    return this.mapEntity(result.rows[0]);
  }

  async getEntityByName(name: string): Promise<Entity | null> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `SELECT * FROM ${this.prefix}entities WHERE name = $1 LIMIT 1`,
      [name]
    );

    return result.rows.length > 0 ? this.mapEntity(result.rows[0]) : null;
  }

  async searchEntities(query: string, limit: number = 10): Promise<Entity[]> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `SELECT * FROM ${this.prefix}entities 
       WHERE name ILIKE $1 OR type ILIKE $1
       ORDER BY 
         CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
         name
       LIMIT $3`,
      [`%${query}%`, `${query}%`, limit]
    );

    return result.rows.map(this.mapEntity.bind(this));
  }

  /**
   * Semantic search for entities using vector similarity
   * Requires pgvector extension
   */
  async semanticSearchEntities(embedding: number[], limit: number = 5, threshold: number = 0.7): Promise<Entity[]> {
    if (!this.client) throw new Error('Client not initialized');
    
    const hasVector = this.vectorCapabilities?.hasVectorExtension ?? false;
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    if (!hasVector || !hasVectorCols) {
      console.log('[GraphitiClient] Vector search not available, returning empty results');
      return [];
    }

    try {
      const vectorStr = `[${embedding.join(',')}]`;
      
      const result = await this.client.query(
        `SELECT *, embedding_vector <=> $1 as distance 
         FROM ${this.prefix}entities 
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <=> $1
         LIMIT $2`,
        [vectorStr, limit]
      );

      return result.rows.map(this.mapEntity.bind(this));
    } catch (err) {
      console.error('[GraphitiClient] Semantic search error:', err);
      return [];
    }
  }

  // Relationship operations
  async createRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<Relationship> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `INSERT INTO ${this.prefix}relationships 
       (source_id, target_id, source_name, target_name, type, properties, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        rel.sourceId,
        rel.targetId,
        rel.sourceName,
        rel.targetName,
        rel.type,
        JSON.stringify(rel.properties),
        rel.validFrom,
        rel.validUntil,
      ]
    );

    return this.mapRelationship(result.rows[0]);
  }

  async getRelationshipsForEntity(entityId: string): Promise<Relationship[]> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `SELECT * FROM ${this.prefix}relationships 
       WHERE (source_id = $1 OR target_id = $1)
       AND valid_until IS NULL
       ORDER BY created_at DESC`,
      [entityId]
    );

    return result.rows.map(this.mapRelationship);
  }

  // Episode operations
  async createEpisode(episode: Omit<Episode, 'id' | 'createdAt'>): Promise<Episode> {
    if (!this.client) throw new Error('Client not initialized');

    const embedding = this.formatEmbedding(episode.embedding);
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    let query: string;
    let params: any[];

    if (hasVectorCols) {
      query = `
        INSERT INTO ${this.prefix}episodes (content, embedding, embedding_vector, entities, metadata, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      params = [
        episode.content,
        embedding.jsonb,
        embedding.vector,
        episode.entities,
        JSON.stringify(episode.metadata),
        episode.timestamp,
      ];
    } else {
      query = `
        INSERT INTO ${this.prefix}episodes (content, embedding, entities, metadata, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      params = [
        episode.content,
        embedding.jsonb,
        episode.entities,
        JSON.stringify(episode.metadata),
        episode.timestamp,
      ];
    }

    const result = await this.client.query(query, params);
    return this.mapEpisode(result.rows[0]);
  }

  async searchEpisodes(query: string, limit: number = 10): Promise<Episode[]> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `SELECT * FROM ${this.prefix}episodes 
       WHERE content ILIKE $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );

    return result.rows.map(this.mapEpisode.bind(this));
  }

  async getRecentEpisodes(limit: number = 10): Promise<Episode[]> {
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.query(
      `SELECT * FROM ${this.prefix}episodes 
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(this.mapEpisode.bind(this));
  }

  /**
   * Semantic search for episodes using vector similarity
   * Uses cosine distance for best semantic matching
   */
  async semanticSearchEpisodes(embedding: number[], limit: number = 5, threshold?: number): Promise<Episode[]> {
    if (!this.client) throw new Error('Client not initialized');

    const hasVector = this.vectorCapabilities?.hasVectorExtension ?? false;
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    if (!hasVector || !hasVectorCols) {
      console.log('[GraphitiClient] Vector search not available, returning empty results');
      return [];
    }

    try {
      const vectorStr = `[${embedding.join(',')}]`;
      
      // Use cosine distance (1 - cosine similarity)
      // Lower distance = more similar
      const result = await this.client.query(
        `SELECT *, embedding_vector <=> $1 as distance 
         FROM ${this.prefix}episodes 
         WHERE embedding_vector IS NOT NULL
         ORDER BY embedding_vector <=> $1
         LIMIT $2`,
        [vectorStr, limit]
      );

      return result.rows.map(this.mapEpisode.bind(this));
    } catch (err) {
      console.error('[GraphitiClient] Semantic search error:', err);
      return [];
    }
  }

  /**
   * Hybrid search: combines semantic similarity with text search
   * Returns episodes that match either by meaning or by text content
   */
  async hybridSearchEpisodes(
    queryText: string,
    queryEmbedding: number[],
    limit: number = 5,
    semanticWeight: number = 0.7
  ): Promise<Array<Episode & { score: number }>> {
    if (!this.client) throw new Error('Client not initialized');

    const hasVector = this.vectorCapabilities?.hasVectorExtension ?? false;
    const hasVectorCols = this.vectorCapabilities?.hasVectorColumns ?? false;

    if (!hasVector || !hasVectorCols) {
      // Fallback to text search only
      const episodes = await this.searchEpisodes(queryText, limit);
      return episodes.map(e => ({ ...e, score: 0.5 }));
    }

    try {
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const textWeight = 1 - semanticWeight;

      const result = await this.client.query(
        `WITH semantic_scores AS (
          SELECT 
            id,
            1 - (embedding_vector <=> $1) as semantic_score
          FROM ${this.prefix}episodes
          WHERE embedding_vector IS NOT NULL
        ),
        text_scores AS (
          SELECT 
            id,
            CASE 
              WHEN content ILIKE $3 THEN 1.0
              WHEN content ILIKE $4 THEN 0.5
              ELSE 0.0
            END as text_score
          FROM ${this.prefix}episodes
        )
        SELECT 
          e.*,
          COALESCE(s.semantic_score, 0) * $5 + COALESCE(t.text_score, 0) * $6 as score
        FROM ${this.prefix}episodes e
        LEFT JOIN semantic_scores s ON e.id = s.id
        LEFT JOIN text_scores t ON e.id = t.id
        WHERE s.semantic_score IS NOT NULL OR t.text_score > 0
        ORDER BY score DESC
        LIMIT $2`,
        [vectorStr, limit, `%${queryText}%`, `%${queryText.split(' ').join('%')}%`, semanticWeight, textWeight]
      );

      return result.rows.map((row: any) => ({
        ...this.mapEpisode(row),
        score: row.score,
      }));
    } catch (err) {
      console.error('[GraphitiClient] Hybrid search error:', err);
      // Fallback to text search
      const episodes = await this.searchEpisodes(queryText, limit);
      return episodes.map(e => ({ ...e, score: 0.5 }));
    }
  }

  // Helper methods
  private mapEntity(row: any): Entity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      properties: row.properties || {},
      embedding: this.parseEmbedding(row),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRelationship(row: any): Relationship {
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

  private mapEpisode(row: any): Episode {
    return {
      id: row.id,
      content: row.content,
      embedding: this.parseEmbedding(row),
      entities: row.entities || [],
      metadata: row.metadata || {},
      timestamp: new Date(row.timestamp),
      createdAt: new Date(row.created_at),
    };
  }
}
