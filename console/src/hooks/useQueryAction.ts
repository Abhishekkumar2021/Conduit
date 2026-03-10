import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useQueryParams — read/write multiple search params from the URL.
 *
 * Usage:
 *   const { params, setParams, clearParams } = useQueryParams();
 *
 *   // setParams({ action: 'edit', id: '123' })
 *   // clearParams(['action', 'id'])
 */
export function useQueryAction() {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParams = useCallback(
    (newParams: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(newParams).forEach(([key, value]) => {
            if (value === null) {
              next.delete(key);
            } else {
              next.set(key, value);
            }
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const getParam = useCallback(
    (key: string) => searchParams.get(key),
    [searchParams],
  );

  const clearParams = useCallback(
    (keys: string[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          keys.forEach((key) => next.delete(key));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    action: searchParams.get("action"),
    getParam,
    setParams,
    clearParams,
  } as const;
}
