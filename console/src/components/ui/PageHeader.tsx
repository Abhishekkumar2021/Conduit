import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  preTitle,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  preTitle?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {preTitle && <div className="mb-3">{preTitle}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
