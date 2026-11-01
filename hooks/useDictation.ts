import { useEffect, useRef, useState } from 'react';
import { speechInputSupported, startDictation } from '../services/speech';

export function useDictation(onTranscript: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  };

  const start = (base = '') => {
    setError(null);
    const prefix = base.trim();
    let failed = false;
    stopRef.current = startDictation({
      onText: (transcript) => {
        onTranscriptRef.current(prefix && transcript ? `${prefix} ${transcript}` : transcript || prefix);
      },
      onError: (message) => {
        failed = true;
        setError(message);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (!failed) setListening(true);
  };

  useEffect(() => () => stopRef.current?.(), []);

  return {
    listening,
    error,
    supported: speechInputSupported(),
    start,
    stop,
  };
}
