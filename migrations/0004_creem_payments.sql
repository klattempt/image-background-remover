CREATE TABLE creem_orders (
  id TEXT PRIMARY KEY,
  checkout_id TEXT NOT NULL UNIQUE,
  creem_order_id TEXT UNIQUE,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('plus', 'pro')),
  product_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  customer_email TEXT,
  created_at TEXT NOT NULL,
  captured_at TEXT,
  valid_until TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX creem_orders_user_id_idx ON creem_orders(user_id);
CREATE INDEX creem_orders_status_idx ON creem_orders(status);

CREATE TRIGGER grant_creem_credits
AFTER UPDATE OF status ON creem_orders
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

CREATE TABLE creem_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT
);
