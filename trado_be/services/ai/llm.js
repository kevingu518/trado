import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AppError } from '../../errors/index.js';

// 供應商設定表。
// - native:true 走 Anthropic 官方 SDK
// - 其餘走 OpenAI 相容路徑（只差 baseURL），一次涵蓋 DeepSeek / OpenAI / Grok / Gemini
// pricing：每 1M token 的美金價格（約略值，僅供前端估算用，實際以供應商官網為準）
// docsUrl：申請 API key 的頁面
export const AI_PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    defaultModel: 'claude-opus-4-8',
    native: true,
    stable: true,
    pricing: { input: 5, output: 25 },
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
    stable: true,
    pricing: { input: 0.27, output: 1.1 },
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    baseURL: undefined, // OpenAI SDK 預設
    stable: false,
    pricing: { input: 2.5, output: 10 },
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  grok: {
    label: 'Grok (xAI)',
    defaultModel: 'grok-2-latest',
    baseURL: 'https://api.x.ai/v1',
    stable: false,
    pricing: { input: 2, output: 10 },
    docsUrl: 'https://console.x.ai/',
  },
  gemini: {
    label: 'Gemini (Google)',
    defaultModel: 'gemini-2.0-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    stable: false,
    pricing: { input: 0.1, output: 0.4 },
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
};

const MAX_TOKENS = 16000;

// 單次分析的概略 token 量，用於前端估算費用
export const TYPICAL_USAGE = { inputTokens: 6000, outputTokens: 2500 };

export function getProviderConfig(provider) {
  const cfg = AI_PROVIDERS[provider];
  if (!cfg) {
    throw new AppError(`不支援的 AI 供應商：${provider}`, 400);
  }
  return cfg;
}

/**
 * Anthropic 原生串流。只吐 text，略過 thinking。
 */
async function* anthropicStream({ apiKey, model, system, user }) {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: user }],
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

/**
 * OpenAI 相容串流（DeepSeek / OpenAI / Grok / Gemini）。
 */
async function* openAICompatStream({ apiKey, model, system, user, baseURL }) {
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * 依供應商回傳串流產生器。
 * @returns {(opts:{apiKey,model,system,user}) => AsyncGenerator<string>}
 */
export function streamChat({ provider, apiKey, model, system, user }) {
  const cfg = getProviderConfig(provider);
  const resolvedModel = model || cfg.defaultModel;
  if (cfg.native) {
    return anthropicStream({ apiKey, model: resolvedModel, system, user });
  }
  return openAICompatStream({ apiKey, model: resolvedModel, system, user, baseURL: cfg.baseURL });
}

/**
 * 測試連線：用最小成本的一次呼叫驗證金鑰/模型可用。成功回 true，失敗丟錯。
 */
export async function pingProvider({ provider, apiKey, model }) {
  const cfg = getProviderConfig(provider);
  const resolvedModel = model || cfg.defaultModel;
  if (cfg.native) {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: resolvedModel,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    });
  } else {
    const client = new OpenAI({ apiKey, baseURL: cfg.baseURL });
    await client.chat.completions.create({
      model: resolvedModel,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }],
    });
  }
  return true;
}
