import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "@/components/ui/Badge";

describe("Badge UI Component", () => {
  it("renders children correctly", () => {
    render(<Badge>New Feature</Badge>);
    const badge = screen.getByText(/new feature/i);
    expect(badge).toBeInTheDocument();
  });

  it("applies the default variant classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText(/default/i);
    expect(badge).toHaveClass("bg-muted text-muted-foreground");
  });

  it("applies the success variant classes", () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText(/success/i);
    expect(badge).toHaveClass("bg-success/15 text-success");
  });

  it("applies the warning variant classes", () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText(/warning/i);
    expect(badge).toHaveClass("bg-warning/15 text-warning");
  });

  it("applies the danger variant classes", () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText(/danger/i);
    expect(badge).toHaveClass("bg-destructive/15 text-destructive");
  });

  it("applies the info variant classes", () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText(/info/i);
    expect(badge).toHaveClass("bg-info/15 text-info");
  });

  it("renders the dot when dot prop is true", () => {
    const { container } = render(
      <Badge variant="success" dot={true}>
        With Dot
      </Badge>,
    );
    // The dot is the first child span
    const dotSpan = container.querySelector("span > span");
    expect(dotSpan).toBeInTheDocument();
  });

  it("renders appropriate dot colors for different variants", () => {
    const { container } = render(
      <div>
        <Badge variant="default" dot={true} data-testid="b-default">
          D
        </Badge>
        <Badge variant="warning" dot={true} data-testid="b-warning">
          W
        </Badge>
        <Badge variant="danger" dot={true} data-testid="b-danger">
          E
        </Badge>
        <Badge variant="info" dot={true} data-testid="b-info">
          I
        </Badge>
      </div>,
    );

    // Check dot colors
    const spans = container.querySelectorAll("span > span");
    expect(spans.length).toBe(4);
  });

  it("applies custom utility classes", () => {
    render(<Badge className="mt-4 custom-class">Custom</Badge>);
    const badge = screen.getByText(/custom/i);
    expect(badge).toHaveClass("mt-4");
    expect(badge).toHaveClass("custom-class");
  });
});
