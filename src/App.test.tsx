// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});

describe("application", () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("renders the shop route into the page", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Paintings for quiet spaces." }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Available work" }),
    ).toBeTruthy();
  });

  it("redirects an unauthenticated admin visitor to login", async () => {
    window.history.replaceState({}, "", "/admin");
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/admin/login"));
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeTruthy();
  });

  it("protects the direct new-painting route instead of showing the shop", async () => {
    window.history.replaceState({}, "", "/admin/paintings/new");
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe("/admin/login"));
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Available work" }),
    ).toBeNull();
  });

  it("keeps password recovery screens publicly accessible", () => {
    window.history.replaceState({}, "", "/admin/forgot-password");
    const { unmount } = render(<App />);
    expect(
      screen.getByRole("heading", { name: "Reset password" }),
    ).toBeTruthy();
    unmount();

    window.history.replaceState({}, "", "/admin/reset-password");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeTruthy();
  });
});
