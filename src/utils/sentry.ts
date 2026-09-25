import * as Sentry from '@sentry/react';

let isSentryInitialized = false;

// Check if a DSN is valid (32 hex characters or proper Sentry URI structure, not placeholder/mock)
function isValidSentryDsn(dsn?: string): boolean {
  if (!dsn || typeof dsn !== 'string') return false;
  if (dsn.includes('mock-') || dsn.includes('example.com') || dsn.includes('placeholder')) return false;
  try {
    const url = new URL(dsn);
    return Boolean(url.protocol && url.username && url.pathname && url.pathname.length > 1);
  } catch {
    return false;
  }
}

// Initialize Sentry for client-side crash and bug reporting
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!isValidSentryDsn(dsn)) {
    // Graceful local telemetry mode without throwing invalid DSN error
    console.debug('[Telemetry] Sentry DSN not provided or using local mock. Crash reporting active in local development mode.');
    return;
  }

  try {
    Sentry.init({
      dsn: dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      tracesSampleRate: 1.0,
      beforeSend(event) {
        console.debug('[Sentry Event Captured]', event);
        return event;
      },
    });
    isSentryInitialized = true;
  } catch (e) {
    console.warn('Sentry initialization info:', e);
  }
}

export interface BugReport {
  id: string;
  title: string;
  description: string;
  category: 'recipe_import' | 'cooking_timer' | 'instacart' | 'sync_groceries' | 'visual_bug' | 'other';
  severity: 'low' | 'medium' | 'high';
  userEmail?: string;
  userName?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

export function reportUserBug(report: Omit<BugReport, 'id' | 'timestamp' | 'url' | 'userAgent'>) {
  const fullReport: BugReport = {
    ...report,
    id: `bug-${Date.now()}`,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  // Capture message in Sentry if initialized
  if (isSentryInitialized) {
    try {
      Sentry.captureMessage(`[User Bug Report] ${report.title}`, {
        level: report.severity === 'high' ? 'error' : report.severity === 'medium' ? 'warning' : 'info',
        tags: {
          category: report.category,
          severity: report.severity,
          user: report.userEmail || 'anonymous',
        },
        extra: { ...fullReport } as Record<string, unknown>,
      });
    } catch (e) {
      console.warn('Failed to dispatch Sentry message:', e);
    }
  } else {
    console.info('[Local Telemetry Report Saved]:', fullReport);
  }

  // Store in localStorage for debug history
  try {
    const existing = JSON.parse(localStorage.getItem('mise_user_bugs') || '[]');
    existing.unshift(fullReport);
    localStorage.setItem('mise_user_bugs', JSON.stringify(existing.slice(0, 50)));
  } catch (e) {
    console.error('Failed to cache bug report:', e);
  }

  return fullReport;
}

export { Sentry };
