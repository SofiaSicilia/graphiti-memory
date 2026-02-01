/**
 * OpenClaw Skill Integration
 * 
 * This file integrates Graphiti Memory with the OpenClaw agent system
 * It provides hooks for message processing and response generation
 */

import {
  initializeGraphiti,
  graphiti_recall,
  graphiti_add_fact,
  graphiti_get_context,
  graphiti_capture,
  closeGraphiti,
  ToolContext,
} from './tools.js';

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
export async function onStartup(): Promise<void> {
  console.log('[GraphitiSkill] Initializing...');
  await initializeGraphiti();
  console.log('[GraphitiSkill] Ready');
}

/**
 * Called before the agent generates a response
 * Returns context to include in the system prompt
 */
export async function onBeforeResponse(message: Message): Promise<string> {
  try {
    const context = await graphiti_get_context(message.content);
    
    if (context) {
      return `\n\n---\n📚 **Context from Memory:**\n${context}\n---\n`;
    }
    
    return '';
  } catch (error) {
    console.error('[GraphitiSkill] Error getting context:', error);
    return '';
  }
}

/**
 * Called after the agent generates a response
 * Stores the conversation in the knowledge graph
 */
export async function onAfterResponse(
  message: Message,
  response: AgentResponse
): Promise<void> {
  try {
    const context: ToolContext = {
      channelId: message.channelId,
      threadId: message.threadId,
      userId: message.authorId,
    };

    await graphiti_capture(message.content, response.content, context);
  } catch (error) {
    console.error('[GraphitiSkill] Error capturing conversation:', error);
  }
}

/**
 * Cleanup when OpenClaw shuts down
 */
export async function onShutdown(): Promise<void> {
  console.log('[GraphitiSkill] Shutting down...');
  await closeGraphiti();
}

// Re-export tools for OpenClaw to register
export { graphiti_recall, graphiti_add_fact };
