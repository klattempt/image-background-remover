ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE UNIQUE INDEX users_email_lower_idx ON users(lower(email));
