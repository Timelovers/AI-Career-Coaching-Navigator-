import { LlmApiError, isRetryableStatus, redact, withRetry } from './errors';
import { toGeminiRequest } from './geminiContents';
import { parseModelJson } from './modelJson';
import { postOpenAiChat, OpenAiMessage } from './openaiChat';
import { ActiveModel, ProviderSettings, assertActive, loadSettings } from './settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  temperature?: number;
  json?: boolean;
  settings?: ProviderSettings;
}

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const record = err as { status?: unknown; code?: unknown };
  if (typeof record.status === 'number') return record.status;
  if (typeof record.code === 'number' && record.code >= 400 && record.code < 600) return record.code;
  return undefined;
}

function retryableError(err: unknown): boolean {
  if (err instanceof LlmApiError) return isRetryableStatus(err.status);
  const status = statusOf(err);
  if (isRetryableStatus(status)) return true;
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return message.includes('unavailable') || message.includes('overloaded') || message.includes('busy') || message.includes('429') || message.includes('503');
}

async function geminiComplete(active: ActiveModel, messages: ChatMessage[], options: CompleteOptions): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: active.apiKey });
  const request = toGeminiRequest(messages);
  try {
    const response = await ai.models.generateContent({
      model: active.model,
      contents: request.contents,
      config: {
        systemInstruction: request.systemInstruction,
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.json ? 8192 : 4096,
        ...(options.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const text = response.text?.trim();
    if (!text) throw new LlmApiError('Gemini 返回了空内容。');
    return redact(text, active.apiKey);
  } catch (err) {
    if (err instanceof LlmApiError) throw err;
    const status = statusOf(err);
    const message = err instanceof Error ? redact(err.message, active.apiKey) : 'Gemini 请求失败。';
    throw new LlmApiError(message.slice(0, 360), status);
  }
}

export async function completeChat(messages: ChatMessage[], options: CompleteOptions = {}): Promise<string> {
  const active = assertActive(options.settings ?? loadSettings());
  return withRetry(async () => {
    if (active.provider === 'gemini') return geminiComplete(active, messages, options);
    return postOpenAiChat({
      baseUrl: active.baseUrl || '',
      apiKey: active.apiKey,
      model: active.model,
      messages: messages as OpenAiMessage[],
      json: options.json,
      temperature: options.temperature,
    });
  }, retryableError);
}

export async function completeJson<T>(system: string, user: string, settings?: ProviderSettings): Promise<T> {
  const text = await completeChat([
    { role: 'system', content: `${system}\n\n只返回一个 JSON 对象，不要使用 Markdown 代码块。` },
    { role: 'user', content: user },
  ], { json: true, temperature: 0.2, settings });
  return parseModelJson(text) as T;
}

export async function testProvider(settings: ProviderSettings): Promise<string> {
  const text = await completeChat([
    { role: 'user', content: '请只回复：pong' },
  ], { temperature: 0, settings });
  return text.trim().slice(0, 180);
}
