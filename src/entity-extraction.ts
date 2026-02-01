/**
 * Entity Extraction using OpenAI
 * 
 * Extracts entities and relationships from text using LLM
 */

import OpenAI from 'openai';
import { config } from './config.js';

// Simple type definitions
export interface ExtractedEntity {
  name: string;
  type: 'Person' | 'Organization' | 'Location' | 'Concept' | 'Event' | 'Product' | 'Technology' | 'Task' | 'Goal' | 'Preference' | 'Other';
  properties?: Record<string, string>;
}

export interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, string>;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  summary?: string;
}

export class EntityExtraction {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Extract entities and relationships from text
   */
  async extract(text: string): Promise<ExtractionResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: config.entityExtractionModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert entity extraction system. Extract entities and relationships from the provided text.

Focus on:
- People, organizations, locations
- Concepts, tasks, goals mentioned
- Preferences expressed by the user
- Technologies or products discussed

Return a JSON object with this structure:
{
  "entities": [
    {"name": "Entity Name", "type": "Person|Organization|Location|Concept|Event|Product|Technology|Task|Goal|Preference|Other", "properties": {}}
  ],
  "relationships": [
    {"source": "Entity1", "target": "Entity2", "type": "relationship_type", "properties": {}}
  ],
  "summary": "Brief summary"
}

For relationships, identify how entities are connected (e.g., "works_for", "likes", "located_in", "part_of").
Be concise but thorough. Only extract meaningful entities and relationships.`
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { entities: [], relationships: [] };
      }

      const result = JSON.parse(content) as ExtractionResult;
      return {
        entities: result.entities || [],
        relationships: result.relationships || [],
        summary: result.summary,
      };
    } catch (error) {
      console.error('[EntityExtraction] Error:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Extract entities from a conversation turn
   */
  async extractFromConversation(
    userMessage: string,
    assistantResponse: string
  ): Promise<ExtractionResult> {
    const combinedText = `User: ${userMessage}\n\nAssistant: ${assistantResponse}`;
    return this.extract(combinedText);
  }

  /**
   * Get embeddings for text
   */
  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: config.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[EntityExtraction] Embedding error:', error);
      return [];
    }
  }

  /**
   * Generate a summary of the text
   */
  async summarize(text: string, maxLength: number = 200): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: config.entityExtractionModel,
        messages: [
          {
            role: 'system',
            content: `Summarize the following text in at most ${maxLength} characters. Focus on key facts and information that should be remembered.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content?.trim() || text.substring(0, maxLength);
    } catch (error) {
      console.error('[EntityExtraction] Summarize error:', error);
      return text.substring(0, maxLength);
    }
  }
}
