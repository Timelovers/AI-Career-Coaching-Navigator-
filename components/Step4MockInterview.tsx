
import React, { useState, useEffect, useRef } from 'react';
import { AppState, InterviewFeedback, JDData } from '../types';
import { getAI, decodeBase64, encodeAudio, decodeAudioData } from '../services/geminiService';
import { LiveServerMessage, Modality, Type } from '@google/genai';

interface Props {
  state: AppState;
  jd: JDData | null;
  onFeedbackAdd: (feedback: InterviewFeedback) => void;
}

const Step4MockInterview: React.FC<Props> = ({ state, jd, onFeedbackAdd }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [useVideo, setUseVideo] = useState(false);
  const [processingFeedback, setProcessingFeedback] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string, text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const frameIntervalRef = useRef<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let interval: number | undefined;
    if (isCalling && !isTimerPaused) {
      interval = window.setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling, isTimerPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startInterview = async (withVideo: boolean) => {
    try {
      setError(null);
      setRecordingUrl(null);
      setTimerSeconds(0);
      setIsTimerPaused(false);
      chunksRef.current = [];
      setIsCalling(true);
      setUseVideo(withVideo);
      setTranscript([]);
      
      const ai = getAI();
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: withVideo ? { width: 1280, height: 720 } : false 
      });

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      if (withVideo && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `你是一位来自中国顶级大厂（如字节跳动、阿里巴巴、腾讯）的资深技术专家面试官（P8/P9级别）。现在进行一场正式的技术面试。目标职位：${jd?.title} (${jd?.company})。你的面试风格：严谨、敏锐、注重落地细节与底层原理。要求：1. 考察重点：简历中的项目架构、技术难点。2. 沟通方式：中文。3. 追问策略：如果回答模糊，进行“连环追问”。`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
        callbacks: {
          onopen: () => {
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isTimerPaused) return; 
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Data = encodeAudio(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
              }).catch(err => console.error(err));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);

            if (withVideo) {
              frameIntervalRef.current = window.setInterval(() => {
                if (isTimerPaused) return;
                if (videoRef.current && canvasRef.current) {
                  const ctx = canvasRef.current.getContext('2d');
                  ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
                  const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: { data: base64Image, mimeType: 'image/jpeg' } });
                  }).catch(err => console.error(err));
                }
              }, 1500);
            }
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
                setTranscript(prev => [...prev, { role: '候选人', text: currentInputTranscription.current }]);
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                setTranscript(prev => [...prev, { role: '面试官', text: currentOutputTranscription.current }]);
                currentOutputTranscription.current = '';
              }
            }

            if (msg.serverContent?.interrupted) {
              for (const source of sourcesRef.current.values()) {
                source.stop();
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setIsCalling(false);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
          },
          onerror: (e) => {
            console.error(e);
            setError("面试服务暂时中断，请检查网络。");
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error(err);
      setError("启动面试失败：请确认麦克风和摄像头权限。");
      setIsCalling(false);
    }
  };

  const endInterview = async () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      setIsCalling(false);
      setProcessingFeedback(true);
      
      try {
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `你是一位顶级大厂面试官。请基于刚才的面试对话历史，对候选人的表现进行全面复盘分析。面试历史: ${JSON.stringify(transcript)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                assetReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvement: { type: Type.STRING }
              },
              required: ["summary", "gaps", "assetReferences", "improvement"]
            }
          }
        });
        
        const feedback = JSON.parse(response.text);
        onFeedbackAdd({
          question: "实时面试总结",
          userAnswer: "语音/视频实战面试",
          ...feedback
        });
      } catch (err) {
        console.error(err);
        setError("生成复盘报告失败。");
      } finally {
        setProcessingFeedback(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 animate-in fade-in duration-500">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl min-h-[500px] flex flex-col relative border border-slate-800">
          {!isCalling && !processingFeedback && (
            <div className="flex-grow flex flex-col items-center justify-center p-10 text-center text-white">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl rotate-12 flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20">
                <i className="fas fa-user-tie text-3xl -rotate-12"></i>
              </div>
              <h3 className="text-3xl font-bold mb-4">开启实战模拟面试</h3>
              <p className="text-slate-400 text-sm mb-10 max-w-sm leading-relaxed">
                {jd ? `正在为您准备针对 ${jd.company} 的面试环节。面试将包含录制功能，以便您回放优化表现。` : '请先在"JD解析"中选择一个目标岗位以获得针对性面试。'}
              </p>
              <div className="flex gap-4">
                <button onClick={() => startInterview(false)} className="px-10 py-4 bg-slate-800 rounded-2xl font-bold flex items-center gap-3 border border-slate-700 hover:bg-slate-750 transition-all">
                  <i className="fas fa-microphone"></i> 语音模式
                </button>
                <button onClick={() => startInterview(true)} className="px-10 py-4 bg-blue-600 rounded-2xl font-bold flex items-center gap-3 shadow-xl hover:bg-blue-500 transition-all">
                  <i className="fas fa-video"></i> 视频模式
                </button>
              </div>
            </div>
          )}

          {isCalling && (
            <div className="flex-grow flex flex-col relative">
              <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                {useVideo ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" /> : <i className="fas fa-microphone text-6xl text-blue-500/30 animate-pulse"></i>}
                <div className="absolute bottom-28 inset-x-0 px-10">
                  <div className="bg-black/40 backdrop-blur-xl p-5 rounded-[2rem] text-center border border-white/5">
                    <p className="text-white text-lg font-medium leading-relaxed">{transcript.length > 0 ? transcript[transcript.length - 1].text : "正在接入面试信道..."}</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">REC LIVE</span>
                </div>

                <div className="flex flex-col items-end gap-3 pointer-events-auto">
                  <div className="bg-black/60 backdrop-blur-xl px-5 py-3 rounded-[1.5rem] border border-white/10 flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Elapsed</span>
                      <span className={`text-2xl font-mono font-bold leading-none ${isTimerPaused ? 'text-yellow-500 animate-pulse' : 'text-white'}`}>
                        {formatTime(timerSeconds)}
                      </span>
                    </div>
                    <div className="h-10 w-px bg-white/10"></div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsTimerPaused(!isTimerPaused)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isTimerPaused ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        <i className={`fas ${isTimerPaused ? 'fa-play' : 'fa-pause'} text-xs`}></i>
                      </button>
                      <button onClick={() => setTimerSeconds(0)} className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all">
                        <i className="fas fa-undo text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 inset-x-0 p-6 flex justify-center">
                <button onClick={endInterview} className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center text-3xl hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-red-500/40">
                  <i className="fas fa-phone-slash"></i>
                </button>
              </div>
            </div>
          )}

          {processingFeedback && (
            <div className="flex-grow flex flex-col items-center justify-center text-white p-10 bg-slate-900">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h4 className="text-xl font-bold mb-2">面试结束，正在复盘</h4>
              <p className="text-slate-500 text-sm">正在深度解析您的表达漏洞与技术深度...</p>
            </div>
          )}
        </div>

        {recordingUrl && !isCalling && (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl animate-in slide-in-from-bottom-6 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-lg flex items-center gap-3"><i className="fas fa-play-circle text-blue-600"></i> 实战录像回放</h4>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Duration: {formatTime(timerSeconds)}</span>
                <a href={recordingUrl} download="Interview_Replay.webm" className="text-xs bg-slate-900 text-white px-5 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">下载视频</a>
              </div>
            </div>
            <video src={recordingUrl} controls className="w-full rounded-[2rem] bg-slate-950 shadow-inner aspect-video" />
          </div>
        )}

        <div className="mt-4">
          <h4 className="font-bold text-slate-800 text-xl mb-8 flex items-center gap-3">
             <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><i className="fas fa-clipboard-list text-sm"></i></span>
             历史复盘记录
          </h4>
          <div className="flex flex-col gap-8">
            {state.interviewHistory.map((h, i) => (
              <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Feedback Analysis</div>
                  <div className="h-px flex-grow bg-slate-100"></div>
                </div>
                <div className="mb-10">
                  <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">总体表现评估</p>
                  <p className="text-slate-800 text-lg font-semibold leading-relaxed">{h.improvement}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-red-50/50 p-8 rounded-[2rem] border border-red-100">
                    <p className="font-bold text-red-700 text-sm mb-5 flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i> 关键改进点</p>
                    <ul className="space-y-3">{h.gaps.map((g, gi) => <li key={gi} className="text-xs text-red-900 flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>{g}</li>)}</ul>
                  </div>
                  <div className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100">
                    <p className="font-bold text-blue-700 text-sm mb-5 flex items-center gap-2"><i className="fas fa-lightbulb"></i> 素材库补强建议</p>
                    <ul className="space-y-3">{h.assetReferences.map((ref, ri) => <li key={ri} className="text-xs text-blue-900 flex items-start gap-3"><span className="text-blue-500 font-bold shrink-0">★</span>{ref}</li>)}</ul>
                  </div>
                </div>
              </div>
            ))}
            {state.interviewHistory.length === 0 && (
               <div className="bg-white p-20 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                    <i className="fas fa-microphone-alt text-3xl"></i>
                  </div>
                  <p className="text-slate-400 font-medium">尚未进行模拟面试，完成面试后复盘报告将出现在这里</p>
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl sticky top-24 border border-slate-800">
          <h3 className="font-bold text-xl mb-8 flex items-center gap-3 text-blue-400"><i className="fas fa-layer-group"></i> 核心素材库</h3>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
            {state.assets.map((asset, idx) => (
              <div key={idx} className="bg-white/5 p-6 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all border-l-4 border-l-blue-500">
                <p className="font-bold text-white text-base mb-4">{asset.name}</p>
                <div className="space-y-4">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest block mb-1">量化产出</span>
                    <p className="text-slate-300 text-xs leading-relaxed">{asset.results}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest block mb-1">关键行动</span>
                    <p className="text-slate-400 text-xs leading-relaxed italic">{asset.actions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} width="320" height="240" className="hidden" />
    </div>
  );
};

export default Step4MockInterview;
