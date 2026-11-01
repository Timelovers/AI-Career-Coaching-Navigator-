export interface GeminiTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export function toGeminiRequest(messages: { role: string; content: string }[]): {
  systemInstruction?: string;
  contents: GeminiTurn[];
} {
  const system = messages
    .filter((message) => message.role === 'system' && message.content.trim())
    .map((message) => message.content.trim())
    .join('\n\n');

  const turns: { role: 'user' | 'model'; text: string }[] = [];
  for (const message of messages) {
    if (message.role === 'system' || !message.content.trim()) continue;
    const role = message.role === 'assistant' || message.role === 'model' ? 'model' : 'user';
    const previous = turns[turns.length - 1];
    if (previous && previous.role === role) previous.text += `\n\n${message.content.trim()}`;
    else turns.push({ role, text: message.content.trim() });
  }

  if (turns.length === 0) turns.push({ role: 'user', text: '请继续。' });
  if (turns[0].role !== 'user') turns.unshift({ role: 'user', text: '请根据要求开始。' });

  return {
    systemInstruction: system || undefined,
    contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
  };
}
