/**
 * Entity Extraction using OpenAI
 *
 * Extracts entities and relationships from text using LLM
 */
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
export declare class EntityExtraction {
    private openai;
    constructor(apiKey: string);
    /**
     * Extract entities and relationships from text
     */
    extract(text: string): Promise<ExtractionResult>;
    /**
     * Extract entities from a conversation turn
     */
    extractFromConversation(userMessage: string, assistantResponse: string): Promise<ExtractionResult>;
    /**
     * Get embeddings for text
     */
    getEmbedding(text: string): Promise<number[]>;
    /**
     * Generate a summary of the text
     */
    summarize(text: string, maxLength?: number): Promise<string>;
}
//# sourceMappingURL=entity-extraction.d.ts.map