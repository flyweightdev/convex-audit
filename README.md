# @flyweightdev/convex-audit

> This project was created with the help of Claude Code (Opus 4.6) and reviewed by GPT-5.3-Codex, CodeRabbitAI and humans.

A unified, table-agnostic audit log component for [Convex](https://convex.dev).

Track **who** did **what**, **when**, and **why** across all your tables in a single `auditLogs` table — isolated inside the component.

## Features

- **Single unified audit log** — one table for all events, enables "show me everything that happened" queries
- **Transactional** — `audit.log()` runs inside your mutation, same transaction. If the mutation fails, the audit log is rolled back too
- **Zero auth opinions** — the component never checks permissions. You wrap queries with your own auth
- **Table-agnostic** — works with any table, any schema. All identifiers are strings
- **Custom action types** — use any string as an action type (`"create"`, `"approve"`, `"archive"`, etc.)
- **Smart filtering** — paginated queries with automatic index selection for `table`, `action`, `userId`, `documentId`, and timestamp range filters
- **Change tracking** — built-in `computeChanges()` and `computeDeleteChanges()` utilities to diff document values
- **Bulk logging** — `audit.logMany()` for mutations that affect multiple documents
- **Retention control** — `audit.purge()` for cleaning up old entries on your schedule
- **Document history** — `audit.getByDocumentId()` for the most recent audit trail of a single document
- **Counting** — `audit.count()` for dashboard metrics without loading full pages

## Installation

```bash
npm install @flyweightdev/convex-audit
```

### Setup

Add the component to your Convex app:

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import audit from "@flyweightdev/convex-audit/convex.config";

const app = defineApp();
app.use(audit);
export default app;
```

## Usage

### Writing audit logs

Call `audit.log()` inside your mutations. It runs in the same transaction as your data change.

```typescript
import { Audit } from "@flyweightdev/convex-audit";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

const audit = new Audit(components.audit);

export const updateGroup = mutation({
  args: { id: v.id("groups"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx); // your auth logic
    const existing = await ctx.db.get(args.id);

    const changes = audit.computeChanges(existing, { name: args.name });
    await ctx.db.patch(args.id, { name: args.name });

    await audit.log(ctx, {
      userId: user._id,
      table: "groups",
      documentId: args.id,
      action: "update",
      summary: `Updated group '${args.name}'`,
      changes,
    });
  },
});
```

### Bulk logging

For mutations that affect multiple documents:

```typescript
export const archiveGroups = mutation({
  args: { ids: v.array(v.id("groups")) },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);

    for (const id of args.ids) {
      await ctx.db.patch(id, { archived: true });
    }

    await audit.logMany(
      ctx,
      args.ids.map((id) => ({
        userId: user._id,
        table: "groups",
        documentId: id,
        action: "archive",
        summary: `Archived group`,
      })),
    );
  },
});
```

### Custom action types

The `action` field accepts any string. Use whatever makes sense for your domain:

```typescript
await audit.log(ctx, {
  action: "approve", // custom action
  // ...
});

await audit.log(ctx, {
  action: "export", // another custom action
  // ...
});
```

### Computing changes

`computeChanges()` diffs an existing document against new values. It skips `_id`, `_creationTime`, and `updatedAt` by default.

```typescript
const changes = audit.computeChanges(existingDoc, {
  name: "New Name",
  status: "active",
});
// Returns: { name: { old: "Old Name", new: "New Name" } }
// Returns undefined if nothing changed
```

You can customize which fields to skip:

```typescript
const changes = audit.computeChanges(existingDoc, newValues, [
  "_id",
  "_creationTime",
  "updatedAt",
  "internalField",
]);
```

For deletes, use `computeDeleteChanges()` to capture all fields that existed:

```typescript
const existing = await ctx.db.get(args.id);
const changes = audit.computeDeleteChanges(existing);
// Returns: { name: { old: "Soccer", new: null }, status: { old: "active", new: null } }

await ctx.db.delete(args.id);
await audit.log(ctx, {
  action: "delete",
  changes,
  // ...
});
```

### Reading audit logs

Wrap the `audit.list()` query with your own auth check:

```typescript
import { paginationOptsValidator } from "convex/server";

