import type { ComponentApi } from "./component/_generated/component.js";
import {
  computeChanges,
  computeDeleteChanges,
} from "./component/lib/changes.js";

/**
 * Parameters for logging a single audit event.
 */
export interface LogAuditEventParams {
  userId: string;
  table: string;
  documentId: string;
  action: string;
  summary: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

export interface ListAuditLogsParams {
  paginationOpts: {
    numItems: number;
    cursor: string | null;
  };
  filterTable?: string;
  filterAction?: string;
  filterUserId?: string;
  filterDocumentId?: string;
  filterBefore?: number;
  filterAfter?: number;
}

export interface CountAuditLogsParams {
  filterTable?: string;
  filterAction?: string;
  filterUserId?: string;
  filterDocumentId?: string;
  filterBefore?: number;
  filterAfter?: number;
}

export interface GetByDocumentIdParams {
  table: string;
  documentId: string;
  limit?: number;
}

export interface PurgeParams {
  /** Delete entries with timestamps strictly before this value (exclusive) */
  before: number;
}

export class Audit {
  private component: ComponentApi;

  constructor(component: ComponentApi) {
    this.component = component;
  }

  async log(ctx: RunMutationCtx, params: LogAuditEventParams) {
    return await ctx.runMutation(this.component.audit.insertAuditLog, params);
  }

  async logMany(ctx: RunMutationCtx, events: LogAuditEventParams[]) {
    return await ctx.runMutation(this.component.audit.insertBulkAuditLogs, {
      events,
    });
  }

  async list(ctx: RunQueryCtx, params: ListAuditLogsParams) {
    return await ctx.runQuery(this.component.audit.listAuditLogs, params);
  }

  async getByDocumentId(ctx: RunQueryCtx, params: GetByDocumentIdParams) {
    return await ctx.runQuery(this.component.audit.getByDocumentId, params);
  }

  async count(ctx: RunQueryCtx, params: CountAuditLogsParams = {}) {
    return await ctx.runQuery(this.component.audit.countAuditLogs, params);
  }

  async purge(ctx: RunMutationCtx, params: PurgeParams) {
    return await ctx.runMutation(this.component.audit.purgeBefore, params);
  }

  computeChanges(
    oldDoc: Record<string, unknown>,
    newValues: Record<string, unknown>,
    skipFields?: string[],
  ) {
    return computeChanges(oldDoc, newValues, skipFields);
  }

  computeDeleteChanges(doc: Record<string, unknown>, skipFields?: string[]) {
    return computeDeleteChanges(doc, skipFields);
  }
}

type RunQueryCtx = {
  runQuery: (query: any, args: any) => Promise<any>;
};

type RunMutationCtx = RunQueryCtx & {
  runMutation: (mutation: any, args: any) => Promise<any>;
};
