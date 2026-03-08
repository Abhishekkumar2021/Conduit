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
    <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-6 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:py-6 flex flex-col gap-3">
      {preTitle && <div>{preTitle}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
