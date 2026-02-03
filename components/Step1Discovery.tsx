
import React, { useState, useEffect, useRef } from 'react';
import { ProjectAsset, JDData } from '../types';
import { getAI, decodeBase64, encodeAudio, decodeAudioData } from '../services/geminiService';
import { LiveServerMessage, Modality, Type } from '@google/genai';

interface Props {
  onAssetsUpdate: (assets: ProjectAsset[]) => void;
  currentJd: JDData | null;
  existingAssets: ProjectAsset[];
}

const Step1Discovery: React.FC<Props> = ({ onAssetsUpdate, currentJd, existingAssets }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const startCall = async () => {
    try {
      setError(null);
      setIsCalling(true);
      const ai = getAI();
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const jdContext = currentJd 
        ? `候选人当前正对标 ${currentJd.company} 的 ${currentJd.title} 岗位。
           该岗位核心关键词为：${currentJd.keywords.join(', ')}。
           请在交流中，优先引导候选人挖掘与这些关键词相关的技术细节。`
        : '候选人目前尚未选定具体岗位，请进行通用的 AI/算法项目深度挖掘。';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `你是一位国内顶尖大厂（如字节跳动、阿里巴巴）的 AI 算法资深面试官。你的目标是通过语音电话引导候选人详细描述他们的项目。请使用中文交流。运用 STAR 法则进行追问。
          ${jdContext}
          特别关注：模型选型理由、业务具体痛点、解决的技术难点、以及可量化的核心指标。每次只问一个问题。开场白要专业：你好，我是面试官，咱们开始深度挖掘你的项目库，你想先聊哪一个最具代表性的项目？`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Data = encodeAudio(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
              }).catch(err => console.error(err));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData) {
              const data = msg.serverContent.modelTurn.parts[0].inlineData.data;
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(data), ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.outputTranscription) {
              currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            } else if (msg.serverContent?.inputTranscription) {
              currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
              if (currentInputTranscription.current) {
                setTranscript(prev => [...prev, { role: '用户', text: currentInputTranscription.current }]);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                setTranscript(prev => [...prev, { role: '面试官', text: currentOutputTranscription.current }]);
                currentOutputTranscription.current = '';
              }
            }
          },
          onclose: () => setIsCalling(false),
          onerror: (e) => {
            setError("语音服务波动，请重试。");
            setIsCalling(false);
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      setError("无法连接语音服务。");
      setIsCalling(false);
    }
  };

  const endCall = async () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      setIsCalling(false);
      setProcessing(true);
      
      try {
        const ai = getAI();
        const summaryResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `提取对话中的项目信息，转为 JSON。对话历史: ${JSON.stringify(transcript)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  background: { type: Type.STRING },
                  tasks: { type: Type.STRING },
                  actions: { type: Type.STRING },
                  results: { type: Type.STRING },
                  techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
                  challenges: { type: Type.STRING }
                },
                required: ["id", "name", "background", "tasks", "actions", "results", "techStack", "challenges"]
              }
            }
          }
        });
        
        const assets = JSON.parse(summaryResponse.text);
        onAssetsUpdate(assets);
        setTranscript([]);
      } catch (err) {
        setError("素材处理失败，请重试。");
      } finally {
        setProcessing(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-sm min-h-[500px] border border-slate-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">项目深度挖掘</h2>
          {currentJd ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 animate-pulse">
              <i className="fas fa-bullseye"></i> 正在针对 {currentJd.company} 进行精准挖掘
            </div>
          ) : (
            <p className="text-slate-500 text-sm">建议先去“JD解析”上传目标岗位，以获得更精准的引导</p>
          )}
        </div>

        {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

        {!isCalling && !processing && (
          <button onClick={startCall} className="w-24 h-24 rounded-full bg-blue-600 text-white flex flex-col items-center justify-center gap-2 shadow-xl hover:bg-blue-700 transition-all">
            <i className="fas fa-phone text-2xl"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">Start Call</span>
          </button>
        )}

        {isCalling && (
          <div className="flex flex-col items-center w-full">
            <div className="flex gap-1 mb-6 h-8">
              {[...Array(8)].map((_, i) => <div key={i} className="w-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}}></div>)}
            </div>
            <button onClick={endCall} className="px-6 py-2 bg-red-500 text-white rounded-full font-bold shadow-lg flex items-center gap-2">
              挂断并沉淀素材
            </button>
            <div className="mt-8 w-full max-h-40 overflow-y-auto bg-slate-50 rounded-xl p-4 text-[10px] text-slate-400">
               {transcript.map((t, i) => <div key={i} className="mb-1"><strong>{t.role}:</strong> {t.text}</div>)}
            </div>
          </div>
        )}

        {processing && <div className="text-center"><i className="fas fa-spinner animate-spin text-blue-600 text-2xl mb-2"></i><p className="text-sm">正在结构化沉淀项目细节...</p></div>}
      </div>

      <div className="bg-slate-900 rounded-3xl p-6 text-white h-fit">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><i className="fas fa-archive text-blue-400"></i> 已沉淀素材库 ({existingAssets.length})</h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {existingAssets.map((a, i) => (
            <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5">
              <p className="text-xs font-bold text-blue-300 mb-1">{a.name}</p>
              <div className="flex flex-wrap gap-1">
                {a.techStack.map((s, si) => <span key={si} className="text-[8px] px-1.5 py-0.5 bg-white/10 rounded">{s}</span>)}
              </div>
            </div>
          ))}
          {existingAssets.length === 0 && <p className="text-xs text-slate-500 italic py-10 text-center">空空如也，快开始对话吧</p>}
        </div>
      </div>
    </div>
  );
};

export default Step1Discovery;
