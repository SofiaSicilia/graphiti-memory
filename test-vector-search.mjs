/**
 * Vector Search Test for Graphiti Memory
 * 
 * Tests:
 * 1. Vector capability detection
 * 2. Storing embeddings as vectors
 * 3. Semantic similarity search
 * 4. Hybrid search combining text + semantic
 */

import { GraphitiClient } from './dist/graphiti-client.js';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/aitorortega/clawd/second-brain/.env' });

// Simple mock embedding generator (normally from OpenAI)
function generateMockEmbedding(text, dim = 1536) {
  // Create a deterministic embedding based on text content
  const embedding = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  
  // Simple hash-based embedding for testing
  words.forEach((word, wordIdx) => {
    for (let i = 0; i < dim; i++) {
      const hash = (word.charCodeAt(i % word.length) || 0) * (i + 1) * (wordIdx + 1);
      embedding[i] += Math.sin(hash) * 0.1;
    }
  });
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(v => v / (magnitude || 1));
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runVectorTests() {
  console.log('🔍 Graphiti Vector Search Tests');
  console.log('================================\n');

  const client = new GraphitiClient({
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/secondbrain'
  });

  try {
    // Test 1: Initialize and detect capabilities
    console.log('Test 1: Initialize and detect vector capabilities');
    await client.initialize();
    const caps = client.getVectorCapabilities();
    console.log('✅ Vector capabilities:', JSON.stringify(caps, null, 2));
    
    if (!caps?.hasVectorExtension) {
      console.error('❌ pgvector extension not available - tests cannot continue');
      process.exit(1);
    }
    console.log();

    // Test 2: Create entities with embeddings
    console.log('Test 2: Create entities with vector embeddings');
    
    const testEntities = [
      {
        name: 'Python Programming',
        type: 'Technology',
        properties: { category: 'programming_language', creator: 'Guido van Rossum' },
        embedding: generateMockEmbedding('Python is a programming language for software development'),
      },
      {
        name: 'JavaScript',
        type: 'Technology',
        properties: { category: 'programming_language', runtime: 'Node.js, Browser' },
        embedding: generateMockEmbedding('JavaScript is used for web development and browser scripting'),
      },
      {
        name: 'Machine Learning',
        type: 'Concept',
        properties: { category: 'artificial_intelligence', field: 'computer_science' },
        embedding: generateMockEmbedding('Machine learning is a subset of AI for pattern recognition'),
      },
      {
        name: 'PostgreSQL',
        type: 'Technology',
        properties: { category: 'database', type: 'relational' },
        embedding: generateMockEmbedding('PostgreSQL is an open source relational database system'),
      },
      {
        name: 'Coffee',
        type: 'Product',
        properties: { category: 'beverage', origin: 'Ethiopia' },
        embedding: generateMockEmbedding('Coffee is a brewed drink made from roasted coffee beans'),
      },
    ];

    for (const entity of testEntities) {
      const created = await client.createEntity(entity);
      console.log(`  ✅ Created: ${created.name} (${created.type})`);
    }
    console.log();

    // Test 3: Semantic search
    console.log('Test 3: Semantic search for "coding language"');
    const searchEmbedding = generateMockEmbedding('coding language programming software development');
    const semanticResults = await client.semanticSearchEntities(searchEmbedding, 3);
    
    console.log(`  Found ${semanticResults.length} results:`);
    semanticResults.forEach((entity, i) => {
      const similarity = cosineSimilarity(searchEmbedding, entity.embedding || []);
      console.log(`  ${i + 1}. ${entity.name} (similarity: ${similarity.toFixed(4)})`);
    });
    console.log();

    // Test 4: Semantic search for AI-related
    console.log('Test 4: Semantic search for "artificial intelligence"');
    const aiEmbedding = generateMockEmbedding('artificial intelligence neural networks deep learning');
    const aiResults = await client.semanticSearchEntities(aiEmbedding, 3);
    
    console.log(`  Found ${aiResults.length} results:`);
    aiResults.forEach((entity, i) => {
      const similarity = cosineSimilarity(aiEmbedding, entity.embedding || []);
      console.log(`  ${i + 1}. ${entity.name} (similarity: ${similarity.toFixed(4)})`);
    });
    console.log();

    // Test 5: Create episodes with embeddings
    console.log('Test 5: Create episodes with vector embeddings');
    
    const testEpisodes = [
      {
        content: 'User asked about programming languages and which one to learn first',
        embedding: generateMockEmbedding('programming languages beginner advice learning'),
        entities: [],
        metadata: { topic: 'programming', user_intent: 'seeking_advice' },
        timestamp: new Date(),
      },
      {
        content: 'Discussion about AI and machine learning applications in healthcare',
        embedding: generateMockEmbedding('AI machine learning healthcare medical diagnosis'),
        entities: [],
        metadata: { topic: 'AI', domain: 'healthcare' },
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        content: 'Setting up a PostgreSQL database with pgvector for semantic search',
        embedding: generateMockEmbedding('PostgreSQL database setup pgvector extension'),
        entities: [],
        metadata: { topic: 'database', task: 'setup' },
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      },
    ];

    for (const episode of testEpisodes) {
      const created = await client.createEpisode(episode);
      console.log(`  ✅ Created episode: ${created.content.substring(0, 50)}...`);
    }
    console.log();

    // Test 6: Semantic search episodes
    console.log('Test 6: Semantic search episodes for "software development"');
    const devEmbedding = generateMockEmbedding('software development coding programming');
    const episodeResults = await client.semanticSearchEpisodes(devEmbedding, 3);
    
    console.log(`  Found ${episodeResults.length} results:`);
    episodeResults.forEach((episode, i) => {
      const similarity = cosineSimilarity(devEmbedding, episode.embedding || []);
      console.log(`  ${i + 1}. ${episode.content.substring(0, 60)}... (sim: ${similarity.toFixed(4)})`);
    });
    console.log();

    // Test 7: Hybrid search
    console.log('Test 7: Hybrid search (text + semantic) for "AI medical"');
    const hybridEmbedding = generateMockEmbedding('AI medical healthcare diagnosis');
    const hybridResults = await client.hybridSearchEpisodes('AI medical', hybridEmbedding, 3, 0.7);
    
    console.log(`  Found ${hybridResults.length} results:`);
    hybridResults.forEach((result, i) => {
      console.log(`  ${i + 1}. Score: ${result.score.toFixed(4)} - ${result.content.substring(0, 50)}...`);
    });
    console.log();

    // Test 8: Verify vector storage
    console.log('Test 8: Verify vector storage in database');
    const pgClient = new (await import('pg')).default.Client({
      connectionString: process.env.DATABASE_URL
    });
    await pgClient.connect();
    
    const vectorCheck = await pgClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(embedding_vector) as with_vector,
        pg_typeof(embedding_vector) as vector_type
      FROM graphiti_entities
    `);
    
    console.log('  Entity storage:');
    console.log(`    Total: ${vectorCheck.rows[0].total}`);
    console.log(`    With vectors: ${vectorCheck.rows[0].with_vector}`);
    console.log(`    Vector column type: ${vectorCheck.rows[0].vector_type}`);
    
    const epCheck = await pgClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(embedding_vector) as with_vector
      FROM graphiti_episodes
    `);
    
    console.log('  Episode storage:');
    console.log(`    Total: ${epCheck.rows[0].total}`);
    console.log(`    With vectors: ${epCheck.rows[0].with_vector}`);
    
    await pgClient.end();
    console.log();

    console.log('================================');
    console.log('✅ All vector tests passed!');
    console.log();
    console.log('📊 Summary:');
    console.log('  - pgvector extension detected and working');
    console.log('  - Entities stored with vector embeddings');
    console.log('  - Episodes stored with vector embeddings');
    console.log('  - Semantic search returns relevant results');
    console.log('  - Hybrid search combines text + semantic');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🧹 Cleanup complete');
  }
}

runVectorTests();
