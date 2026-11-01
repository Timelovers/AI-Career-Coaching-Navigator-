import { LlmConfigError } from './errors';

export type ProviderId = 'gemini' | 'deepseek' | 'openai-compatible';

export interface ProviderSettings {
  provider: ProviderId;
  geminiApiKey: string;
  geminiModel: string;
  deepseekApiKey: string;
  deepseekModel: string;
  customApiKey: string;
  customModel: string;
  customBaseUrl: string;
}

export interface ActiveModel {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  label: string;
}

export const SETTINGS_STORAGE_KEY = 'career-coach.provider';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

const PROVIDERS: ProviderId[] = ['gemini', 'deepseek', 'openai-compatible'];

export function defaultSettings(): ProviderSettings {
  return {
    provider: 'gemini',
    geminiApiKey: '',
    geminiModel: DEFAULT_GEMINI_MODEL,
    deepseekApiKey: '',
    deepseekModel: DEFAULT_DEEPSEEK_MODEL,
    customApiKey: '',
    customModel: '',
    customBaseUrl: 'https://api.openai.com/v1',
  };
}

function readStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function loadSettings(): ProviderSettings {
  const defaults = defaultSettings();
  const storage = readStorage();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ProviderSettings>;
    const provider = PROVIDERS.includes(parsed.provider as ProviderId)
      ? parsed.provider as ProviderId
      : defaults.provider;
    return {
      provider,
      geminiApiKey: text(parsed.geminiApiKey),
      geminiModel: text(parsed.geminiModel, defaults.geminiModel) || defaults.geminiModel,
      deepseekApiKey: text(parsed.deepseekApiKey),
      deepseekModel: text(parsed.deepseekModel, defaults.deepseekModel) || defaults.deepseekModel,
      customApiKey: text(parsed.customApiKey),
      customModel: text(parsed.customModel),
      customBaseUrl: text(parsed.customBaseUrl, defaults.customBaseUrl) || defaults.customBaseUrl,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: ProviderSettings): void {
  const storage = readStorage();
  if (!storage) throw new LlmConfigError('当前环境无法使用本地存储，密钥不会被保存。');
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function resolveActive(settings: ProviderSettings): ActiveModel {
  if (settings.provider === 'deepseek') {
    return {
      provider: 'deepseek',
      apiKey: settings.deepseekApiKey.trim(),
      model: settings.deepseekModel.trim() || DEFAULT_DEEPSEEK_MODEL,
      baseUrl: DEEPSEEK_BASE_URL,
      label: 'DeepSeek',
    };
  }
  if (settings.provider === 'openai-compatible') {
    return {
      provider: 'openai-compatible',
      apiKey: settings.customApiKey.trim(),
      model: settings.customModel.trim(),
      baseUrl: settings.customBaseUrl.trim(),
      label: '自定义接口',
    };
  }
  return {
    provider: 'gemini',
    apiKey: settings.geminiApiKey.trim(),
    model: settings.geminiModel.trim() || DEFAULT_GEMINI_MODEL,
    label: 'Gemini',
  };
}

export function assertActive(settings: ProviderSettings): ActiveModel {
  const active = resolveActive(settings);
  if (!active.apiKey) {
    throw new LlmConfigError(`请先在设置中填写 ${active.label} 的 API Key。密钥只保存在这台浏览器的 localStorage。`);
  }
  if (!active.model) {
    throw new LlmConfigError(`请先在设置中填写 ${active.label} 的模型 ID。`);
  }
  if (active.provider === 'openai-compatible') {
    let url: URL;
    try {
      url = new URL(active.baseUrl || '');
    } catch {
      throw new LlmConfigError('自定义接口的 Base URL 不是合法地址。');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new LlmConfigError('Base URL 需要以 http:// 或 https:// 开头。');
    }
  }
  return active;
}

export function hasActiveKey(settings: ProviderSettings = loadSettings()): boolean {
  return Boolean(resolveActive(settings).apiKey && resolveActive(settings).model);
}
