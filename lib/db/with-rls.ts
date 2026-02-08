import { db } from '.'

// Type for transaction or database instance
export type DbInstance = typeof db
export type TxInstance = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Custom error class for RLS violations
 */
export class RLSViolationError extends Error {
  constructor(message = 'Row level security policy violation') {
    super(message)
    this.name = 'RLSViolationError'
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RLSViolationError)
    }
  }
}

/**
 * Execute database operations with user context
 *
 * Note: RLS via set_config is disabled for Supabase pooler compatibility.
 * All queries already filter by userId in the WHERE clause for security.
 * The userId parameter is kept for future RLS support and audit logging.
 *
 * @param userId - The user ID for the operation (used for audit, not RLS)
 * @param callback - The database operations to execute
 * @returns The result of the callback function
 *
 * @example
 * ```typescript
 * const result = await withRLS(userId, async (tx) => {
 *   return tx.select().from(chats).where(eq(chats.userId, userId))
 * })
 * ```
 */
export async function withRLS<T>(
  userId: string,
  callback: (tx: TxInstance) => Promise<T>
): Promise<T> {
  // Note: We skip set_config for Supabase pooler compatibility.
  // Security is enforced via WHERE clauses in all queries.
  return await db.transaction(async tx => {
    return await callback(tx)
  })
}

/**
 * Execute database operations with optional RLS context
 * If userId is null, executes without RLS context (for public operations)
 *
 * @param userId - The user ID to set for RLS policies, or null for public access
 * @param callback - The database operations to execute
 * @returns The result of the callback function
 */
export async function withOptionalRLS<T>(
  userId: string | null,
  callback: (tx: TxInstance | DbInstance) => Promise<T>
): Promise<T> {
  if (userId) {
    return withRLS(userId, callback as (tx: TxInstance) => Promise<T>)
  }

  // Execute without RLS context for public operations
  return callback(db)
}
