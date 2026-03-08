import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader UI Component", () => {
  it("renders title correctly", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<PageHeader title="Runs" description="View all pipeline runs" />);
    expect(screen.getByText("View all pipeline runs")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader
        title="Settings"
        actions={<button data-testid="action-btn">Save</button>}
      />,
    );
    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
  });

  it("renders preTitle when provided", () => {
    render(
      <PageHeader
        title="Detail"
        preTitle={
          <a href="/back" data-testid="back-link">
            Back
          </a>
        }
      />,
    );
    expect(screen.getByTestId("back-link")).toBeInTheDocument();
  });
});
