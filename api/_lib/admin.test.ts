import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1", email: "owner@example.com" } as null | {
    id: string;
    email: string;
  },
  admin: null as null | { id: string; email: string; role: string },
}));

vi.mock("./supabase", () => ({
  getSupabaseAdmin: () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error("invalid"),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: state.admin }) }),
        }),
      }),
    }),
  }),
}));

import { requireAdmin } from "./admin";

describe("admin authorization", () => {
  beforeEach(() => {
    state.user = { id: "user-1", email: "owner@example.com" };
    state.admin = null;
    delete process.env.ADMIN_EMAIL;
  });

  it("rejects requests without a bearer session", async () => {
    await expect(requireAdmin({ headers: {} } as never)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects an authenticated non-admin", async () => {
    await expect(
      requireAdmin({
        headers: { authorization: "Bearer user-token" },
      } as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("accepts only a user with an explicit admin row", async () => {
    state.admin = {
      id: "user-1",
      email: "owner@example.com",
      role: "admin",
    };
    await expect(
      requireAdmin({
        headers: { authorization: "Bearer admin-token" },
      } as never),
    ).resolves.toMatchObject({ admin: { role: "admin" } });
  });
});
