/**
 * OpenClaw Skill Integration
 *
 * This file integrates Graphiti Memory with the OpenClaw agent system
 * It provides hooks for message processing and response generation
 */
import { graphiti_recall, graphiti_add_fact } from './tools.js';
export interface Message {
    id: string;
    content: string;
    authorId: string;
    channelId: string;
    threadId?: string;
    timestamp: Date;
}
export interface AgentResponse {
    content: string;
    metadata?: Record<string, any>;
}
/**
 * Initialize the skill when OpenClaw starts
 */
export declare function onStartup(): Promise<void>;
/**
 * Called before the agent generates a response
 * Returns context to include in the system prompt
 */
export declare function onBeforeResponse(message: Message): Promise<string>;
/**
 * Called after the agent generates a response
 * Stores the conversation in the knowledge graph
 */
export declare function onAfterResponse(message: Message, response: AgentResponse): Promise<void>;
/**
 * Cleanup when OpenClaw shuts down
 */
export declare function onShutdown(): Promise<void>;
export { graphiti_recall, graphiti_add_fact };
//# sourceMappingURL=skill.d.ts.map