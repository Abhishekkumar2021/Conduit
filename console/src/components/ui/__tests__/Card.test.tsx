import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card } from "@/components/ui/Card";

describe("Card UI Component", () => {
  it("renders the Card with children", () => {
    render(
      <Card>
        <h2 data-testid="card-title">Card Content</h2>
      </Card>,
    );
    expect(screen.getByTestId("card-title")).toBeInTheDocument();
  });

  it("applies default card styling", () => {
    render(<Card data-testid="test-card">Content</Card>);
    const card = screen.getByTestId("test-card");
    expect(card).toHaveClass("rounded-xl border border-border bg-card");
  });

  it("handles hover effects when hover is true", () => {
    render(
      <Card data-testid="hoverable-card" hover>
        Hoverable Content
      </Card>,
    );
    const card = screen.getByTestId("hoverable-card");
    expect(card).toHaveClass("hover:border-primary/50 hover:bg-muted/30");
  });

  it("supports padding override options", () => {
    // Both explicitly set to false
    render(
      <Card data-testid="no-padding" padding={false}>
        No Padding
      </Card>,
    );
    expect(screen.getByTestId("no-padding")).not.toHaveClass("p-4 md:p-5");
  });
});
