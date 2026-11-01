type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

export function speechInputSupported(): boolean {
  return recognitionCtor() !== null;
}

export function startDictation(handlers: {
  onText: (transcript: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError('当前浏览器不支持语音识别，请改用文字输入。');
    handlers.onEnd();
    return () => undefined;
  }

  const recognition = new Ctor();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0]?.transcript ?? '';
    }
    handlers.onText(transcript.trim());
  };
  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      handlers.onError('麦克风权限被拒绝，已改用文字输入。');
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      handlers.onError('语音识别不可用，请改用文字输入。');
    }
    handlers.onEnd();
  };
  recognition.onend = () => handlers.onEnd();

  try {
    recognition.start();
  } catch {
    handlers.onError('无法启动麦克风，请改用文字输入。');
    handlers.onEnd();
    return () => undefined;
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
  };
}
