import { LlmApiError, isRetryableStatus, redact, withRetry } from './errors';

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiChatParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAiMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export function openAiChatUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function apiMessage(body: string, status: number, apiKey: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    if (typeof parsed.error === 'string') detail = parsed.error;
    else if (parsed.error && typeof parsed.error.message === 'string') detail = parsed.error.message;
    else if (typeof parsed.message === 'string') detail = parsed.message;
  } catch {
    detail = body.slice(0, 240);
  }
  detail = redact(detail, apiKey).slice(0, 280);
  if (status === 401 || status === 403) return '密钥无效或没有权限。请检查设置里的 API Key。';
  if (status === 404) return `模型不存在，或接口地址不正确。${detail}`.trim();
  if (status === 429) return `请求过于频繁，请稍后再试。${detail}`.trim();
  return detail || `模型接口返回 ${status}。`;
}

function wantsJsonFallback(status: number, body: string): boolean {
  if (status !== 400) return false;
  return /response_format|json_object|unknown parameter|unrecognized/i.test(body);
}

async function requestOnce(params: OpenAiChatParams, useJson: boolean): Promise<Response> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(openAiChatUrl(params.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.4,
        max_tokens: params.maxTokens ?? (useJson ? 8192 : 4096),
        ...(useJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    throw new LlmApiError(
      `无法连接模型服务。如果使用自定义网关，请确认该地址允许浏览器跨域（CORS）。${redact(message, params.apiKey)}`.trim(),
    );
  }
  return response;
}

function readContent(payload: unknown, apiKey: string): string {
  const data = payload as {
    choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;
  const content = typeof message?.content === 'string' ? message.content : '';
  const reasoning = typeof message?.reasoning_content === 'string' ? message.reasoning_content : '';
  const text = content.trim() ? content : reasoning;
  if (!text.trim()) throw new LlmApiError('模型返回了空内容。');
  return redact(text, apiKey);
}

export async function postOpenAiChat(params: OpenAiChatParams): Promise<string> {
  return withRetry(async () => {
    let response = await requestOnce(params, Boolean(params.json));
    if (params.json && !response.ok) {
      const body = await response.text();
      if (wantsJsonFallback(response.status, body)) {
        response = await requestOnce(params, false);
      } else if (isRetryableStatus(response.status)) {
        throw new LlmApiError(apiMessage(body, response.status, params.apiKey), response.status);
      } else {
        throw new LlmApiError(apiMessage(body, response.status, params.apiKey), response.status);
      }
    }

    if (!response.ok) {
      const body = await response.text();
      throw new LlmApiError(apiMessage(body, response.status, params.apiKey), response.status);
    }

    try {
      return readContent(await response.json(), params.apiKey);
    } catch (err) {
      if (err instanceof LlmApiError) throw err;
      throw new LlmApiError('模型响应不是合法 JSON。');
    }
  }, (err) => err instanceof LlmApiError && isRetryableStatus(err.status));
}
