const DEFAULT_SKIP_FIELDS = ["_id", "_creationTime", "updatedAt"];

function isEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => isEqual(value, right[index]));
  }

  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer)) {
      return false;
    }

    if (left.byteLength !== right.byteLength) {
      return false;
    }

    const leftBytes = new Uint8Array(left);
    const rightBytes = new Uint8Array(right);
    return leftBytes.every((value, index) => value === rightBytes[index]);
  }

  if (typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) =>
    Object.prototype.hasOwnProperty.call(right, key) &&
    isEqual(value, (right as Record<string, unknown>)[key]),
  );
}

/**
 * Compare an existing document with new values and return only the changed fields.
 * Only iterates over keys present in `newValues` — fields that exist in `oldDoc`
 * but are absent from `newValues` are not reported as changes. This matches
 * Convex `patch` semantics where missing keys mean "keep the old value".
 * For detecting field removals (e.g. on delete), use `computeDeleteChanges`.
 */
export function computeChanges(
  oldDoc: Record<string, unknown>,
  newValues: Record<string, unknown>,
  skipFields?: string[],
): Record<string, { old: unknown; new: unknown }> | undefined {
  const skip = new Set(skipFields ?? DEFAULT_SKIP_FIELDS);
  const result: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of Object.keys(newValues)) {
    if (skip.has(key)) continue;
    if (!isEqual(oldDoc[key], newValues[key])) {
      result[key] = { old: oldDoc[key], new: newValues[key] };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function computeDeleteChanges(
  doc: Record<string, unknown>,
  skipFields?: string[],
): Record<string, { old: unknown; new: null }> {
  const skip = new Set(skipFields ?? DEFAULT_SKIP_FIELDS);
  const result: Record<string, { old: unknown; new: null }> = {};

  for (const key of Object.keys(doc)) {
    if (skip.has(key)) continue;
    result[key] = { old: doc[key], new: null };
  }

  return result;
}
