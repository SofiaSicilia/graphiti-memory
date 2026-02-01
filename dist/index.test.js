/**
 * Test suite for Graphiti Memory
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { GraphitiMemory } from './index.js';
import { config } from './config.js';
describe('Graphiti Memory', () => {
    let memory;
    before(async () => {
        memory = new GraphitiMemory({
            databaseUrl: config.databaseUrl,
            openAiApiKey: config.openAiApiKey,
            maxContextResults: 5,
        });
        await memory.initialize();
    });
    after(async () => {
        await memory.close();
    });
    it('should add a fact', async () => {
        await memory.addFact('Aitor is a software developer who loves TypeScript');
        // Should not throw
        assert.ok(true);
    });
    it('should recall information', async () => {
        await memory.addFact('OpenClaw is an AI agent framework');
        const results = await memory.recall('What is OpenClaw?');
        assert.ok(Array.isArray(results.entities));
        assert.ok(Array.isArray(results.relationships));
        assert.ok(Array.isArray(results.episodes));
    });
    it('should process a conversation', async () => {
        await memory.processConversation('What can you help me with?', 'I can help you with coding, writing, analysis, and many other tasks.');
        assert.ok(true);
    });
    it('should get context for a message', async () => {
        const context = await memory.getContextForMessage('Tell me about coding');
        assert.ok(typeof context === 'string');
    });
});
//# sourceMappingURL=index.test.js.map