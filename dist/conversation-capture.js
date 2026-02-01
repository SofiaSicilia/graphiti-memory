/**
 * Conversation Capture
 *
 * Processes and stores conversation turns in the knowledge graph
 */
import { config } from './config.js';
export class ConversationCapture {
    client;
    extraction;
    constructor(client, extraction) {
        this.client = client;
        this.extraction = extraction;
    }
    /**
     * Process a conversation turn
     */
    async processTurn(userMessage, assistantResponse, metadata) {
        // 1. Extract entities and relationships
        const extraction = await this.extraction.extractFromConversation(userMessage, assistantResponse);
        // 2. Create/update entities in the graph
        const entityMap = new Map();
        for (const extractedEntity of extraction.entities) {
            const embedding = config.enableEmbeddings
                ? await this.extraction.getEmbedding(extractedEntity.name)
                : undefined;
            const entity = await this.client.createEntity({
                name: extractedEntity.name,
                type: extractedEntity.type,
                properties: {
                    ...extractedEntity.properties,
                    lastSeen: new Date().toISOString(),
                },
                embedding,
            });
            entityMap.set(entity.name, entity);
        }
        // 3. Create relationships
        for (const rel of extraction.relationships) {
            const sourceEntity = entityMap.get(rel.source);
            const targetEntity = entityMap.get(rel.target);
            if (sourceEntity && targetEntity) {
                await this.client.createRelationship({
                    sourceId: sourceEntity.id,
                    targetId: targetEntity.id,
                    sourceName: sourceEntity.name,
                    targetName: targetEntity.name,
                    type: rel.type,
                    properties: rel.properties || {},
                    validFrom: new Date(),
                });
            }
        }
        // 4. Store the episode (conversation)
        const episodeContent = `User: ${userMessage}\nAssistant: ${assistantResponse}`;
        const episodeEmbedding = config.enableEmbeddings
            ? await this.extraction.getEmbedding(episodeContent)
            : undefined;
        await this.client.createEpisode({
            content: episodeContent,
            embedding: episodeEmbedding,
            entities: Array.from(entityMap.values()).map(e => e.id),
            metadata: {
                ...metadata,
                userMessage,
                assistantResponse,
                entityCount: extraction.entities.length,
                relationshipCount: extraction.relationships.length,
            },
            timestamp: new Date(),
        });
        console.log(`[ConversationCapture] Stored turn with ${extraction.entities.length} entities, ${extraction.relationships.length} relationships`);
    }
    /**
     * Add a standalone fact to the knowledge graph
     */
    async addFact(fact, metadata) {
        // Extract entities from the fact
        const extraction = await this.extraction.extract(fact);
        // Create entities
        const entityMap = new Map();
        for (const extractedEntity of extraction.entities) {
            const embedding = config.enableEmbeddings
                ? await this.extraction.getEmbedding(extractedEntity.name)
                : undefined;
            const entity = await this.client.createEntity({
                name: extractedEntity.name,
                type: extractedEntity.type,
                properties: {
                    ...extractedEntity.properties,
                    factAdded: new Date().toISOString(),
                },
                embedding,
            });
            entityMap.set(entity.name, entity);
        }
        // Create relationships
        for (const rel of extraction.relationships) {
            const sourceEntity = entityMap.get(rel.source);
            const targetEntity = entityMap.get(rel.target);
            if (sourceEntity && targetEntity) {
                await this.client.createRelationship({
                    sourceId: sourceEntity.id,
                    targetId: targetEntity.id,
                    sourceName: sourceEntity.name,
                    targetName: targetEntity.name,
                    type: rel.type,
                    properties: rel.properties || {},
                    validFrom: new Date(),
                });
            }
        }
        // Store as episode
        const embedding = config.enableEmbeddings
            ? await this.extraction.getEmbedding(fact)
            : undefined;
        await this.client.createEpisode({
            content: `Fact: ${fact}`,
            embedding,
            entities: Array.from(entityMap.values()).map(e => e.id),
            metadata: {
                ...metadata,
                type: 'fact',
                entityCount: extraction.entities.length,
                relationshipCount: extraction.relationships.length,
            },
            timestamp: new Date(),
        });
        console.log(`[ConversationCapture] Added fact with ${extraction.entities.length} entities`);
    }
}
//# sourceMappingURL=conversation-capture.js.map