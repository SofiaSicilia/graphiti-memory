/**
 * OpenClaw Integration for Graphiti Memory
 * 
 * This file provides the middleware layer that integrates Graphiti Memory
 * with the OpenClaw agent runtime. It wraps agent message processing and
 * provides context retrieval and conversation storage.
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

// Cost tracking
import { CostTracker } from './cost-tracker.js';

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

export interface OpenClawConfig {
  databaseUrl?: string;
  openAiApiKey?: string;
  maxContextResults?: number;
  entityExtractionModel?: string;
  enableCostTracking?: boolean;
}

// Global instances
let isInitialized = false;
let costTracker: CostTracker | null = null;

/**
 * Initialize the Graphiti Memory integration
 * Call this when OpenClaw agent starts up
 */
export async function initializeGraphitiIntegration(
  config?: OpenClawConfig
): Promise<void> {
  if (isInitialized) {
    console.log('[GraphitiIntegration] Already initialized');
    return;
  }

  console.log('[GraphitiIntegration] Initializing Graphiti Memory...');

  // Initialize cost tracking if enabled
  if (config?.enableCostTracking !== false) {
    costTracker = new CostTracker();
    await costTracker.initialize();
  }

  // Build config for the skill
  const skillConfig = {
    databaseUrl: config?.databaseUrl || process.env.GRAPHITI_DB_URL || 'postgresql://aitorortega@localhost:5432/secondbrain',
    openAiApiKey: config?.openAiApiKey || process.env.OPENAI_API_KEY || '',
    maxContextResults: config?.maxContextResults || 10,
    entityExtractionModel: config?.entityExtractionModel || 'gpt-4o-mini',
  };

  try {
    await initializeGraphiti(skillConfig);
    isInitialized = true;
    console.log('[GraphitiIntegration] ✅ Graphiti Memory ready');
  } catch (error) {
    console.error('[GraphitiIntegration] ❌ Failed to initialize:', error);
    throw error;
  }
}

/**
 * Middleware: Called before the agent generates a response
 * 
 * This retrieves relevant context from the knowledge graph and formats
 * it for inclusion in the system prompt.
 * 
 * @param message - The incoming user message
 * @returns Context string to add to the system prompt (or empty string)
 */
export async function onBeforeResponse(message: Message): Promise<string> {
  if (!isInitialized) {
    console.warn('[GraphitiIntegration] Not initialized, skipping context retrieval');
    return '';
  }

  const startTime = Date.now();

  try {
    // Get context from the knowledge graph
    const context = await graphiti_get_context(message.content);
    
    const duration = Date.now() - startTime;
    
    if (costTracker) {
      costTracker.logOperation('recall', {
        messageLength: message.content.length,
        contextLength: context?.length || 0,
        durationMs: duration,
        hasResults: !!context && context.length > 0,
      });
    }

    if (context && context.trim().length > 0) {
      console.log(`[GraphitiIntegration] 📚 Retrieved context (${duration}ms)`);
      return `\n\n---\n📚 **Context from Memory:**\n${context}\n---\n`;
    }

    return '';
  } catch (error) {
    console.error('[GraphitiIntegration] Error getting context:', error);
    return '';
  }
}

/**
 * Middleware: Called after the agent generates a response
 * 
 * This captures the conversation to the knowledge graph for future recall.
 * 
 * @param message - The original user message
 * @param response - The agent's response
 */
export async function onAfterResponse(
  message: Message,
  response: AgentResponse
): Promise<void> {
  if (!isInitialized) {
    console.warn('[GraphitiIntegration] Not initialized, skipping conversation capture');
    return;
  }

  const startTime = Date.now();

  try {
    const context: ToolContext = {
      channelId: message.channelId,
      threadId: message.threadId,
      userId: message.authorId,
    };

    await graphiti_capture(message.content, response.content, context);
    
    const duration = Date.now() - startTime;
    
    if (costTracker) {
      // Estimate tokens for cost tracking
      const totalChars = message.content.length + response.content.length;
      const estimatedTokens = Math.ceil(totalChars / 4); // Rough estimate
      
      costTracker.logOperation('capture', {
        messageLength: message.content.length,
        responseLength: response.content.length,
        estimatedTokens,
        durationMs: duration,
      });
    }

    console.log(`[GraphitiIntegration] 💾 Captured conversation (${duration}ms)`);
  } catch (error) {
    console.error('[GraphitiIntegration] Error capturing conversation:', error);
    // Don't throw - we don't want memory errors to break the conversation
  }
}

/**
 * Get cost statistics for monitoring
 */
export async function getCostStats(): Promise<{
  totalOperations: number;
  totalEstimatedCost: number;
  operationsByType: Record<string, number>;
} | null> {
  if (!costTracker) return null;
  return costTracker.getStats();
}

/**
 * Cleanup when OpenClaw shuts down
 */
export async function shutdownGraphitiIntegration(): Promise<void> {
  console.log('[GraphitiIntegration] Shutting down...');
  
  if (costTracker) {
    await costTracker.close();
    costTracker = null;
  }
  
  await closeGraphiti();
  isInitialized = false;
  
  console.log('[GraphitiIntegration] ✅ Shutdown complete');
}

// Re-export tools for OpenClaw to register
export { graphiti_recall, graphiti_add_fact };

// Re-export types
export type { ToolContext };
