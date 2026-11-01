import React, { useEffect, useState } from 'react';
import { errorMessage } from '../services/errors';
import { testProvider } from '../services/llm';
import {
  DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_GEMINI_MODEL,
  ProviderId,
  ProviderSettings,
  hasActiveKey,
  loadSettings,
  saveSettings,
} from '../services/settings';

interface Props {
  open: boolean;
  hint?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onClearData: () => void;
}

const PROVIDERS: { id: ProviderId; title: string; detail: string }[] = [
  { id: 'gemini', title: 'Gemini', detail: 'Google GenAI' },
  { id: 'deepseek', title: 'DeepSeek', detail: 'OpenAI 兼容' },
  { id: 'openai-compatible', title: '自定义', detail: '任意兼容网关' },
];

const SettingsModal: React.FC<Props> = ({ open, hint, onClose, onSaved, onClearData }) => {
  const [draft, setDraft] = useState<ProviderSettings>(defaultDraft);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'ok' | 'err'>('ok');

  useEffect(() => {
    if (!open) return;
    setDraft(loadSettings());
    setShowKey(false);
    setNotice(null);
    setTesting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (partial: Partial<ProviderSettings>) => setDraft((prev) => ({ ...prev, ...partial }));

  const keyField = draft.provider === 'gemini'
    ? draft.geminiApiKey
    : draft.provider === 'deepseek'
      ? draft.deepseekApiKey
      : draft.customApiKey;

  const setKey = (value: string) => {
    if (draft.provider === 'gemini') patch({ geminiApiKey: value });
    else if (draft.provider === 'deepseek') patch({ deepseekApiKey: value });
    else patch({ customApiKey: value });
  };

  const modelField = draft.provider === 'gemini'
    ? draft.geminiModel
    : draft.provider === 'deepseek'
      ? draft.deepseekModel
      : draft.customModel;

  const setModel = (value: string) => {
    if (draft.provider === 'gemini') patch({ geminiModel: value });
    else if (draft.provider === 'deepseek') patch({ deepseekModel: value });
    else patch({ customModel: value });
  };

  const persist = () => {
    saveSettings(draft);
    onSaved();
  };

  const handleTest = async () => {
    setTesting(true);
    setNotice(null);
    try {
      saveSettings(draft);
      onSaved();
      const reply = await testProvider(draft);
      setNoticeTone('ok');
      setNotice(reply ? `已连通，模型回复：${reply}` : '已连通。');
    } catch (err) {
      setNoticeTone('err');
      setNotice(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('清除本机保存的项目素材、JD、简历和对话？密钥会保留。')) return;
    onClearData();
    setNoticeTone('ok');
    setNotice('业务数据已清除。');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="settings-title" className="text-xl font-bold text-slate-900">模型设置</h2>
            <p className="mt-1 text-sm text-slate-500">密钥只写入本机 localStorage，不会打进静态包，也不会上传到站点服务器。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-slate-400 hover:bg-slate-100" aria-label="关闭设置">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {hint && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{hint}</div>
        )}

        <div className="mb-5 grid grid-cols-3 gap-2">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`provider-${item.id}`}
              onClick={() => patch({ provider: item.id })}
              className={`rounded-2xl border px-2 py-3 text-left ${draft.provider === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
            >
              <span className="block text-sm font-bold text-slate-800">{item.title}</span>
              <span className="block text-[11px] text-slate-500">{item.detail}</span>
            </button>
          ))}
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">API Key</span>
          <div className="flex gap-2">
            <input
              data-testid="api-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              value={keyField}
              onChange={(event) => setKey(event.target.value)}
              placeholder={draft.provider === 'gemini' ? 'AIza...' : 'sk-...'}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={() => setShowKey((value) => !value)} className="rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-500">
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">模型 ID</span>
          <input
            data-testid="model-id"
            list={draft.provider === 'deepseek' ? 'deepseek-models' : undefined}
            value={modelField}
            onChange={(event) => setModel(event.target.value)}
            placeholder={draft.provider === 'gemini' ? DEFAULT_GEMINI_MODEL : draft.provider === 'deepseek' ? DEFAULT_DEEPSEEK_MODEL : 'your-model-id'}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          {draft.provider === 'deepseek' && (
            <datalist id="deepseek-models">
              <option value="deepseek-chat" />
              <option value="deepseek-reasoner" />
            </datalist>
          )}
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {draft.provider === 'gemini' && `默认 ${DEFAULT_GEMINI_MODEL}。可改成你的账号可用的其他 Gemini 模型 ID。结构化步骤走 generateContent。`}
            {draft.provider === 'deepseek' && `默认 ${DEFAULT_DEEPSEEK_MODEL}，适合 JD、简历和素材提取。deepseek-reasoner 更慢，适合想要更长推理的面试追问。请求发往 ${DEEPSEEK_BASE_URL}/chat/completions。`}
            {draft.provider === 'openai-compatible' && '填写网关要求的模型名，例如 gpt-4o-mini 或自建服务的模型 ID。'}
          </p>
        </label>

        {draft.provider === 'openai-compatible' && (
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Base URL</span>
            <input
              data-testid="base-url"
              value={draft.customBaseUrl}
              onChange={(event) => patch({ customBaseUrl: event.target.value })}
              placeholder="https://example.com/v1"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-slate-500">会请求 {'{Base URL}'}/chat/completions。该网关必须允许当前页面域名跨域，线上来源是 https://lijiaxing.com.cn。</p>
          </label>
        )}

        {notice && (
          <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${noticeTone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {notice}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={handleClear} className="mr-auto rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:text-red-600">
            清除业务数据
          </button>
          <button type="button" onClick={handleTest} disabled={testing} data-testid="test-provider" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            data-testid="save-settings"
            onClick={() => { persist(); onClose(); }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
        <p className="mt-4 text-[11px] text-slate-400">
          当前状态：{hasActiveKey(draft) ? '草稿里已有密钥和模型' : '尚未填写可用密钥'}。保存后刷新页面仍然有效。
        </p>
      </div>
    </div>
  );
};

function defaultDraft(): ProviderSettings {
  return loadSettings();
}

export default SettingsModal;
