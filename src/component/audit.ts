import { mutation, query } from "./_generated/server.js";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const auditLogDoc = v.object({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
  userId: v.string(),
  table: v.string(),
  documentId: v.string(),
  action: v.string(),
  summary: v.string(),
  changes: v.optional(v.any()),
  metadata: v.optional(v.any()),
  timestamp: v.number(),
});

export const insertAuditLog = mutation({
  args: {
    userId: v.string(),
    table: v.string(),
    documentId: v.string(),
    action: v.string(),
    summary: v.string(),
    changes: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
    });
    return id;
  },
});

/**
 * Insert multiple audit log events in a single mutation.
 * All events share the same timestamp so they are treated as simultaneous.
 * Use `_creationTime` if you need to distinguish insertion order within a batch.
 */
export const insertBulkAuditLogs = mutation({
  args: {
    events: v.array(
      v.object({
        userId: v.string(),
        table: v.string(),
        documentId: v.string(),
        action: v.string(),
        summary: v.string(),
        changes: v.optional(v.any()),
        metadata: v.optional(v.any()),
      }),
    ),
  },
  returns: v.array(v.id("auditLogs")),
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const ids = [];
    for (const event of args.events) {
      const id = await ctx.db.insert("auditLogs", {
        ...event,
        timestamp,
      });
      ids.push(id);
    }
    return ids;
  },
});

// Fields covered by each index (equality prefixes only, not the timestamp range suffix)
type IndexChoice =
  | "by_documentId"
  | "by_table_documentId_and_timestamp"
  | "by_userId_action_and_timestamp"
  | "by_userId_and_timestamp"
  | "by_action_and_timestamp"
  | "by_table_and_timestamp"
  | "by_timestamp";

interface FilterParams {
  filterTable?: string;
  filterAction?: string;
  filterUserId?: string;
  filterDocumentId?: string;
  filterBefore?: number;
  filterAfter?: number;
}

// Select the best index and return the set of fields covered by equality prefix
function selectIndex(params: FilterParams): {
  index: IndexChoice;
  coveredFields: Set<string>;
  needsTimestampPostFilter: boolean;
} {
  const { filterDocumentId, filterUserId, filterAction, filterTable } = params;

  if (filterTable !== undefined && filterDocumentId !== undefined) {
    return {
      index: "by_table_documentId_and_timestamp",
      coveredFields: new Set(["table", "documentId"]),
      needsTimestampPostFilter: false,
    };
  }
  if (filterDocumentId !== undefined) {
    return {
      index: "by_documentId",
      coveredFields: new Set(["documentId"]),
      needsTimestampPostFilter: true,
    };
  }
  if (filterUserId !== undefined && filterAction !== undefined) {
    return {
      index: "by_userId_action_and_timestamp",
      coveredFields: new Set(["userId", "action"]),
      needsTimestampPostFilter: false,
    };
  }
  if (filterUserId !== undefined) {
    return {
      index: "by_userId_and_timestamp",
      coveredFields: new Set(["userId"]),
      needsTimestampPostFilter: false,
    };
  }
  if (filterAction !== undefined) {
    return {
      index: "by_action_and_timestamp",
      coveredFields: new Set(["action"]),
      needsTimestampPostFilter: false,
    };
  }
  if (filterTable !== undefined) {
    return {
      index: "by_table_and_timestamp",
      coveredFields: new Set(["table"]),
      needsTimestampPostFilter: false,
    };
  }
  return {
    index: "by_timestamp",
    coveredFields: new Set(),
    needsTimestampPostFilter: false,
  };
}

// Build the index query with equality prefixes and optional timestamp range bounds.
// Uses `any` because Convex's IndexRangeBuilder type changes shape with each
// chained call, making conditional chaining impossible with strict types.
function buildIndexQuery(db: any, index: IndexChoice, params: FilterParams) {
  const {
    filterDocumentId,
    filterUserId,
    filterAction,
    filterTable,
    filterAfter,
    filterBefore,
  } = params;

  switch (index) {
    case "by_table_documentId_and_timestamp":
      return db
        .query("auditLogs")
        .withIndex("by_table_documentId_and_timestamp", (q: any) => {
          let r = q.eq("table", filterTable).eq("documentId", filterDocumentId);
          if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
          if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
          return r;
        });

    case "by_documentId":
      return db
        .query("auditLogs")
        .withIndex("by_documentId", (q: any) =>
          q.eq("documentId", filterDocumentId),
        );

    case "by_userId_action_and_timestamp":
      return db
        .query("auditLogs")
        .withIndex("by_userId_action_and_timestamp", (q: any) => {
          let r = q.eq("userId", filterUserId).eq("action", filterAction);
          if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
          if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
          return r;
        });

    case "by_userId_and_timestamp":
      return db
        .query("auditLogs")
        .withIndex("by_userId_and_timestamp", (q: any) => {
          let r = q.eq("userId", filterUserId);
          if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
          if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
          return r;
        });

    case "by_action_and_timestamp":
      return db
        .query("auditLogs")
        .withIndex("by_action_and_timestamp", (q: any) => {
          let r = q.eq("action", filterAction);
          if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
          if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
          return r;
        });

    case "by_table_and_timestamp":
      return db
        .query("auditLogs")
        .withIndex("by_table_and_timestamp", (q: any) => {
          let r = q.eq("table", filterTable);
          if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
          if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
          return r;
        });

    case "by_timestamp":
      return db.query("auditLogs").withIndex("by_timestamp", (q: any) => {
        let r = q;
        if (filterAfter !== undefined) r = r.gte("timestamp", filterAfter);
        if (filterBefore !== undefined) r = r.lte("timestamp", filterBefore);
        return r;
      });
  }
}

