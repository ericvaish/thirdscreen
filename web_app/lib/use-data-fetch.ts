import { useCallback, useEffect, useState, type DependencyList, type Dispatch, type SetStateAction } from "react"

/**
 * Eliminates the repeated useCallback + useEffect + try/catch data-fetching boilerplate
 * used across all zone components.
 *
 * @param fetcher  Async function that returns data. Can contain transforms or multi-step logic.
 * @param deps     Dependency array — refetches automatically when these change.
 * @param options  { skip?: boolean } — suppresses fetch when true (e.g. waiting for a date to initialize).
 * @returns        { data, setData, refetch }
 *                 - data: the latest fetched value (undefined until first successful fetch)
 *                 - setData: for optimistic updates (same API as useState setter)
 *                 - refetch: manually re-run the fetcher (e.g. after a mutation)
 */
export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: { skip?: boolean }
): { data: T | undefined; setData: Dispatch<SetStateAction<T | undefined>>; refetch: () => Promise<void> } {
  const [data, setData] = useState<T>()
  const skip = options?.skip ?? false

  const refetch = useCallback(async () => {
    if (skip) return
    try {
      setData(await fetcher())
    } catch {
      // Silently fail — data stays at previous value.
      // Zone components handle user-facing errors in their action handlers, not on initial load.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, setData, refetch }
}
