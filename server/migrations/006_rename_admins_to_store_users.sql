-- Renames admins table to store_users to distinguish store staff/admin users
-- from customer accounts (which live in the `users` table).
ALTER TABLE admins RENAME TO store_users;
ALTER INDEX idx_admins_role_id RENAME TO idx_store_users_role_id;
