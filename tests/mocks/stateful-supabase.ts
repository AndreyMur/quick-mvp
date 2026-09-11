/**
 * Stateful in-memory Supabase test double (phase 24, #71/#72/#73).
 *
 * Unlike `./supabase.ts`, which returns canned responses per table, this fake
 * keeps state across queries. That lets the end-to-end monetization test drive
 * checkout → webhook → limits/watermark through the real route handlers while
 * staying completely offline.
 *
 * It implements only the query surface used by the monetization flow:
 *   - subscriptions: select by user_id/provider, upsert on user_id
 *   - profiles: select subscription_tier, update subscription_tier
 *   - projects: head count by user_id, insert
 *   - payment_events: insert with (provider, event_id) uniqueness, delete
 */

export type Row = Record<string, unknown>;

export interface StatefulStore {
  /** Keyed by `user_id`. */
  subscriptions: Map<string, Row>;
  /** Keyed by profile `id`. */
  profiles: Map<string, Row>;
  projects: Row[];
  /** `${provider}:${eventId}` — enforces webhook idempotency. */
  paymentEvents: Set<string>;
}

export interface StatefulStoreSeed {
  subscriptions?: Row[];
  profiles?: Row[];
  projects?: Row[];
}

export function createStatefulStore(seed: StatefulStoreSeed = {}): StatefulStore {
  return {
    subscriptions: new Map(
      (seed.subscriptions ?? []).map((row) => [String(row.user_id), { ...row }])
    ),
    profiles: new Map(
      (seed.profiles ?? []).map((row) => [String(row.id), { ...row }])
    ),
    projects: (seed.projects ?? []).map((row) => ({ ...row })),
    paymentEvents: new Set(),
  };
}

export interface MockDbError {
  message: string;
  code?: string;
}

export interface MockDbResponse<T = unknown> {
  data: T | null;
  error: MockDbError | null;
  count?: number | null;
}

interface Filter {
  method: string;
  args: unknown[];
}

export interface StatefulUser {
  id: string;
  email?: string;
}

export interface StatefulQueryBuilder extends PromiseLike<MockDbResponse> {
  select: (...args: unknown[]) => StatefulQueryBuilder;
  insert: (values: Row) => StatefulQueryBuilder;
  update: (values: Row) => StatefulQueryBuilder;
  upsert: (values: Row, options?: unknown) => StatefulQueryBuilder;
  delete: () => StatefulQueryBuilder;
  eq: (column: string, value: unknown) => StatefulQueryBuilder;
  neq: (column: string, value: unknown) => StatefulQueryBuilder;
  or: (...args: unknown[]) => StatefulQueryBuilder;
  in: (...args: unknown[]) => StatefulQueryBuilder;
  order: (...args: unknown[]) => StatefulQueryBuilder;
  limit: (...args: unknown[]) => StatefulQueryBuilder;
  range: (...args: unknown[]) => StatefulQueryBuilder;
  single: () => Promise<MockDbResponse>;
  maybeSingle: () => Promise<MockDbResponse>;
}

export interface StatefulSupabaseClient {
  auth: {
    getUser: () => Promise<{
      data: { user: StatefulUser | null };
      error: null;
    }>;
  };
  from: (table: string) => StatefulQueryBuilder;
}

export interface StatefulSupabaseOptions {
  store: StatefulStore;
  user?: StatefulUser | null;
}

