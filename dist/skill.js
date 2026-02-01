/**
 * OpenClaw Skill Integration
 *
 * This file integrates Graphiti Memory with the OpenClaw agent system
 * It provides hooks for message processing and response generation
 */
import { initializeGraphiti, graphiti_recall, graphiti_add_fact, graphiti_get_context, graphiti_capture, closeGraphiti, } from './tools.js';
/**
 * Initialize the skill when OpenClaw starts
 */
export async function onStartup() {
    console.log('[GraphitiSkill] Initializing...');
    await initializeGraphiti();
    console.log('[GraphitiSkill] Ready');
}
/**
 * Called before the agent generates a response
 * Returns context to include in the system prompt
 */
export async function onBeforeResponse(message) {
    try {
        const context = await graphiti_get_context(message.content);
        if (context) {
            return `\n\n---\n📚 **Context from Memory:**\n${context}\n---\n`;
        }
        return '';
    }
    catch (error) {
        console.error('[GraphitiSkill] Error getting context:', error);
        return '';
    }
}
/**
 * Called after the agent generates a response
 * Stores the conversation in the knowledge graph
 */
export async function onAfterResponse(message, response) {
    try {
        const context = {
            channelId: message.channelId,
            threadId: message.threadId,
            userId: message.authorId,
        };
        await graphiti_capture(message.content, response.content, context);
    }
    catch (error) {
        console.error('[GraphitiSkill] Error capturing conversation:', error);
    }
}
/**
 * Cleanup when OpenClaw shuts down
 */
export async function onShutdown() {
    console.log('[GraphitiSkill] Shutting down...');
    await closeGraphiti();
}
// Re-export tools for OpenClaw to register
export { graphiti_recall, graphiti_add_fact };
//# sourceMappingURL=skill.js.map