-- Renames users table to customer_users so the naming matches store_users
-- (from 006). Both admin panel staff and storefront customers now have
-- table names that explicitly say what kind of user they are.
ALTER TABLE users RENAME TO customer_users;
