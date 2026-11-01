import { LlmParseError } from './errors';
import { InterviewFeedback, ProjectAsset, ResumeProject } from '../types';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function asScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, scaled));
}

export function parseModelJson(raw: string): unknown {
  let body = raw.trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) body = fenced[1].trim();
  try {
    return JSON.parse(body);
  } catch {
    const objectStart = body.indexOf('{');
    const arrayStart = body.indexOf('[');
    let start = -1;
    let end = -1;
    if (objectStart !== -1 && (arrayStart === -1 || objectStart < arrayStart)) {
      start = objectStart;
      end = body.lastIndexOf('}');
    } else if (arrayStart !== -1) {
      start = arrayStart;
      end = body.lastIndexOf(']');
    }
    if (start === -1 || end <= start) {
      throw new LlmParseError('模型没有返回可解析的 JSON。');
    }
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      throw new LlmParseError('模型返回的 JSON 无法解析。');
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function listFrom(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const obj = record(value);
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export function normalizeAssets(value: unknown): ProjectAsset[] {
  return listFrom(value, ['assets', 'items', 'projects']).map((item) => {
    const row = record(item);
    return {
      id: asString(row.id) || createId(),
      name: asString(row.name, '未命名项目'),
      background: asString(row.background),
      tasks: asString(row.tasks),
      actions: asString(row.actions),
      results: asString(row.results),
      techStack: asStringList(row.techStack),
      challenges: asString(row.challenges),
    };
  }).filter((asset) => {
    const body = [asset.background, asset.tasks, asset.actions, asset.results, asset.challenges, asset.techStack.join('')];
    return body.some(Boolean) || asset.name !== '未命名项目';
  });
}

export function normalizeJd(value: unknown, rawText: string): { title: string; company: string; rawText: string; keywords: string[]; requirements: string[] } {
  const row = record(value);
  return {
    title: asString(row.title, '未注明职位'),
    company: asString(row.company, '未注明公司'),
    rawText,
    keywords: asStringList(row.keywords).slice(0, 12),
    requirements: asStringList(row.requirements).slice(0, 12),
  };
}

export function normalizeResume(value: unknown): ResumeProject[] {
  return listFrom(value, ['items', 'projects', 'resume']).map((item) => {
    const row = record(item);
    return {
      name: asString(row.name, '未命名项目'),
      description: asString(row.description),
      matchScore: asScore(row.matchScore),
    };
  }).filter((item) => item.description);
}

export function normalizeFeedback(value: unknown): Pick<InterviewFeedback, 'summary' | 'gaps' | 'assetReferences' | 'improvement'> {
  const row = record(value);
  return {
    summary: asString(row.summary, '模型没有给出总结。'),
    gaps: asStringList(row.gaps),
    assetReferences: asStringList(row.assetReferences ?? row.asset_references),
    improvement: asString(row.improvement),
  };
}
