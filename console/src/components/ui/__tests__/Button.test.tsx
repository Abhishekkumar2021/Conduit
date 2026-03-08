import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button UI Component", () => {
  it("renders with default properties", () => {
    render(<Button>Click Me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });

    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("bg-primary text-primary-foreground");
    expect(btn).toHaveClass("px-3.5 py-2 text-[13px]");
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Action</Button>);

    await userEvent.click(screen.getByRole("button", { name: /action/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as disabled and prevents clicks", async () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Disabled
      </Button>,
    );

    const btn = screen.getByRole("button", { name: /disabled/i });
    expect(btn).toBeDisabled();

    await userEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders different variants correctly", () => {
    const { rerender } = render(<Button variant="danger">Test</Button>);
    let btn = screen.getByRole("button", { name: /test/i });
    expect(btn).toHaveClass(
      "bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground",
    );

    rerender(<Button variant="secondary">Test</Button>);
    btn = screen.getByRole("button", { name: /test/i });
    expect(btn).toHaveClass(
      "bg-card text-foreground border border-border hover:bg-accent",
    );

    rerender(<Button variant="ghost">Test</Button>);
    btn = screen.getByRole("button", { name: /test/i });
    expect(btn).toHaveClass(
      "text-muted-foreground hover:bg-accent hover:text-foreground",
    );
  });

  it("renders different sizes correctly", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let btn = screen.getByRole("button", { name: /small/i });
    expect(btn).toHaveClass("px-2.5 py-1.5 text-[12px]");

    rerender(<Button size="md">Medium</Button>);
    btn = screen.getByRole("button", { name: /medium/i });
    expect(btn).toHaveClass("px-3.5 py-2 text-[13px]");
  });
});
