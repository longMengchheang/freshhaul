export type ActionErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SCHEMA_OUTDATED'
  | 'UNKNOWN_ERROR';

export type ActionResult<TData = undefined> =
  | { success: true; data?: TData; code?: undefined; error?: undefined }
  | { success: false; code: ActionErrorCode; error: string; data?: TData };

export function actionOk<TData = undefined>(data?: TData): ActionResult<TData> {
  return { success: true, data };
}

export function actionFail<TData = undefined>(
  code: ActionErrorCode,
  error: string,
  data?: TData,
): ActionResult<TData> {
  return { success: false, code, error, data };
}

export function mapUnknownActionError(error: unknown, fallbackMessage: string): ActionResult {
  const message = error instanceof Error ? error.message : '';
  if (/column|schema|relation/i.test(message)) {
    return actionFail('SCHEMA_OUTDATED', 'Database schema is out of date. Run the latest migration and retry.');
  }
  return actionFail('UNKNOWN_ERROR', fallbackMessage);
}

