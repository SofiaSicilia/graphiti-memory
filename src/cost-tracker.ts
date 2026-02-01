/**
 * Cost Tracker for Graphiti Memory
 * 
 * Tracks API usage costs for embeddings and entity extraction.
 * Stores data in ~/.openclaw/memory/cost-log.jsonl
 */

import { appendFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Cost rates (as of Feb 2025)
interface EmbeddingRate {
  type: 'embedding';
  per1MTokens: number;
  description: string;
}

interface ModelRate {
  type: 'model';
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  description: string;
}

type CostRate = EmbeddingRate | ModelRate;

const COST_RATES: Record<string, CostRate> = {
  // Embeddings: text-embedding-3-large
  'embedding-large': {
    type: 'embedding',
    per1MTokens: 0.13,
    description: 'text-embedding-3-large',
  },
  // Embeddings: text-embedding-3-small
  'embedding-small': {
    type: 'embedding',
    per1MTokens: 0.02,
    description: 'text-embedding-3-small',
  },
  // Entity extraction models
  'gpt-4o-mini': {
    type: 'model',
    inputPer1MTokens: 0.15,
    outputPer1MTokens: 0.60,
    description: 'GPT-4o-mini',
  },
  'gpt-4o': {
    type: 'model',
    inputPer1MTokens: 2.50,
    outputPer1MTokens: 10.00,
    description: 'GPT-4o',
  },
};

export interface CostEntry {
  timestamp: string;
  operation: 'recall' | 'capture' | 'entity_extraction' | 'embedding';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost: number;
  details: Record<string, any>;
}

export interface CostStats {
  totalOperations: number;
  totalEstimatedCost: number;
  operationsByType: Record<string, number>;
  costByType: Record<string, number>;
  dailyCosts: Record<string, number>;
}

export class CostTracker {
  private logDir: string;
  private logFile: string;
  private initialized = false;

  constructor() {
    this.logDir = join(homedir(), '.openclaw', 'memory');
    this.logFile = join(this.logDir, 'cost-log.jsonl');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create directory if needed
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }

    this.initialized = true;
    console.log('[CostTracker] Initialized at:', this.logFile);
  }

  /**
   * Log an operation with cost estimation
   */
  async logOperation(
    operation: CostEntry['operation'],
    details: Record<string, any> = {}
  ): Promise<void> {
    if (!this.initialized) await this.initialize();

    const estimatedCost = this.calculateCost(operation, details);

    const entry: CostEntry = {
      timestamp: new Date().toISOString(),
      operation,
      model: details.model,
      inputTokens: details.inputTokens,
      outputTokens: details.outputTokens,
      estimatedCost,
      details,
    };

    // Append to log file
    await appendFile(this.logFile, JSON.stringify(entry) + '\n');
  }

  /**
   * Calculate estimated cost for an operation
   */
  private calculateCost(
    operation: CostEntry['operation'],
    details: Record<string, any>
  ): number {
    let cost = 0;

    switch (operation) {
      case 'embedding': {
        // Estimate embedding cost based on characters (approx 4 chars per token)
        const embedChars = details.textLength || 0;
        const embedTokens = Math.ceil(embedChars / 4);
        const embedRate = COST_RATES['embedding-large'] as EmbeddingRate;
        cost = (embedTokens / 1_000_000) * embedRate.per1MTokens;
        break;
      }

      case 'entity_extraction': {
        // Entity extraction uses LLM
        const model = details.model || 'gpt-4o-mini';
        const inputTokens = details.inputTokens || Math.ceil((details.textLength || 0) / 4);
        const outputTokens = details.outputTokens || 150; // Estimated
        
        const rate = COST_RATES[model] as ModelRate || COST_RATES['gpt-4o-mini'] as ModelRate;
        cost = 
          (inputTokens / 1_000_000) * rate.inputPer1MTokens +
          (outputTokens / 1_000_000) * rate.outputPer1MTokens;
        break;
      }

      case 'recall': {
        // Recall involves embeddings (for the query)
        const queryChars = details.messageLength || 0;
        const queryTokens = Math.ceil(queryChars / 4);
        const embedRate = COST_RATES['embedding-large'] as EmbeddingRate;
        cost = (queryTokens / 1_000_000) * embedRate.per1MTokens;
        break;
      }

      case 'capture': {
        // Capture involves:
        // 1. Embedding the conversation
        // 2. Entity extraction from the conversation
        const convoChars = (details.messageLength || 0) + (details.responseLength || 0);
        const embedRate = COST_RATES['embedding-large'] as EmbeddingRate;
        const embedCost = (Math.ceil(convoChars / 4) / 1_000_000) * embedRate.per1MTokens;
        
        // Entity extraction (roughly 300 tokens output for typical conversation)
        const extractionInput = Math.ceil(convoChars / 4);
        const extractionOutput = 200; // Estimated
        const extractionRate = COST_RATES['gpt-4o-mini'] as ModelRate;
        const extractionCost = 
          (extractionInput / 1_000_000) * extractionRate.inputPer1MTokens +
          (extractionOutput / 1_000_000) * extractionRate.outputPer1MTokens;
        
        cost = embedCost + extractionCost;
        break;
      }
    }

    return Math.round(cost * 1_000_000) / 1_000_000; // Round to 6 decimal places
  }

  /**
   * Get cost statistics
   */
  async getStats(): Promise<CostStats> {
    if (!existsSync(this.logFile)) {
      return {
        totalOperations: 0,
        totalEstimatedCost: 0,
        operationsByType: {},
        costByType: {},
        dailyCosts: {},
      };
    }

    const content = await readFile(this.logFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const stats: CostStats = {
      totalOperations: 0,
      totalEstimatedCost: 0,
      operationsByType: {},
      costByType: {},
      dailyCosts: {},
    };

    for (const line of lines) {
      try {
        const entry: CostEntry = JSON.parse(line);
        stats.totalOperations++;
        stats.totalEstimatedCost += entry.estimatedCost;

        // By operation type
        stats.operationsByType[entry.operation] = 
          (stats.operationsByType[entry.operation] || 0) + 1;
        stats.costByType[entry.operation] = 
          (stats.costByType[entry.operation] || 0) + entry.estimatedCost;

        // By day
        const day = entry.timestamp.split('T')[0];
        stats.dailyCosts[day] = (stats.dailyCosts[day] || 0) + entry.estimatedCost;
      } catch {
        // Skip malformed lines
      }
    }

    // Round costs to 6 decimal places
    stats.totalEstimatedCost = Math.round(stats.totalEstimatedCost * 1_000_000) / 1_000_000;
    for (const key of Object.keys(stats.costByType)) {
      stats.costByType[key] = Math.round(stats.costByType[key] * 1_000_000) / 1_000_000;
    }
    for (const key of Object.keys(stats.dailyCosts)) {
      stats.dailyCosts[key] = Math.round(stats.dailyCosts[key] * 1_000_000) / 1_000_000;
    }

    return stats;
  }

  /**
   * Get the cost log file path
   */
  getLogPath(): string {
    return this.logFile;
  }

  /**
   * Get cost rates information
   */
  getRates(): Record<string, CostRate> {
    return COST_RATES;
  }

  async close(): Promise<void> {
    // Nothing to close for file-based logging
    this.initialized = false;
  }
}

// Export singleton instance
export const costTracker = new CostTracker();
export default costTracker;
