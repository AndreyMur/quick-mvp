/**
 * Offline Supabase test doubles.
 *
 * These fakes let tests exercise code that depends on `lib/supabase/*` without
 * touching the network or requiring Supabase environment variables.
 *
 * Usage inside a node:test file:
 *
 *   import { test, mock } from "node:test";
 *   import { createMockSupabaseClient } from "./mocks/supabase.ts";
 *
 *   test("...", async () => {
 *     mock.module("../lib/supabase/server.ts", {
 *       namedExports: {
 *         createClient: async () =>
 *           createMockSupabaseClient({
 *             user: { id: "u1" },
 *             responses: { projects: { data: [{ id: "p1" }], error: null } },
 *           }),
 *       },
 *     });
 *     const { createClient } = await import("../lib/supabase/server.ts");
 *     // ...
 *   });
 *
 * Module mocking requires the `--experimental-test-module-mocks` flag, which is
 * part of the `npm test` script in package.json.
 */

export interface MockDbError {
  message: string;
  code?: string;
}

export interface MockDbResponse<T = unknown> {
  data: T | null;
  error: MockDbError | null;
  count?: number | null;
}

export interface MockQueryCall {
  table: string;
  method: string;
  args: unknown[];
}

export interface MockQueryLog {
  table: string;
  calls: MockQueryCall[];
}

export type MockResponseResolver =
  | MockDbResponse
  | ((log: MockQueryLog) => MockDbResponse);

export interface MockUser {
  id: string;
  email?: string;
}

export interface MockSupabaseOptions {
  /** Current authenticated user returned by `auth.getUser()`. */
  user?: MockUser | null;
  /** Error returned by `auth.getUser()` (e.g. to simulate 401). */
  authError?: MockDbError | null;
  /** Per-table canned responses; a function receives the recorded query log. */
  responses?: Record<string, MockResponseResolver>;
  /** Response used for tables without an explicit entry. */
  defaultResponse?: MockDbResponse;
  /** Implementation of `auth.admin.deleteUser`. */
  deleteUser?: (id: string) => Promise<MockDbResponse>;
}

export interface MockQueryBuilder extends PromiseLike<MockDbResponse> {
  select: (...args: unknown[]) => MockQueryBuilder;
  insert: (...args: unknown[]) => MockQueryBuilder;
  update: (...args: unknown[]) => MockQueryBuilder;
  delete: (...args: unknown[]) => MockQueryBuilder;
  upsert: (...args: unknown[]) => MockQueryBuilder;
  eq: (...args: unknown[]) => MockQueryBuilder;
  neq: (...args: unknown[]) => MockQueryBuilder;
  or: (...args: unknown[]) => MockQueryBuilder;
  in: (...args: unknown[]) => MockQueryBuilder;
  order: (...args: unknown[]) => MockQueryBuilder;
  limit: (...args: unknown[]) => MockQueryBuilder;
  range: (...args: unknown[]) => MockQueryBuilder;
  single: () => Promise<MockDbResponse>;
  maybeSingle: () => Promise<MockDbResponse>;
}

export interface MockSupabaseClient {
  auth: {
    getUser: () => Promise<{
      data: { user: MockUser | null };
      error: MockDbError | null;
    }>;
    admin: {
      deleteUser: (id: string) => Promise<MockDbResponse>;
    };
  };
  from: (table: string) => MockQueryBuilder;
  /** Recorded queries, useful for asserting access control behavior. */
  queries: MockQueryLog[];
}

const DEFAULT_RESPONSE: MockDbResponse = { data: [], error: null };

/**
 * Creates a deterministic, chainable fake of the Supabase client used by
 * `lib/supabase/*`. It never performs I/O.
 */
export function createMockSupabaseClient(
  options: MockSupabaseOptions = {}
): MockSupabaseClient {
  const queries: MockQueryLog[] = [];

  const resolveResponse = (log: MockQueryLog): MockDbResponse => {
    const configured = options.responses?.[log.table];
    if (typeof configured === "function") return configured(log);
    if (configured) return configured;
    return options.defaultResponse ?? DEFAULT_RESPONSE;
  };

  const from = (table: string): MockQueryBuilder => {
    const log: MockQueryLog = { table, calls: [] };
    queries.push(log);

    const builder = {} as MockQueryBuilder;

    const chain =
      (method: string) =>
      (...args: unknown[]): MockQueryBuilder => {
        log.calls.push({ table, method, args });
        return builder;
      };

    builder.select = chain("select");
    builder.insert = chain("insert");
    builder.update = chain("update");
    builder.delete = chain("delete");
    builder.upsert = chain("upsert");
    builder.eq = chain("eq");
    builder.neq = chain("neq");
    builder.or = chain("or");
    builder.in = chain("in");
    builder.order = chain("order");
    builder.limit = chain("limit");
    builder.range = chain("range");

    const terminal = (method: string) => {
      log.calls.push({ table, method, args: [] });
      return Promise.resolve(resolveResponse(log));
    };

    builder.single = () => terminal("single");
    builder.maybeSingle = () => terminal("maybeSingle");

    builder.then = <TResult1 = MockDbResponse, TResult2 = never>(
      onfulfilled?:
        | ((value: MockDbResponse) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> =>
      Promise.resolve(resolveResponse(log)).then(onfulfilled, onrejected);

    return builder;
  };

  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
      admin: {
        deleteUser:
          options.deleteUser ?? (async () => ({ data: null, error: null })),
      },
    },
    from,
    queries,
  };
}
