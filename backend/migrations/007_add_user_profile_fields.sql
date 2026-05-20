ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name          VARCHAR(100),
    ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