export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filterTable: v.optional(v.string()),
    filterAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // your auth check
    return await audit.list(ctx, args);
  },
});
```

### Document history

Get the recent audit trail for a single document:

```typescript
export const getGroupHistory = query({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await audit.getByDocumentId(ctx, {
      table: "groups",
      documentId: args.id,
      limit: 50,
    });
  },
});
```

For full paginated history, use `audit.list()` with both `filterTable` and `filterDocumentId`.

### Counting

Get the count of matching audit events (useful for dashboards):

```typescript
const totalEvents = await audit.count(ctx);
const userEvents = await audit.count(ctx, { filterUserId: user._id });
const recentDeletes = await audit.count(ctx, {
  filterAction: "delete",
  filterAfter: Date.now() - 24 * 60 * 60 * 1000,
});
```

### Filtering

The `list` and `count` methods support these optional filters:

| Filter             | Description                       |
| ------------------ | --------------------------------- |
| `filterTable`      | Filter by table name              |
| `filterAction`     | Filter by action type             |
| `filterUserId`     | Filter by user ID                 |
| `filterDocumentId` | Filter by document ID             |
| `filterAfter`      | Only events after this timestamp  |
| `filterBefore`     | Only events before this timestamp |

The component automatically selects the best index based on which filters you provide. Results are always sorted newest-first.

### Retention / purging old logs

The component exposes a `purge()` method that deletes entries with timestamps strictly before the given value, in batches. You control the schedule.

```typescript
// In a cron job or scheduled function:
export const cleanupAuditLogs = internalMutation({
  handler: async (ctx) => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const result = await audit.purge(ctx, { before: ninetyDaysAgo });

    // If there are more to delete, schedule another run
    if (result.hasMore) {
      await ctx.scheduler.runAfter(0, internal.crons.cleanupAuditLogs);
    }
  },
});

// convex/crons.ts
const crons = cronJobs();
crons.daily(
  "audit log cleanup",
  { hourUTC: 3 },
  internal.crons.cleanupAuditLogs,
);
export default crons;
```

Each call deletes up to 500 entries and returns `{ deleted: number, hasMore: boolean }` so you can loop until done.

## API Reference

### `new Audit(components.audit)`

Creates an Audit client instance.

### `audit.log(ctx, params)`

Log a single audit event. Call inside a mutation.

| Param        | Type     | Description                                        |
| ------------ | -------- | -------------------------------------------------- |
| `userId`     | `string` | Who performed the action                           |
| `table`      | `string` | Which table was affected                           |
| `documentId` | `string` | Which document was affected                        |
| `action`     | `string` | Any action string (e.g. `"create"`, `"approve"`)   |
| `summary`    | `string` | Human-readable description                         |
| `changes`    | `object` | Optional. Field changes: `{ field: { old, new } }` |
| `metadata`   | `object` | Optional. Additional context                       |

### `audit.logMany(ctx, events)`

Log multiple audit events in one call. All events get the same timestamp. Maximum **500 events** per call — chunk larger batches on the caller side. Call inside a mutation.

### `audit.list(ctx, params)`

Query audit logs with pagination and optional filters. Call inside a query.

### `audit.getByDocumentId(ctx, { table, documentId, limit? })`

Get the most recent audit entries for a single document, newest-first. `limit` defaults to `100` and must be between `1` and `500`. Call inside a query.

### `audit.count(ctx, params?)`

Count matching audit events. Supports the same filters as `list` (except pagination). Returns an exact count. This is O(n) — use narrow filters to keep it fast. Call inside a query.

### `audit.purge(ctx, { before })`

Delete audit logs older than the given timestamp, in batches of 500. Returns `{ deleted, hasMore }`. Call inside a mutation.

### `audit.computeChanges(oldDoc, newValues, skipFields?)`

Pure utility. Compares old document with new values, returns only changed fields as `{ field: { old, new } }`. Returns `undefined` if nothing changed.

### `audit.computeDeleteChanges(doc, skipFields?)`

Pure utility. Captures all fields of a document as `{ field: { old: value, new: null } }`. Useful for recording what was deleted.

## License

Apache-2.0
