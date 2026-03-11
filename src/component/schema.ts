import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  auditLogs: defineTable({
    userId: v.string(),
    table: v.string(),
    documentId: v.string(),
    action: v.string(),
    summary: v.string(),
    changes: v.optional(v.any()),
    metadata: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_table_and_timestamp", ["table", "timestamp"])
    .index("by_table_documentId_and_timestamp", [
      "table",
      "documentId",
      "timestamp",
    ])
    .index("by_action_and_timestamp", ["action", "timestamp"])
    .index("by_userId_and_timestamp", ["userId", "timestamp"])
    .index("by_userId_action_and_timestamp", ["userId", "action", "timestamp"])
    .index("by_documentId", ["documentId"]),
});
