// Model fallback and retry policy for Gemini calls. Pure (no SDK imports) so it can be tested.

/** Overload, rate limits and timeouts are worth retrying; bad requests and missing models are not. */
export const isTransientGeminiError = (err: any): boolean => {
  const status = Number(err?.status ?? err?.code);
  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    err?.name === 'AbortError' ||
    /UNAVAILABLE|high demand|overloaded/i.test(err?.message || '')
  );
};

/**
 * What to do when Gemini could not read a YouTube video. The description is plain text, which is far more
 * reliable than video, so use it whenever there is one, busy or not. With no description, a 500 ("Internal
 * error") on a video is Gemini failing to process that video, which retrying will not fix; other transient
 * errors (503, 429) really are overload.
 */
export const youtubeFailurePlan = (err: any, hasDescription: boolean): 'use_description' | 'video_unreadable' | 'busy' => {
  if (hasDescription) return 'use_description';
  const status = Number(err?.status ?? err?.code);
  if (status === 500 || !isTransientGeminiError(err)) return 'video_unreadable';
  return 'busy';
};

export interface RetryOptions {
  models: string[];
  attemptTimeoutMs: number;
  totalBudgetMs: number;
  retryPauseMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onFailure?: (model: string, err: any) => void;
}

/**
 * Tries each model in order. If any failure was transient, pauses and makes one more pass.
 * When everything fails, the error thrown is a transient one if there was any, so callers
 * report "busy, try again" instead of blaming the input.
 */
export async function generateWithFallback<T>(
  attempt: (model: string, timeoutMs: number) => Promise<T | null | undefined>,
  options: RetryOptions
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const startedAt = now();
  let lastError: any = null;
  let transientError: any = null;

  for (let pass = 0; pass < 2; pass += 1) {
    let sawTransient = false;
    for (const model of options.models) {
      const remaining = options.totalBudgetMs - (now() - startedAt);
      if (remaining < 4000) throw transientError || lastError || new Error('The AI took too long.');
      try {
        const result = await attempt(model, Math.min(options.attemptTimeoutMs, remaining));
        if (result) return result;
      } catch (err: any) {
        options.onFailure?.(model, err);
        lastError = err;
        if (isTransientGeminiError(err)) {
          sawTransient = true;
          transientError = err;
        }
      }
    }
    if (!sawTransient) break;
    await sleep(options.retryPauseMs);
  }
  throw transientError || lastError || new Error('The AI service is unavailable right now.');
}
