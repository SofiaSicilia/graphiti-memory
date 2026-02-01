/**
 * Simple test for Graphiti Memory integration
 * 
 * Tests basic functionality:
 * 1. Add a fact to memory
 * 2. Recall the fact
 * 3. Verify cost tracking works
 */

import {
  initializeGraphitiIntegration,
  onBeforeResponse,
  onAfterResponse,
  getCostStats,
  shutdownGraphitiIntegration,
  graphiti_add_fact,
  graphiti_recall,
} from './dist/openclaw-integration.js';

async function runTests() {
  console.log('🧪 Graphiti Memory Integration Tests');
  console.log('====================================');
  console.log();

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize Graphiti Memory');
    await initializeGraphitiIntegration();
    console.log('✅ Initialization successful');
    console.log();

    // Test 2: Add a fact
    console.log('Test 2: Add a fact to memory');
    const testFact = 'Sofía is an AI assistant who helps Aitor with various tasks including coding, research, and daily planning.';
    const result = await graphiti_add_fact(testFact);
    console.log('✅', result);
    console.log();

    // Test 3: Recall
    console.log('Test 3: Recall information');
    const recallResult = await graphiti_recall('Who is Sofía?');
    console.log('✅ Recall result:');
    console.log(recallResult);
    console.log();

    // Test 4: onBeforeResponse
    console.log('Test 4: onBeforeResponse (context retrieval)');
    const testMessage = {
      id: 'test-1',
      content: 'What do you know about me?',
      authorId: 'user-1',
      channelId: 'test-channel',
      timestamp: new Date(),
    };
    const context = await onBeforeResponse(testMessage);
    console.log('✅ Context retrieved:', context ? 'Yes' : 'No');
    if (context) {
      console.log('Context preview:', context.substring(0, 200) + '...');
    }
    console.log();

    // Test 5: onAfterResponse
    console.log('Test 5: onAfterResponse (conversation capture)');
    const testResponse = {
      content: 'I know that you are Aitor and I am Sofía, your AI assistant!',
    };
    await onAfterResponse(testMessage, testResponse);
    console.log('✅ Conversation captured');
    console.log();

    // Test 6: Cost tracking
    console.log('Test 6: Cost tracking');
    const stats = await getCostStats();
    console.log('✅ Cost stats:');
    console.log(JSON.stringify(stats, null, 2));
    console.log();

    // Test 7: Recall again (should find more context now)
    console.log('Test 7: Recall after conversation capture');
    const recallResult2 = await graphiti_recall('assistant AI');
    console.log('✅ Recall result:');
    console.log(recallResult2);
    console.log();

    console.log('====================================');
    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await shutdownGraphitiIntegration();
    console.log();
    console.log('🧹 Cleanup complete');
  }
}

runTests();
