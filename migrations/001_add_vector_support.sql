-- Migration: Convert JSONB embeddings to vector type
-- Run this after pgvector is installed

-- Check if pgvector is available
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension is not installed. Please install it first.';
    END IF;
END $$;

-- Migrate graphiti_entities table
-- First add a new column with vector type
ALTER TABLE graphiti_entities ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(1536);

-- Convert existing JSONB embeddings to vector (if any exist)
UPDATE graphiti_entities 
SET embedding_vector = (
    SELECT ARRAY_AGG(x::float) 
    FROM jsonb_array_elements_text(embedding) AS x
)::vector
WHERE embedding IS NOT NULL 
AND embedding != 'null'::jsonb
AND embedding_vector IS NULL;

-- Drop the old JSONB column and rename the vector column
-- Note: We'll keep both during transition period, then drop JSONB after confirming everything works
-- ALTER TABLE graphiti_entities DROP COLUMN embedding;
-- ALTER TABLE graphiti_entities RENAME COLUMN embedding_vector TO embedding;

-- Migrate graphiti_episodes table
ALTER TABLE graphiti_episodes ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(1536);

-- Convert existing JSONB embeddings to vector (if any exist)
UPDATE graphiti_episodes 
SET embedding_vector = (
    SELECT ARRAY_AGG(x::float) 
    FROM jsonb_array_elements_text(embedding) AS x
)::vector
WHERE embedding IS NOT NULL 
AND embedding != 'null'::jsonb
AND embedding_vector IS NULL;

-- Create vector indexes for efficient similarity search
-- Using ivfflat with cosine distance (good for text embeddings)
CREATE INDEX IF NOT EXISTS idx_entities_embedding_cosine 
ON graphiti_entities 
USING ivfflat (embedding_vector vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_episodes_embedding_cosine 
ON graphiti_episodes 
USING ivfflat (embedding_vector vector_cosine_ops) 
WITH (lists = 100);

-- Alternative: hnsw index for better recall at cost of build time
-- CREATE INDEX IF NOT EXISTS idx_entities_embedding_hnsw 
-- ON graphiti_entities 
-- USING hnsw (embedding_vector vector_cosine_ops);

-- Verify the migration
SELECT 
    'graphiti_entities' as table_name,
    COUNT(*) as total_rows,
    COUNT(embedding_vector) as rows_with_vector
FROM graphiti_entities
UNION ALL
SELECT 
    'graphiti_episodes' as table_name,
    COUNT(*) as total_rows,
    COUNT(embedding_vector) as rows_with_vector
FROM graphiti_episodes;
