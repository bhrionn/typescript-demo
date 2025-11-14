-- Migration: Create files table
-- Requirements: 2.5, 10.1, 10.2

-- Create files table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL UNIQUE,
    s3_bucket VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata JSONB,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_files_s3_key ON files(s3_key);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);

-- Create index on metadata JSONB column for faster queries
CREATE INDEX IF NOT EXISTS idx_files_metadata ON files USING GIN (metadata);

-- Add comments for documentation
COMMENT ON TABLE files IS 'Stores metadata for files uploaded to S3';
COMMENT ON COLUMN files.id IS 'Unique identifier for the file record';
COMMENT ON COLUMN files.user_id IS 'Foreign key to the user who uploaded the file';
COMMENT ON COLUMN files.file_name IS 'Original filename provided by the user';
COMMENT ON COLUMN files.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN files.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN files.s3_key IS 'Unique S3 object key where the file is stored';
COMMENT ON COLUMN files.s3_bucket IS 'S3 bucket name where the file is stored';
COMMENT ON COLUMN files.uploaded_at IS 'Timestamp when the file was uploaded';
COMMENT ON COLUMN files.metadata IS 'Additional metadata stored as JSON';
