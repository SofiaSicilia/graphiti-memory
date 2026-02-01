#!/usr/bin/env node
/**
 * OpenClaw Graphiti Memory Integration
 * 
 * This script demonstrates how to integrate Graphiti Memory with OpenClaw
 */

import { 
  initializeGraphiti,
  graphiti_recall,
  graphiti_add_fact,
  graphiti_get_context,
  graphiti_capture,
  closeGraphiti,
} from './dist/tools.js';

async function main() {
  console.log('🧠 Graphiti Memory for OpenClaw\n');

  // Initialize
  await initializeGraphiti();
  
  // Example: Add some facts
  console.log('Adding facts to memory...');
  await graphiti_add_fact('Sofía is an AI assistant running on OpenClaw');
  await graphiti_add_fact('Aitor is building the 2nd Brain project using NextJS and PostgreSQL');
  
  // Example: Recall information
  console.log('\nQuerying memory...');
  const results = await graphiti_recall('What is Sofía?');
  console.log(results);
  
  // Example: Capture conversation
  console.log('\nCapturing conversation...');
  await graphiti_capture(
    'What are you working on?',
    'I\'m helping with the OpenClaw project and the 2nd Brain system.',
    { channelId: 'test-channel' }
  );
  
  // Get context for a message
  console.log('\nGetting context for message...');
  const context = await graphiti_get_context('Tell me about the projects');
  console.log(context);
  
  // Cleanup
  await closeGraphiti();
  console.log('\n✅ Done!');
}

main().catch(console.error);
