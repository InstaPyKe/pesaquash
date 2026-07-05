-- PESAQUASH PostgreSQL Tables Schema
-- Execute this script in DBeaver connected to the 'pesaquash' database.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    referrer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT FALSE,
    wallet_balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index user credentials for login efficiency
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Insert Default System Referrer Node
INSERT INTO users (id, username, email, phone, password, is_active)
VALUES (1, 'system_node', 'system@pesaquash.com', '0700000000', '$2a$10$T8Zg8j23456789abcdefghijO2F1N3vP5R2E7s8t9y1u2i3o4p5a6s7', true)
ON CONFLICT (id) DO NOTHING;

-- Restart user primary key serial sequence to start at 2
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 2), false);


-- 2. Activation Payments Table
CREATE TABLE IF NOT EXISTS activations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_code VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(15) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- e.g., 'M-Pesa', 'Airtel Money'
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Completed', 'Failed'
    transaction_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'tiktok', 'youtube', 'spin', 'quiz'
    title VARCHAR(255) NOT NULL,
    url_or_question TEXT,
    options TEXT, -- JSON string for options e.g. ["Nairobi", "Mombasa"]
    correct_answer VARCHAR(255),
    reward NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5. User Completed Tasks Table
CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reward_earned NUMERIC(10, 2) NOT NULL,
    completed_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_task_daily UNIQUE (user_id, task_id, completed_date)
);


-- 5b. Commissions Table
CREATE TABLE IF NOT EXISTS commissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downline_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL, -- 1, 2, or 3
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- 6. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert Default System Settings
INSERT INTO system_settings (key, value) VALUES
('maintenance_mode', 'false'),
('force_logout', 'false'),
('registration_blocked', 'false'),
('commission_l1', '50'), -- 50%
('commission_l2', '20'), -- 20%
('commission_l3', '10'), -- 10%
('min_withdrawal', '50'), -- KES 50.00
('daily_task_limit', '8')
ON CONFLICT (key) DO NOTHING;


-- Insert Sample Tasks for Verification
INSERT INTO tasks (type, title, url_or_question, reward) VALUES
('tiktok', 'Watch TikTok & Earn 15 KES', 'https://tiktok.com/@pesaquash/video/1', 15.00),
('youtube', 'Watch YouTube Video Tutorial', 'https://youtube.com/watch?v=pesaquash', 12.00)
ON CONFLICT DO NOTHING;

INSERT INTO tasks (type, title, url_or_question, options, correct_answer, reward) VALUES
('quiz', 'What is the capital city of Kenya?', 'Capital of Kenya', '["Nairobi", "Mombasa", "Kisumu", "Nakuru"]', 'Nairobi', 10.00)
ON CONFLICT DO NOTHING;
