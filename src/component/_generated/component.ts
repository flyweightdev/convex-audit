/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    audit: {
      countAuditLogs: FunctionReference<
        "query",
        "internal",
        {
          filterAction?: string;
          filterAfter?: number;
          filterBefore?: number;
          filterDocumentId?: string;
          filterTable?: string;
          filterUserId?: string;
        },
        number,
        Name
      >;
      getByDocumentId: FunctionReference<
        "query",
        "internal",
        { documentId: string; limit?: number; table: string },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          changes?: any;
          documentId: string;
          metadata?: any;
          summary: string;
          table: string;
          timestamp: number;
          userId: string;
        }>,
        Name
      >;
      insertAuditLog: FunctionReference<
        "mutation",
        "internal",
        {
          action: string;
          changes?: any;
          documentId: string;
          metadata?: any;
          summary: string;
          table: string;
          userId: string;
        },
        string,
        Name
      >;
      insertBulkAuditLogs: FunctionReference<
        "mutation",
        "internal",
        {
          events: Array<{
            action: string;
            changes?: any;
            documentId: string;
            metadata?: any;
            summary: string;
            table: string;
            userId: string;
          }>;
        },
        Array<string>,
        Name
      >;
      listAuditLogs: FunctionReference<
        "query",
        "internal",
        {
          filterAction?: string;
          filterAfter?: number;
          filterBefore?: number;
          filterDocumentId?: string;
          filterTable?: string;
          filterUserId?: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            _creationTime: number;
            _id: string;
            action: string;
            changes?: any;
            documentId: string;
            metadata?: any;
            summary: string;
            table: string;
            timestamp: number;
            userId: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        },
        Name
      >;
      purgeBefore: FunctionReference<
        "mutation",
        "internal",
        { before: number },
        { deleted: number; hasMore: boolean },
        Name
      >;
    };
  };
