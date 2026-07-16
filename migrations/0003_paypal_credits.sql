CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  credits_remaining INTEGER NOT NULL DEFAULT 3,
  credits_total INTEGER NOT NULL DEFAULT 3,
  valid_until TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_credits (user_id, plan, credits_remaining, credits_total, valid_until, updated_at)
SELECT id, 'free', 3, 3, NULL, updated_at FROM users;

CREATE TRIGGER initialize_user_credits
AFTER INSERT ON users
BEGIN
  INSERT INTO user_credits (user_id, plan, credits_remaining, credits_total, valid_until, updated_at)
  VALUES (NEW.id, 'free', 3, 3, NULL, NEW.created_at);
END;

CREATE TABLE paypal_orders (
  id TEXT PRIMARY KEY,
  paypal_order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('plus', 'pro')),
  amount TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  payer_email TEXT,
  created_at TEXT NOT NULL,
  captured_at TEXT,
  valid_until TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX paypal_orders_user_id_idx ON paypal_orders(user_id);
CREATE INDEX paypal_orders_status_idx ON paypal_orders(status);

CREATE TRIGGER grant_paypal_credits
AFTER UPDATE OF status ON paypal_orders
WHEN NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED'
BEGIN
  INSERT INTO user_credits (user_id, plan, credits_remaining, credits_total, valid_until, updated_at)
  VALUES (NEW.user_id, NEW.plan, NEW.credits, NEW.credits, NEW.valid_until, NEW.captured_at)
  ON CONFLICT(user_id) DO UPDATE SET
    plan = excluded.plan,
    credits_remaining = excluded.credits_remaining,
    credits_total = excluded.credits_total,
    valid_until = excluded.valid_until,
    updated_at = excluded.updated_at;
END;

CREATE TABLE paypal_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
