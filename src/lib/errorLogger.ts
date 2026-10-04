import { appLogger } from './appLogger';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorType = 'api_error' | 'client_error' | 'auth_error' | 'network_error' | 'render_error';

interface LogErrorParams {
  type: ErrorType;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity?: ErrorSeverity;
  pageUrl?: string;
}


// In-memory buffer for rate limiting
const recentErrors = new Map<string, number>();
const MAX_RECENT_ERRORS = 200;

function pruneRecentErrors() {
  if (recentErrors.size <= MAX_RECENT_ERRORS) return;
  const now = Date.now();
  for (const [key, ts] of recentErrors) {
    if (now - ts > RATE_LIMIT_MS) recentErrors.delete(key);
  }
  // If still over limit after pruning expired, remove oldest entries
  if (recentErrors.size > MAX_RECENT_ERRORS) {
    const entries = [...recentErrors.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - MAX_RECENT_ERRORS);
    for (const [key] of toRemove) recentErrors.delete(key);
  }
}
const RATE_LIMIT_MS = 5000; // Don't log same error more than once per 5s

export async function logError(params: LogErrorParams) {
  const {
    type,
    message,
    context = {},
    severity = 'error',
  } = params;

  // Rate limit: skip duplicate errors
  const errorKey = `${type}:${message}`;
  const lastLogged = recentErrors.get(errorKey);
  if (lastLogged && Date.now() - lastLogged < RATE_LIMIT_MS) return;
  recentErrors.set(errorKey, Date.now());
  pruneRecentErrors();

  // Always log via central logger
  if (severity === 'critical' || severity === 'error') {
    appLogger.error(`[${type.toUpperCase()}] ${message}`, context);
  } else if (severity === 'warning') {
    appLogger.warn(`[${type.toUpperCase()}] ${message}`, context);
  } else {
    appLogger.info(`[${type.toUpperCase()}] ${message}`, context);
  }

  // Diagnóstico somente no console; o painel de logs local foi aposentado.
}

// Log unhandled errors
export function initGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logError({
      type: 'client_error',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      severity: 'error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection';
    logError({
      type: 'client_error',
      message,
      stack: event.reason?.stack,
      severity: 'error',
    });
  });
}

// Monitor Supabase API errors
export function logApiError(operation: string, error: any, context?: Record<string, any>) {
  logError({
    type: 'api_error',
    message: `API Error in ${operation}: ${error?.message || String(error)}`,
    stack: error?.stack,
    context: { operation, code: error?.code, details: error?.details, ...context },
    severity: error?.code === 'PGRST303' ? 'warning' : 'error',
  });
}

// Session/Auth error helper
export function logAuthError(message: string, context?: Record<string, any>) {
  logError({
    type: 'auth_error',
    message,
    context,
    severity: 'warning',
  });
}
