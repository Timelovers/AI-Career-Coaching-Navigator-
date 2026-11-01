import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmApiError, LlmConfigError } from '../services/errors.ts';
import { toGeminiRequest } from '../services/geminiContents.ts';
import { asScore, normalizeAssets, normalizeResume, parseModelJson } from '../services/modelJson.ts';
import { openAiChatUrl, postOpenAiChat } from '../services/openaiChat.ts';
import { assertActive, defaultSettings, resolveActive } from '../services/settings.ts';

function listen(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}/v1`,
        close: () => new Promise((done, fail) => server.close((err) => err ? fail(err) : done())),
      });
    });
    server.on('error', reject);
  });
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  assert.equal(openAiChatUrl('https://api.deepseek.com'), 'https://api.deepseek.com/chat/completions');
  assert.equal(openAiChatUrl('https://api.deepseek.com/'), 'https://api.deepseek.com/chat/completions');
  assert.equal(openAiChatUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1/chat/completions');
  assert.equal(
    openAiChatUrl('https://example.com/v1/chat/completions'),
    'https://example.com/v1/chat/completions',
  );

  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseModelJson('说明如下 {"assets":[]} 完毕'), { assets: [] });
  assert.equal(asScore(85), 0.85);
  assert.equal(asScore(0.4), 0.4);
  assert.equal(asScore(150), 1);
  assert.equal(normalizeResume({ items: [{ name: '推荐', description: '负责召回', matchScore: 72 }] })[0].matchScore, 0.72);
  assert.equal(normalizeAssets({ assets: [{ name: '检索', actions: '改了倒排' }] }).length, 1);
  assert.equal(normalizeAssets({ assets: [] }).length, 0);

  const gemini = toGeminiRequest([
    { role: 'system', content: '系统' },
    { role: 'assistant', content: '先说' },
    { role: 'user', content: '第一句' },
    { role: 'user', content: '第二句' },
  ]);
  assert.equal(gemini.systemInstruction, '系统');
  assert.equal(gemini.contents[0].role, 'user');
  assert.equal(gemini.contents[1].role, 'model');
  assert.equal(gemini.contents[2].role, 'user');
  assert.match(gemini.contents[2].parts[0].text, /第一句/);
  assert.match(gemini.contents[2].parts[0].text, /第二句/);

  const deepseek = resolveActive({ ...defaultSettings(), provider: 'deepseek', deepseekApiKey: 'sk-test', deepseekModel: '' });
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com');
  assert.equal(deepseek.model, 'deepseek-chat');
  assert.throws(() => assertActive({ ...defaultSettings(), provider: 'deepseek', deepseekApiKey: '  ' }), LlmConfigError);
  assert.throws(() => assertActive({
    ...defaultSettings(),
    provider: 'openai-compatible',
    customApiKey: 'sk',
    customModel: 'm',
    customBaseUrl: 'not a url',
  }), LlmConfigError);

  const seen: { authorization?: string; path?: string; body?: { model?: string; response_format?: unknown } }[] = [];
  const server = await listen(async (req, res) => {
    const body = JSON.parse(await readBody(req)) as { model?: string; response_format?: unknown };
    seen.push({ authorization: req.headers.authorization, path: req.url, body });
    if (seen.length === 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'unknown parameter response_format' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '{"assets":[]}' } }] }));
  });

  try {
    const text = await postOpenAiChat({
      baseUrl: server.url,
      apiKey: 'sk-deepseek-test',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '请返回 JSON' }],
      json: true,
      temperature: 0,
    });
    assert.equal(text, '{"assets":[]}');
  } finally {
    await server.close();
  }

  assert.equal(seen[0].authorization, 'Bearer sk-deepseek-test');
  assert.equal(seen[0].path, '/v1/chat/completions');
  assert.equal(seen[0].body?.model, 'deepseek-chat');
  assert.ok(seen[0].body?.response_format);
  assert.equal(seen[1].body?.response_format, undefined);
  assert.equal(seen.length, 2);

  let rateHits = 0;
  const rateServer = await listen(async (_req, res) => {
    rateHits += 1;
    if (rateHits === 1) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'rate limit' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }));
  });
  try {
    const text = await postOpenAiChat({
      baseUrl: rateServer.url,
      apiKey: 'sk-rate',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
    });
    assert.equal(text, 'pong');
    assert.equal(rateHits, 2);
  } finally {
    await rateServer.close();
  }

  const secretServer = await listen(async (_req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'bad key sk-secret-value' } }));
  });
  try {
    await assert.rejects(
      () => postOpenAiChat({
        baseUrl: secretServer.url,
        apiKey: 'sk-secret-value',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'ping' }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof LlmApiError);
        assert.equal(err.message.includes('sk-secret-value'), false);
        assert.match(err.message, /密钥无效/);
        return true;
      },
    );
  } finally {
    await secretServer.close();
  }

  console.log('llm checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