// Apply post-filters for fields not covered by the selected index
function applyPostFilters(
  query: any,
  params: FilterParams,
  coveredFields: Set<string>,
  needsTimestampPostFilter: boolean,
) {
  let result = query;

  const filters: Array<{ field: string; key: keyof FilterParams }> = [
    { field: "table", key: "filterTable" },
    { field: "action", key: "filterAction" },
    { field: "userId", key: "filterUserId" },
    { field: "documentId", key: "filterDocumentId" },
  ];

  for (const { field, key } of filters) {
    const value = params[key];
    if (value !== undefined && !coveredFields.has(field)) {
      result = result.filter((qf: any) => qf.eq(qf.field(field), value));
    }
  }

  // Timestamp range post-filters only needed for by_documentId (no timestamp in index)
  if (needsTimestampPostFilter) {
    if (params.filterAfter !== undefined) {
      result = result.filter((qf: any) =>
        qf.gte(qf.field("timestamp"), params.filterAfter),
      );
    }
    if (params.filterBefore !== undefined) {
      result = result.filter((qf: any) =>
        qf.lte(qf.field("timestamp"), params.filterBefore),
      );
    }
  }

  return result;
}

export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filterTable: v.optional(v.string()),
    filterAction: v.optional(v.string()),
    filterUserId: v.optional(v.string()),
    filterDocumentId: v.optional(v.string()),
    filterBefore: v.optional(v.float64()),
    filterAfter: v.optional(v.float64()),
  },
  returns: v.object({
    page: v.array(auditLogDoc),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const params: FilterParams = args;
    const { index, coveredFields, needsTimestampPostFilter } =
      selectIndex(params);
    const q = buildIndexQuery(ctx.db, index, params);
    const ordered = applyPostFilters(
      q.order("desc"),
      params,
      coveredFields,
      needsTimestampPostFilter,
    );
    return await ordered.paginate(args.paginationOpts);
  },
});

export const getByDocumentId = query({
  args: {
    table: v.string(),
    documentId: v.string(),
    limit: v.optional(v.float64()),
  },
  returns: v.array(auditLogDoc),
  handler: async (ctx, args) => {
    const limit = args.limit ?? DEFAULT_DOCUMENT_HISTORY_LIMIT;
    validateDocumentHistoryLimit(limit);
    const q = ctx.db
      .query("auditLogs")
      .withIndex("by_table_documentId_and_timestamp", (qb: any) =>
        qb.eq("table", args.table).eq("documentId", args.documentId),
      )
      .order("desc");

    return await q.take(limit);
  },
});

/**
 * Count matching audit events. Supports the same filters as `listAuditLogs`.
 *
 * Counts matching audit events in bounded pages to avoid loading the full
 * result set into memory at once.
 */
export const countAuditLogs = query({
  args: {
    filterTable: v.optional(v.string()),
    filterAction: v.optional(v.string()),
    filterUserId: v.optional(v.string()),
    filterDocumentId: v.optional(v.string()),
    filterBefore: v.optional(v.float64()),
    filterAfter: v.optional(v.float64()),
  },
  returns: v.float64(),
  handler: async (ctx, args) => {
    const params: FilterParams = args;
    const { index, coveredFields, needsTimestampPostFilter } =
      selectIndex(params);
    let count = 0;
    let cursor: string | null = null;

    while (true) {
      const q = buildIndexQuery(ctx.db, index, params);
      const ordered = applyPostFilters(
        q.order("desc"),
        params,
        coveredFields,
        needsTimestampPostFilter,
      );
      const result: {
        continueCursor: string;
        isDone: boolean;
        page: unknown[];
      } = await ordered.paginate({
        cursor,
        numItems: COUNT_PAGE_SIZE,
      });

      count += result.page.length;
      if (result.isDone) {
        return count;
      }
      cursor = result.continueCursor;
    }
  },
});

const DEFAULT_DOCUMENT_HISTORY_LIMIT = 100;
const MAX_DOCUMENT_HISTORY_LIMIT = 500;
const COUNT_PAGE_SIZE = 500;
const PURGE_BATCH_SIZE = 500;

function validateDocumentHistoryLimit(limit: number) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_DOCUMENT_HISTORY_LIMIT
  ) {
    throw new Error(
      `\`limit\` must be an integer between 1 and ${MAX_DOCUMENT_HISTORY_LIMIT}. Received \`${limit}\`.`,
    );
  }
}

/**
 * Delete audit logs with timestamps strictly before the given value.
 * Processes up to 500 entries per call. Returns `{ deleted, hasMore }` so
 * callers can loop or reschedule until all old entries are removed.
 */
export const purgeBefore = mutation({
  args: {
    before: v.float64(),
  },
  returns: v.object({
    deleted: v.float64(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.before))
      .order("asc")
      .take(PURGE_BATCH_SIZE);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return {
      deleted: docs.length,
      hasMore: docs.length === PURGE_BATCH_SIZE,
    };
  },
});