export function createStatefulSupabaseClient({
  store,
  user = null,
}: StatefulSupabaseOptions): StatefulSupabaseClient {
  const from = (table: string): StatefulQueryBuilder => {
    let op: string | null = null;
    let payload: Row | null = null;
    let selectArgs: unknown[] = [];
    const filters: Filter[] = [];

    const matches = (row: Row): boolean =>
      filters.every(({ method, args }) => {
        if (method === "eq") return row[args[0] as string] === args[1];
        if (method === "neq") return row[args[0] as string] !== args[1];
        return true;
      });

    const runSubscriptions = (): MockDbResponse => {
      const rows = [...store.subscriptions.values()];
      if (op === "select") {
        return { data: rows.find(matches) ?? null, error: null };
      }
      if (op === "upsert" || op === "insert") {
        const record = { ...(payload ?? {}) };
        store.subscriptions.set(String(record.user_id), record);
        return { data: record, error: null };
      }
      if (op === "update") {
        for (const row of rows) if (matches(row)) Object.assign(row, payload);
        return { data: null, error: null };
      }
      if (op === "delete") {
        for (const row of rows) {
          if (matches(row)) store.subscriptions.delete(String(row.user_id));
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    const runProfiles = (): MockDbResponse => {
      const rows = [...store.profiles.values()];
      if (op === "select") {
        return { data: rows.find(matches) ?? null, error: null };
      }
      if (op === "update") {
        for (const row of rows) if (matches(row)) Object.assign(row, payload);
        return { data: null, error: null };
      }
      if (op === "upsert" || op === "insert") {
        const record = { ...(payload ?? {}) };
        store.profiles.set(String(record.id), record);
        return { data: record, error: null };
      }
      return { data: null, error: null };
    };

    const runProjects = (): MockDbResponse => {
      if (op === "select") {
        const found = store.projects.filter(matches);
        const head = Boolean((selectArgs[1] as { head?: boolean } | undefined)?.head);
        return head
          ? { data: null, error: null, count: found.length }
          : { data: found, error: null };
      }
      if (op === "insert") {
        const record = {
          id: `project-${store.projects.length + 1}`,
          created_at: new Date().toISOString(),
          ...(payload ?? {}),
        };
        store.projects.push(record);
        return { data: record, error: null };
      }
      if (op === "update") {
        for (const row of store.projects) if (matches(row)) Object.assign(row, payload);
        return { data: null, error: null };
      }
      if (op === "delete") {
        for (let i = store.projects.length - 1; i >= 0; i -= 1) {
          if (matches(store.projects[i])) store.projects.splice(i, 1);
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    const runPaymentEvents = (): MockDbResponse => {
      if (op === "insert") {
        const record = payload ?? {};
        const key = `${record.provider}:${record.event_id}`;
        if (store.paymentEvents.has(key)) {
          return {
            data: null,
            error: {
              message: "duplicate key value violates unique constraint",
              code: "23505",
            },
          };
        }
        store.paymentEvents.add(key);
        return { data: record, error: null };
      }
      if (op === "delete") {
        for (const key of [...store.paymentEvents]) {
          const [provider, eventId] = key.split(":");
          if (matches({ provider, event_id: eventId })) {
            store.paymentEvents.delete(key);
          }
        }
        return { data: null, error: null };
      }
      return { data: [], error: null };
    };

    const execute = (): MockDbResponse => {
      switch (table) {
        case "subscriptions":
          return runSubscriptions();
        case "profiles":
          return runProfiles();
        case "projects":
          return runProjects();
        case "payment_events":
          return runPaymentEvents();
        default:
          return { data: null, error: null };
      }
    };

    const builder: StatefulQueryBuilder = {
      select: (...args) => {
        op = op ?? "select";
        selectArgs = args;
        return builder;
      },
      insert: (values) => {
        op = "insert";
        payload = values;
        return builder;
      },
      update: (values) => {
        op = "update";
        payload = values;
        return builder;
      },
      upsert: (values) => {
        op = "upsert";
        payload = values;
        return builder;
      },
      delete: () => {
        op = "delete";
        return builder;
      },
      eq: (column, value) => {
        filters.push({ method: "eq", args: [column, value] });
        return builder;
      },
      neq: (column, value) => {
        filters.push({ method: "neq", args: [column, value] });
        return builder;
      },
      or: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      single: () => Promise.resolve(execute()),
      maybeSingle: () => Promise.resolve(execute()),
      then: (onfulfilled, onrejected) =>
        Promise.resolve(execute()).then(onfulfilled, onrejected),
    };

    return builder;
  };

  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from,
  };
}
