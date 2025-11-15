-- Users table: with device, memory, subscription status, and tracking
CREATE TABLE users (
    external_id VARCHAR(255) PRIMARY KEY,         -- Unique user ID from auth server
    device_id   VARCHAR(255) NOT NULL,            -- Bound device ID (one per user)
    email       VARCHAR(255) UNIQUE NOT NULL,              -- User's email address
    memory_data JSON,                             -- AI memory per user (chat, context, etc.)
    status      VARCHAR(50) NOT NULL DEFAULT 'active', -- "active", "expired", "paused"
    last_seen   DATETIME,                         -- Last activity timestamp
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Subscriptions table: now without status
CREATE TABLE subscriptions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,            -- References users.external_id
    plan        VARCHAR(50) NOT NULL,             -- e.g., "free", "pro"
    expires_at  DATETIME,                         -- Subscription end time
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (external_id) REFERENCES users(external_id) ON DELETE CASCADE
);
CREATE TABLE app_config (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    type  VARCHAR(100) NOT NULL,   -- Key or setting name (e.g., "max_tokens", "support_email")
    value TEXT NOT NULL            -- Value (string, number, JSON, etc.)
);

CREATE TABLE subscription_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,  -- Unique redemption code
    plan VARCHAR(50) NOT NULL,         -- e.g., "free", "pro", "premium"
    duration INT NOT NULL,             -- Duration in days
    redeem_limit INT NOT NULL,         -- How many times code can be redeemed
    redeemed_count INT DEFAULT 0,      -- How many times code has been redeemed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME               -- When code expires (optional)
);

CREATE TABLE code_redemptions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(32) NOT NULL,             -- References subscription_codes.code
    external_id VARCHAR(255) NOT NULL,            -- References users.external_id
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (external_id) REFERENCES users(external_id) ON DELETE CASCADE,
    FOREIGN KEY (code) REFERENCES subscription_codes(code) ON DELETE CASCADE,
    UNIQUE KEY redemption_unique (code, external_id)       -- Prevent multiple redemptions
);
