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
  episodes: Array<Episode & { relevance: number }>;
}

export class QueryContext {
  constructor(private client: GraphitiClient) {}

  /**
   * Search for relevant context
   */
  async search(query: string, options: QueryOptions = {}): Promise<QueryResult> {
    const {
      limit = 10,
      includeEntities = true,
      includeRelationships = true,
      includeEpisodes = true,
    } = options;

    const result: QueryResult = {
      entities: [],
      relationships: [],
      episodes: [],
    };

    // Search episodes by content
    if (includeEpisodes) {
      const episodes = await this.client.searchEpisodes(query, limit);
      result.episodes = episodes.map(e => ({ ...e, relevance: 1.0 }));
    }

    // Search entities
    if (includeEntities) {
      result.entities = await this.client.searchEntities(query, limit);
    }

    // Get relationships for found entities
    if (includeRelationships && result.entities.length > 0) {
      const relationshipSet = new Map<string, Relationship>();
      
      for (const entity of result.entities) {
        const rels = await this.client.getRelationshipsForEntity(entity.id);
        for (const rel of rels) {
          relationshipSet.set(rel.id, rel);
        }
      }

      result.relationships = Array.from(relationshipSet.values());
    }

    return result;
  }

  /**
   * Get recent conversation history
   */
  async getRecentHistory(limit: number = 5): Promise<Episode[]> {
    return this.client.getRecentEpisodes(limit);
  }

  /**
   * Get all information about a specific entity
   */
  async getEntityContext(entityName: string): Promise<{
    entity: Entity | null;
    relationships: Relationship[];
    relatedEpisodes: Episode[];
  }> {
    const entity = await this.client.getEntityByName(entityName);
    
    if (!entity) {
      return { entity: null, relationships: [], relatedEpisodes: [] };
    }

    const relationships = await this.client.getRelationshipsForEntity(entity.id);
    
    // Get episodes that mention this entity
    const allEpisodes = await this.client.getRecentEpisodes(50);
    const relatedEpisodes = allEpisodes.filter(e => 
      e.content.toLowerCase().includes(entityName.toLowerCase()) ||
      e.entities.includes(entity.id)
    );

    return {
      entity,
      relationships,
      relatedEpisodes,
    };
  }

  /**
   * Format query result as a string for LLM context
   */
  formatAsContext(result: QueryResult): string {
    const parts: string[] = [];

    if (result.entities.length > 0) {
      parts.push('## Known Entities:');
      result.entities.forEach(e => {
        const props = Object.entries(e.properties)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        parts.push(`- ${e.name} (${e.type})${props ? ` [${props}]` : ''}`);
      });
    }

    if (result.relationships.length > 0) {
      parts.push('\n## Known Relationships:');
      result.relationships.forEach(r => {
        parts.push(`- ${r.sourceName} --[${r.type}]--> ${r.targetName}`);
      });
    }

    if (result.episodes.length > 0) {
      parts.push('\n## Previous Related Conversations:');
      result.episodes.forEach(e => {
        const lines = e.content.split('\n').slice(0, 3);
        parts.push(`- ${lines.join(' ').substring(0, 150)}...`);
      });
    }

    return parts.join('\n');
  }
}
