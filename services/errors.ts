export class LlmConfigError extends Error {
  readonly name = 'LlmConfigError';
}

export class LlmApiError extends Error {
  readonly name = 'LlmApiError';
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export class LlmParseError extends Error {
  readonly name = 'LlmParseError';
}

export function isConfigError(err: unknown): err is LlmConfigError {
  return err instanceof LlmConfigError;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return '请求失败，请稍后重试。';
}

export function reportModelError(err: unknown, onNeedKey: (hint: string) => void): string | null {
  if (isConfigError(err)) {
    onNeedKey(errorMessage(err));
    return null;
  }
  return errorMessage(err);
}

export function redact(text: string, secret: string): string {
  if (!secret || !text) return text;
  return text.split(secret).join('***');
}

export function isRetryableStatus(status?: number): boolean {
  return status === 429 || status === 503 || status === 529;
}

export async function withRetry<T>(fn: () => Promise<T>, isRetryable: (err: unknown) => boolean): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt < 2 && isRetryable(err)) {
        await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  throw last;
}
