
import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { ProjectAsset, JDData, ResumeProject } from "../types";

export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Robust handling for transient API errors (503, 429) with exponential backoff.
 */
const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1500): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.status === 503 || 
        error.status === 429 || 
        error.message?.toLowerCase().includes('unavailable') ||
        error.message?.toLowerCase().includes('busy');
      
      if (attempt < maxRetries && isRetryable) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`API call failed (Attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, error);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  throw lastError;
};

// 解析 JD 并提取核心要求
export const analyzeJD = async (text: string): Promise<JDData> => {
  return await callWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `请分析以下职位描述（JD）并提取结构化信息（使用中文）。
      JD 文本: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: '职位名称' },
            company: { type: Type.STRING, description: '公司名称' },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: '核心技术栈和关键词' },
            requirements: { type: Type.ARRAY, items: { type: Type.STRING }, description: '核心胜任力要求' },
          },
          required: ["title", "company", "keywords", "requirements"]
        }
      }
    });
    
    const result = JSON.parse(response.text);
    return { ...result, rawText: text };
  });
};

// 生成 STAR 简历描述（中国互联网风格）
export const generateResumeItems = async (assets: ProjectAsset[], jd: JDData): Promise<ResumeProject[]> => {
  return await callWithRetry(async () => {
    const ai = getAI();
    const prompt = `你是一位专业的技术猎头，请基于提供的“项目素材包”和“目标职位JD”，为候选人撰写极具竞争力的简历项目描述。
    
    要求：
    1. 使用 STAR 法则（情境、任务、行动、结果）。
    2. 语言风格专业、干练，使用“主导”、“负责”、“优化”、“落地”等动词。
    3. 必须包含量化指标（如：性能提升 30%、准确率达到 95% 等）。
    4. 重点突出与 JD 关键词（${jd.keywords.join(', ')}）匹配的技术细节。
    
    项目素材: ${JSON.stringify(assets)}
    目标职位: ${JSON.stringify(jd)}
    
    请直接返回 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: '项目名称' },
              description: { type: Type.STRING, description: '使用 STAR 法则撰写的中文详细描述' },
              matchScore: { type: Type.NUMBER, description: '与 JD 的匹配度 (0-1)' }
            },
            required: ["name", "description", "matchScore"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  });
};

export const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeAudio = (data: Float32Array) => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
