#!/usr/bin/env node
/**
 * Graphiti Memory Initialization Script
 * 
 * One-time setup script that creates the database tables required
 * for Graphiti Memory to function.
 * 
 * Run this BEFORE enabling the OpenClaw integration.
 * 
 * Usage:
 *   node init-graphiti.js
 *   
 * Or with custom database URL:
 *   DATABASE_URL=postgresql://user@host:5432/db node init-graphiti.js
 */

import pkg from 'pg';
const { Client } = pkg;

// Configuration
const DB_URL = process.env.GRAPHITI_DB_URL || 
               process.env.DATABASE_URL || 
               'postgresql://aitorortega@localhost:5432/secondbrain';

const TABLE_PREFIX = process.env.GRAPHITI_TABLE_PREFIX || 'graphiti_';

async function initializeGraphiti() {
  console.log('🔧 Graphiti Memory Initialization');
  console.log('=================================');
  console.log();
  console.log(`Database: ${DB_URL.replace(/:\/\/[^:]+@/, '://***@')}`);
  console.log(`Table prefix: ${TABLE_PREFIX}`);
  console.log();

  const client = new Client({
    connectionString: DB_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    console.log();

    // Check pgvector extension
    console.log('📦 Checking pgvector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ pgvector extension enabled');
    } catch (error) {
      console.log('⚠️  pgvector not available, will use JSONB for embeddings');
      console.log('   (Consider installing pgvector for better semantic search)');
    }
    console.log();

    // Create tables
    console.log('📊 Creating tables...');
    console.log();

    // Check if tables already exist
    const checkTable = async (tableName) => {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [tableName]
      );
      return result.rows[0].exists;
    };

    // Entities table
    const entitiesTable = `${TABLE_PREFIX}entities`;
    if (await checkTable(entitiesTable)) {
      console.log(`  ⚠️  Table '${entitiesTable}' already exists, skipping`);
    } else {
      await client.query(`
        CREATE TABLE ${entitiesTable} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          properties JSONB DEFAULT '{}',
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log(`  ✅ Created table: ${entitiesTable}`);
    }

    // Relationships table
    const relationshipsTable = `${TABLE_PREFIX}relationships`;
    if (await checkTable(relationshipsTable)) {
      console.log(`  ⚠️  Table '${relationshipsTable}' already exists, skipping`);
    } else {
      await client.query(`
        CREATE TABLE ${relationshipsTable} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID REFERENCES ${entitiesTable}(id) ON DELETE CASCADE,
          target_id UUID REFERENCES ${entitiesTable}(id) ON DELETE CASCADE,
          source_name TEXT NOT NULL,
          target_name TEXT NOT NULL,
          type TEXT NOT NULL,
          properties JSONB DEFAULT '{}',
          valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          valid_until TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log(`  ✅ Created table: ${relationshipsTable}`);
    }

    // Episodes table
    const episodesTable = `${TABLE_PREFIX}episodes`;
    if (await checkTable(episodesTable)) {
      console.log(`  ⚠️  Table '${episodesTable}' already exists, skipping`);
    } else {
      await client.query(`
        CREATE TABLE ${episodesTable} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          embedding VECTOR(1536),
          entities UUID[] DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log(`  ✅ Created table: ${episodesTable}`);
    }
    console.log();

    // Create indexes
    console.log('🔍 Creating indexes...');
    console.log();

    const indexes = [
      { name: `idx_${TABLE_PREFIX}entities_name`, table: entitiesTable, col: 'name' },
      { name: `idx_${TABLE_PREFIX}entities_type`, table: entitiesTable, col: 'type' },
      { name: `idx_${TABLE_PREFIX}relationships_source`, table: relationshipsTable, col: 'source_id' },
      { name: `idx_${TABLE_PREFIX}relationships_target`, table: relationshipsTable, col: 'target_id' },
      { name: `idx_${TABLE_PREFIX}relationships_type`, table: relationshipsTable, col: 'type' },
      { name: `idx_${TABLE_PREFIX}episodes_timestamp`, table: episodesTable, col: 'timestamp' },
    ];

    for (const idx of indexes) {
      try {
        await client.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.col})`);
        console.log(`  ✅ Index: ${idx.name}`);
      } catch (error) {
        console.log(`  ⚠️  Index ${idx.name}: ${error.message}`);
      }
    }

    // GIN indexes for JSONB
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}entities_properties ON ${entitiesTable} USING GIN(properties)`);
      console.log(`  ✅ GIN index: idx_${TABLE_PREFIX}entities_properties`);
    } catch (error) {
      console.log(`  ⚠️  GIN index entities: ${error.message}`);
    }

    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}episodes_metadata ON ${episodesTable} USING GIN(metadata)`);
      console.log(`  ✅ GIN index: idx_${TABLE_PREFIX}episodes_metadata`);
    } catch (error) {
      console.log(`  ⚠️  GIN index episodes: ${error.message}`);
    }

    console.log();
    console.log('=================================');
    console.log('✅ Graphiti Memory initialized successfully!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Set OPENAI_API_KEY in your environment');
    console.log('  2. Enable the integration in OpenClaw (see agent-config.patch)');
    console.log('  3. Restart your OpenClaw agent');
    console.log();
    console.log('Tables created:');
    console.log(`  - ${entitiesTable}`);
    console.log(`  - ${relationshipsTable}`);
    console.log(`  - ${episodesTable}`);

  } catch (error) {
    console.error();
    console.error('❌ Initialization failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run initialization
initializeGraphiti();
