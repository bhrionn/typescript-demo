-- Migration: Create users table
-- Requirements: 10.1, 10.2

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'microsoft')),
    provider_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP,
    CONSTRAINT unique_provider_user UNIQUE (provider, provider_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores user authentication information from federated identity providers';
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'User email address from identity provider';
COMMENT ON COLUMN users.provider IS 'Identity provider (google or microsoft)';
COMMENT ON COLUMN users.provider_id IS 'Unique identifier from the identity provider';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user was first created';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the user last login';
