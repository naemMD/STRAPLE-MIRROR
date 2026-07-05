-- Migration: create app_feedbacks table
-- Date: 2026-07-05
-- Reason: stores the in-app satisfaction survey shown to users after a few
-- usage days (rating, intuitive/useful answers, most-used area, free comment).
--
-- NOTE: the application also creates this table automatically on startup via
-- SQLAlchemy `Base.metadata.create_all` (it is a brand-new table, not an ALTER
-- on an existing one). This file exists for production parity / documentation
-- and can be applied manually if you prefer to provision the schema ahead of
-- the deploy.


-- =========================================================================
--  PostgreSQL  (Azure production)
-- =========================================================================
CREATE TABLE IF NOT EXISTS app_feedbacks (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    rating       INTEGER NOT NULL,          -- 1-5 stars
    is_intuitive BOOLEAN NULL,
    is_useful    BOOLEAN NULL,
    most_used    VARCHAR(30) NULL,
    comment      TEXT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =========================================================================
--  MySQL  (local docker-compose dev)
-- =========================================================================
-- CREATE TABLE IF NOT EXISTS app_feedbacks (
--     id           INT AUTO_INCREMENT PRIMARY KEY,
--     user_id      INT NOT NULL,
--     rating       INT NOT NULL,
--     is_intuitive BOOLEAN NULL,
--     is_useful    BOOLEAN NULL,
--     most_used    VARCHAR(30) NULL,
--     comment      TEXT NULL,
--     created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT fk_app_feedbacks_user FOREIGN KEY (user_id) REFERENCES users(id)
-- );
