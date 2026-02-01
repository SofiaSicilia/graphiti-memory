/**
 * Conversation Capture
 *
 * Processes and stores conversation turns in the knowledge graph
 */
import { GraphitiClient } from './graphiti-client.js';
import { EntityExtraction } from './entity-extraction.js';
export declare class ConversationCapture {
    private client;
    private extraction;
    constructor(client: GraphitiClient, extraction: EntityExtraction);
    /**
     * Process a conversation turn
     */
    processTurn(userMessage: string, assistantResponse: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Add a standalone fact to the knowledge graph
     */
    addFact(fact: string, metadata?: Record<string, any>): Promise<void>;
}
//# sourceMappingURL=conversation-capture.d.ts.map