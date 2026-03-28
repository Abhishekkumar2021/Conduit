import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-6">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          The page you're looking for doesn't exist or has been moved. Check the
          URL or navigate back to the dashboard.
        </p>
        <Link to="/dashboard">
          <Button variant="primary" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
