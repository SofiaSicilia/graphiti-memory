/**
 * Configuration for Graphiti Memory Skill
 */
import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenvConfig();
dotenvConfig({ path: '/Users/aitorortega/clawd/.env' });
dotenvConfig({ path: '/Users/aitorortega/clawd/second-brain/.env' });

// Load config file if exists
let fileConfig: Record<string, any> = {};
try {
  const configPath = join('/Users/aitorortega/clawd', 'data', 'graphiti-config.json');
  fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  // Config file doesn't exist, use defaults
}

export const config = {
  // Database
  databaseUrl: process.env.GRAPHITI_DB_URL || 
    process.env.DATABASE_URL || 
    fileConfig.databaseUrl ||
    'postgresql://localhost:5432/graphiti',

  // OpenAI
  openAiApiKey: process.env.OPENAI_API_KEY || 
    fileConfig.openAiApiKey ||
    '',

  // Settings
  maxContextResults: parseInt(process.env.GRAPHITI_MAX_RESULTS || '10', 10),
  entityExtractionModel: process.env.GRAPHITI_MODEL || 'gpt-4o-mini',
  embeddingModel: process.env.GRAPHITI_EMBEDDING_MODEL || 'text-embedding-3-large',

  // Feature flags
  enableEntityExtraction: fileConfig.enableEntityExtraction !== false,
  enableEmbeddings: fileConfig.enableEmbeddings !== false,
  
  // Table prefixes
  tablePrefix: fileConfig.tablePrefix || 'graphiti_',
};

// Validation
export function validateConfig(): void {
  if (!config.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required. Set it in .env or graphiti-config.json');
  }
  
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL or GRAPHITI_DB_URL is required');
  }
}
