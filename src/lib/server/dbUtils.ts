/**
 * SQLite rejects statements with more than `SQLITE_MAX_VARIABLE_NUMBER` bound
 * parameters (999 on SQLite < 3.32; this project's bundled better-sqlite3
 * defaults to 32766, but that's a compile-time setting we shouldn't assume
 * holds for every deployment/driver version). Bulk endpoints build
 * `inArray(...)` filters from user-supplied selections that can plausibly
 * reach into the thousands (e.g. "select all" over a large image library),
 * so a single unchunked query isn't safe to assume will fit. Splits `values`
 * into batches no larger than `size` so callers can run one query per chunk
 * and merge the results.
 */
export function chunk<T>(values: T[], size = 900): T[][] {
    if (values.length <= size) return [values];
    const chunks: T[][] = [];
    for (let i = 0; i < values.length; i += size) {
        chunks.push(values.slice(i, i + size));
    }
    return chunks;
}

/**
 * Runs `query` once per chunk of `values` (see `chunk`) and flattens the
 * results — for `inArray(...)`-based lookups where the input list may be
 * larger than SQLite's per-statement bound-parameter limit.
 */
export function queryChunked<T, R>(values: T[], query: (chunkValues: T[]) => R[]): R[] {
    if (values.length === 0) return [];
    return chunk(values).flatMap(query);
}
