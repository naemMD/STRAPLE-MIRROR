-- Migration: add shared_meal_id / shared_workout_id columns to forum_messages
-- Date: 2026-05-28
-- Reason: enables sportifs to attach a meal or workout (current week) to forum messages
--
-- IMPORTANT: run this against the production database BEFORE the new application
-- code is deployed (or immediately after, before any user hits the forum). The
-- new code expects these columns to exist; otherwise GET /forums/{id} and
-- POST /forums/{id}/messages will 500.
--
-- Both columns are nullable: existing rows remain valid (NULL on both sides).
-- ON DELETE SET NULL keeps messages alive if the referenced meal/workout is
-- later deleted by its owner.


-- =========================================================================
--  PostgreSQL  (Azure production)
-- =========================================================================
ALTER TABLE forum_messages
    ADD COLUMN IF NOT EXISTS shared_meal_id    INTEGER NULL REFERENCES meals(id)    ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS shared_workout_id INTEGER NULL REFERENCES workouts(id) ON DELETE SET NULL;


-- =========================================================================
--  MySQL  (local docker-compose dev)
-- =========================================================================
-- MySQL does not support IF NOT EXISTS on ADD COLUMN before 8.0.29.
-- Skip this block if you're running PostgreSQL.
--
-- ALTER TABLE forum_messages
--     ADD COLUMN shared_meal_id    INT NULL,
--     ADD COLUMN shared_workout_id INT NULL,
--     ADD CONSTRAINT fk_forum_messages_shared_meal
--         FOREIGN KEY (shared_meal_id)    REFERENCES meals(id)    ON DELETE SET NULL,
--     ADD CONSTRAINT fk_forum_messages_shared_workout
--         FOREIGN KEY (shared_workout_id) REFERENCES workouts(id) ON DELETE SET NULL;
