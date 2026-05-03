import { useCallback, useRef, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { AudioMutedOutlined, AudioOutlined, LoadingOutlined } from '@ant-design/icons';

interface AudioRecorderProps {
  onResult: (text: string, audioBlob?: Blob) => void;
  onRecordingChange: (isRecording: boolean) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function mergeChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
}

function AudioRecorder({ onResult, onRecordingChange, disabled = false, onError }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(16000);

  const cleanupResources = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop failures after recorder shutdown
      }
      recognitionRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];
      transcriptRef.current = '';
      interimTranscriptRef.current = '';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
        },
      });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        cleanupResources();
        onError?.('当前浏览器不支持音频上下文，无法录制语音。');
        return;
      }

      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      sampleRateRef.current = audioContext.sampleRate;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (RecognitionCtor) {
        const recognition = new RecognitionCtor();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          let finalizedText = '';
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            const candidate = result[0]?.transcript?.trim() || '';
            if (!candidate) {
              continue;
            }
            if (result.isFinal) {
              finalizedText += `${candidate} `;
            } else {
              interimText += `${candidate} `;
            }
          }
          if (finalizedText.trim()) {
            transcriptRef.current = `${transcriptRef.current} ${finalizedText}`.trim();
          }
          interimTranscriptRef.current = interimText.trim();
        };
        recognition.onerror = () => {
          recognitionRef.current = null;
        };
        recognition.onend = () => {
          recognitionRef.current = null;
        };
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          recognitionRef.current = null;
        }
      }

      setIsRecording(true);
      onRecordingChange(true);
    } catch {
      cleanupResources();
      setIsRecording(false);
      onRecordingChange(false);
      onError?.('无法访问麦克风，请检查浏览器权限。');
    }
  }, [cleanupResources, onError, onRecordingChange]);

  const stopRecording = useCallback(() => {
    const merged = mergeChunks(chunksRef.current);
    const wavBlob = encodeWav(merged, sampleRateRef.current);
    const transcript = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
    cleanupResources();
    chunksRef.current = [];
    transcriptRef.current = '';
    interimTranscriptRef.current = '';
    setIsRecording(false);
    onRecordingChange(false);
    onResult(transcript, wavBlob);
  }, [cleanupResources, onRecordingChange, onResult]);

  const tooltipTitle = disabled && !isRecording
    ? 'AI 正在生成追问，暂时不能开始新一轮录音'
    : isRecording
      ? '点击结束录音并把原始语音上传给后端识别'
      : '点击开始录音，系统会把原始语音交给后端做识别和表达分析';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tooltip title={tooltipTitle}>
        <Button
          shape="circle"
          size="large"
          type={isRecording ? 'primary' : 'default'}
          danger={isRecording}
          icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
          onClick={() => (isRecording ? stopRecording() : startRecording())}
          disabled={disabled && !isRecording}
          style={isRecording ? { animation: 'pulse 1.5s ease-in-out infinite' } : undefined}
        />
      </Tooltip>

      {isRecording ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#b44945',
            fontSize: 13,
          }}
        >
          <LoadingOutlined spin />
          <span>正在录音，松开后将由后端直接识别语音...</span>
        </div>
      ) : null}
    </div>
  );
}

export default AudioRecorder;
