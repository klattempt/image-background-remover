import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "../../_shared/credentials";
import type { D1Database, D1Statement } from "../../_shared/types";
import { onRequestPost as register } from "./register";

describe("email authentication", () => {
  it("hashes passwords with a salt and verifies them", async () => {
    const first = await hashPassword("correct-horse");
    const second = await hashPassword("correct-horse");

    expect(first).not.toBe(second);
    await expect(verifyPassword("correct-horse", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", first)).resolves.toBe(false);
  });

  it("normalizes valid email addresses", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });

  it("creates an email user and a secure session", async () => {
    const queries: string[] = [];
    const db: D1Database = {
      prepare(query) {
        queries.push(query);
        const statement: D1Statement = {
          bind: () => statement,
          first: async <T>() => null as T | null,
          run: async () => ({}),
        };
        return statement;
      },
    };

    const response = await register({
      request: new Request("https://example.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://example.com" },
        body: JSON.stringify({ email: "person@example.com", password: "correct-horse" }),
      }),
      env: { APP_ORIGIN: "https://example.com", DB: db },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Set-Cookie")).toContain("__Host-cutline_session=");
    expect(queries.some((query) => query.includes("INSERT INTO users"))).toBe(true);
    expect(queries.some((query) => query.includes("INSERT INTO sessions"))).toBe(true);
  });
});
