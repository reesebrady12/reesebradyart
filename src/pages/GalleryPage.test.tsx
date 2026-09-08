// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GalleryPage } from "./GalleryPage";

describe("portfolio gallery filters", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("restores combined medium and year filters from the URL", async () => {
    window.history.replaceState({}, "", "/sold?medium=oil&year=2025");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [], years: [2025, 2024] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<GalleryPage category="sold" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = String(fetchMock.mock.calls[0][0]);
    expect(request).toContain("category=sold");
    expect(request).toContain("medium=oil");
    expect(request).toContain("year=2025");
    expect((screen.getByLabelText("Medium") as HTMLSelectElement).value).toBe(
      "oil",
    );
    expect((screen.getByLabelText("Time") as HTMLSelectElement).value).toBe(
      "2025",
    );
    expect(screen.getByText("No sold works match these filters.")).toBeTruthy();
  });
});
