import { ChatTurn, JDData, ProjectAsset, ResumeProject } from '../types';
import { completeChat, completeJson } from './llm';
import { normalizeAssets, normalizeFeedback, normalizeJd, normalizeResume } from './modelJson';
import { ProviderSettings } from './settings';

export interface InterviewContext {
  jd: JDData | null;
  assets: ProjectAsset[];
  resume: ResumeProject[];
}

function jdBrief(jd: JDData | null): string {
  if (!jd) return '候选人还没有选定目标岗位。';
  return [
    `公司：${jd.company}`,
    `职位：${jd.title}`,
    `关键词：${jd.keywords.join('、') || '无'}`,
    `要求：${jd.requirements.join('；') || '无'}`,
  ].join('\n');
}

export async function coachTurn(history: ChatTurn[], jd: JDData | null, settings?: ProviderSettings): Promise<string> {
  const system = `你是资深技术面试官，用中文帮候选人把项目经历挖成可以写进简历的证据。
${jdBrief(jd)}
规则：
- 每次只问一个问题
- 围绕背景、任务、行动、结果、技术栈和难点追问
- 优先追问与目标岗位关键词有关、且候选人还没说清的细节
- 引导对方给出真实指标，但不要替对方编造数字
- 回答短一些，不要直接生成完整简历`;

  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];
  if (history.length === 0) {
    messages.push({ role: 'user', content: '请先请我介绍一个代表性项目，只问一个问题。' });
  }
  return completeChat(messages, { temperature: 0.6, settings });
}

export async function extractAssetsFromText(text: string, settings?: ProviderSettings): Promise<ProjectAsset[]> {
  const parsed = await completeJson(`你是技术简历素材编辑。把候选人的原话整理成结构化项目，使用中文。
规则：
- 只记录材料里明确出现的事实
- 不要编造公司、指标、人数、百分比或技术栈
- 没有量化结果时，results 写「未提供量化结果」
- 一个项目一条
- 返回 {"assets":[{"name":"","background":"","tasks":"","actions":"","results":"","techStack":[],"challenges":""}]}
- 没有可识别的项目时返回 {"assets":[]}`, text, settings);
  return normalizeAssets(parsed);
}

export async function analyzeJdText(text: string, settings?: ProviderSettings): Promise<Omit<JDData, 'id'>> {
  const parsed = await completeJson(`你是招聘 JD 分析助手。从职位描述中提取结构化信息，使用中文。
无法确定时写「未注明」，不要猜测公司或职级。
返回 {"title":"","company":"","keywords":[],"requirements":[]}
keywords 是技术栈和能力关键词，requirements 是胜任力要点，各不超过 8 条。`, text, settings);
  return normalizeJd(parsed, text);
}

export async function generateResume(assets: ProjectAsset[], jd: JDData, settings?: ProviderSettings): Promise<ResumeProject[]> {
  const parsed = await completeJson(`你是技术简历教练。根据候选人的真实项目素材和目标 JD，写出可以放进简历的项目描述。使用中文。
规则：
- 只用素材里已有的事实，不得编造指标、团队规模或未出现的技术
- 素材里没有数字时，用「（待补充：具体指标）」占位，不要虚构百分比
- 每条按 STAR 写成 3 到 6 行，动词开头，只突出和 JD 真正重合的部分
- matchScore 是 0 到 1 的小数，按证据重合度打分，不要一律给高分
- 每个素材项目输出一条
返回 {"items":[{"name":"","description":"","matchScore":0.5}]}`, `目标职位：\n${JSON.stringify(jd)}\n\n项目素材：\n${JSON.stringify(assets)}`, settings);
  return normalizeResume(parsed);
}

export async function interviewTurn(history: ChatTurn[], context: InterviewContext, settings?: ProviderSettings): Promise<string> {
  const messages = [
    {
      role: 'system' as const,
      content: `你是资深技术面试官，用中文进行模拟面试。
${jdBrief(context.jd)}
候选人素材：${JSON.stringify(context.assets)}
简历草稿：${JSON.stringify(context.resume)}
规则：
- 每次只问一个问题
- 问题要落到素材里的行动、取舍或结果
- 不要替候选人编造成果，也不要输出评分或范文
- 回答含糊时追问一个具体细节
- 直接输出问题本身`,
    },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
  ];
  if (history.length === 0) {
    messages.push({ role: 'user', content: '请开始面试，提出第一个问题。' });
  }
  return completeChat(messages, { temperature: 0.6, settings });
}

export async function interviewReview(history: ChatTurn[], context: InterviewContext, settings?: ProviderSettings) {
  const transcript = history.map((turn) => `${turn.role === 'user' ? '候选人' : '面试官'}：${turn.content}`).join('\n');
  const parsed = await completeJson(`你是面试复盘教练。根据对话、候选人素材和目标 JD 给出反馈，使用中文。
规则：
- 只评价对话里出现的回答，不要编造候选人没说过的成果
- assetReferences 必须引用素材库中的项目名称，说明哪段经历可以补强回答；没有可用素材时返回空数组
- gaps 写具体缺口，不要空泛的「加强沟通」
返回 {"summary":"","gaps":[],"assetReferences":[],"improvement":""}`, `目标职位：\n${jdBrief(context.jd)}\n\n素材库：\n${JSON.stringify(context.assets)}\n\n对话：\n${transcript}`, settings);
  return normalizeFeedback(parsed);
}
