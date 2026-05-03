import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Modal,
  Space,
  Steps,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  AudioOutlined,
  ClockCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
  SendOutlined,
  SoundOutlined,
  StopOutlined,
} from '@ant-design/icons';
import AudioRecorder from '@/components/AudioRecorder';
import ChatBubble from '@/components/ChatBubble';
import { endInterview, getInterviewDetail, sendMessageStream } from '@/api/interview';
import useInterviewStore, { type InterviewStage } from '@/stores/useInterviewStore';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

type SpeechStyle = 'warm' | 'neutral' | 'pressing' | 'encouraging';

const stageMap: Record<InterviewStage, { label: string; index: number }> = {
  opening: { label: '开场引导', index: 0 },
  self_intro: { label: '自我介绍', index: 1 },
  technical: { label: '技术问答', index: 2 },
  project: { label: '项目深挖', index: 3 },
  scenario: { label: '场景追问', index: 4 },
  qa: { label: '反问交流', index: 5 },
  closing: { label: '结束总结', index: 6 },
};

const positionLabelMap: Record<string, string> = {
  java_backend: 'Java 后端',
  web_frontend: 'Web 前端',
  embedded: '嵌入式开发',
  python_algorithm: 'Python 算法',
  software_testing: '测试工程师',
  devops: 'DevOps',
};

function mapBackendStage(stage?: string): InterviewStage | null {
  if (!stage) return null;
  const mapping: Record<string, InterviewStage> = {
    intro: 'self_intro',
    basic: 'technical',
    project: 'project',
    scenario: 'scenario',
    reverse_question: 'qa',
    summary: 'closing',
  };
  return mapping[stage] ?? null;
}

function detectSpeechStyle(text: string): SpeechStyle {
  const normalized = text.trim();
  if (!normalized) return 'neutral';

  const encouragingSignals = ['做得不错', '继续', '很好', '可以展开讲', '这个思路不错'];
  const pressingSignals = ['为什么', '如果线上', '具体怎么做', '这还不够', '再深入一点'];
  const warmSignals = ['先别紧张', '我们继续', '慢慢来', '请你介绍一下'];

  if (encouragingSignals.some((item) => normalized.includes(item))) return 'encouraging';
  if (pressingSignals.some((item) => normalized.includes(item))) return 'pressing';
  if (warmSignals.some((item) => normalized.includes(item))) return 'warm';
  return 'neutral';
}

function getSpeechStyleConfig(style: SpeechStyle): { rate: number; pitch: number; volume: number; label: string } {
  switch (style) {
    case 'warm':
      return { rate: 0.96, pitch: 1.04, volume: 1, label: '温和引导' };
    case 'encouraging':
      return { rate: 0.93, pitch: 1.06, volume: 1, label: '鼓励反馈' };
    case 'pressing':
      return { rate: 0.91, pitch: 0.95, volume: 1, label: '压力追问' };
    default:
      return { rate: 0.98, pitch: 1, volume: 1, label: '标准面试' };
  }
}

function chooseBestChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const zhVoices = voices.filter((voice) => voice.lang?.toLowerCase().includes('zh'));
  if (zhVoices.length === 0) return null;
  const preferredKeywords = ['xiaoxiao', 'xiaoyi', 'yunxi', 'yunyang', 'huihui', 'zh-cn'];
  for (const keyword of preferredKeywords) {
    const matched = zhVoices.find(
      (voice) => voice.name.toLowerCase().includes(keyword) || voice.lang.toLowerCase().includes(keyword),
    );
    if (matched) return matched;
  }
  return zhVoices[0];
}

function Interview() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [positionType, setPositionType] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarPulse, setSidebarPulse] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const [lastAiMessage, setLastAiMessage] = useState('');
  const [lastSpeechStyle, setLastSpeechStyle] = useState<SpeechStyle>('neutral');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousStageRef = useRef<InterviewStage | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const liveSpeechBufferRef = useRef('');
  const shouldAutoplayInitialAiRef = useRef(false);

  const {
    messages,
    currentStage,
    isLoading,
    questionCount,
    acceptedAnswerCount,
    lastAnswerAccepted,
    lastAnswerFeedback,
    setSessionId,
    addMessage,
    updateLastMessage,
    setStage,
    setLoading,
    incrementQuestion,
    markAnswerEvaluation,
    seedAcceptedAnswerCount,
    reset,
  } = useInterviewStore();

  const estimateMeaningfulAnswer = (content: string, stage?: string) => {
    const text = content.replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const compact = text.replace(/\s+/g, '').toLowerCase();
    if (['好', '嗯', 'hi', 'hello', 'ok', '好的'].includes(compact)) {
      return false;
    }
    return text.length >= (stage === 'intro' ? 10 : 8);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speechQueueRef.current = [];
    liveSpeechBufferRef.current = '';
    speechUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const enqueueBrowserSpeech = useCallback(
    (text: string, style: SpeechStyle) => {
      if (!autoSpeakEnabled || !text.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = chooseBestChineseVoice(voices);
      const config = getSpeechStyleConfig(style);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.voice = bestVoice;
      utterance.volume = config.volume;
      utterance.rate = Math.max(0.75, Math.min(1.15, config.rate * 0.96));
      utterance.pitch = Math.max(0.8, Math.min(1.2, config.pitch));
      utterance.onstart = () => {
        speechUtteranceRef.current = utterance;
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        speechQueueRef.current = speechQueueRef.current.slice(1);
        if (speechQueueRef.current.length === 0) {
          speechUtteranceRef.current = null;
          setIsSpeaking(false);
        }
      };
      utterance.onerror = () => {
        speechUtteranceRef.current = null;
        setIsSpeaking(false);
        speechQueueRef.current = [];
      };
      speechQueueRef.current.push(utterance);
      window.speechSynthesis.speak(utterance);
    },
    [autoSpeakEnabled],
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!autoSpeakEnabled || !text.trim()) return;
      stopSpeaking();
      const style = detectSpeechStyle(text);
      setLastSpeechStyle(style);

      const segments = text
        .split(/(?<=[。！？!?])/)
        .map((item) => item.trim())
        .filter(Boolean);

      segments.forEach((segment) => enqueueBrowserSpeech(segment, style));
      if (segments.length === 0) {
        enqueueBrowserSpeech(text, style);
      }
    },
    [autoSpeakEnabled, enqueueBrowserSpeech, stopSpeaking],
  );

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < 1100;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    reset();
    setSessionId(sessionId);
    setElapsedTime(0);
    setPositionType('');
    setLastAiMessage('');
    shouldAutoplayInitialAiRef.current = false;
    stopSpeaking();

    getInterviewDetail(Number(sessionId))
      .then((detail) => {
        if (cancelled) return;

        if (detail.position_type) {
          setPositionType(detail.position_type);
        }

        if (Array.isArray(detail.messages) && detail.messages.length > 0) {
          const acceptedCount = detail.messages.filter(
            (msg) => msg.role === 'candidate' && estimateMeaningfulAnswer(msg.content, msg.stage),
          ).length;
          seedAcceptedAnswerCount(acceptedCount);
          detail.messages.forEach((msg) => {
            addMessage({
              id: String(msg.id),
              role: msg.role,
              content: msg.content,
              timestamp: msg.created_at,
            });
          });

          const latestAi = [...detail.messages].reverse().find((msg) => msg.role === 'interviewer' && msg.content?.trim());
          if (latestAi?.content) {
            setLastAiMessage(latestAi.content);
            setLastSpeechStyle(detectSpeechStyle(latestAi.content));
            shouldAutoplayInitialAiRef.current = true;
          }
        }

        const mappedStage = mapBackendStage(detail.current_stage);
        if (mappedStage) {
          setStage(mappedStage);
          previousStageRef.current = mappedStage;
        }
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = '欢迎来到本次模拟面试。请先用一到两分钟做一个简洁、有重点的自我介绍。';
        addMessage({
          id: 'welcome-fallback',
          role: 'interviewer',
          content: fallback,
          timestamp: new Date().toISOString(),
        });
        setLastAiMessage(fallback);
        setLastSpeechStyle(detectSpeechStyle(fallback));
        shouldAutoplayInitialAiRef.current = true;
      });

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      cancelled = true;
      stopSpeaking();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionId, addMessage, reset, seedAcceptedAnswerCount, setSessionId, setStage, stopSpeaking]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!shouldAutoplayInitialAiRef.current || !lastAiMessage.trim() || !autoSpeakEnabled) {
      return;
    }
    shouldAutoplayInitialAiRef.current = false;
    void speakText(lastAiMessage);
  }, [autoSpeakEnabled, lastAiMessage, speakText]);

  useEffect(() => {
    if (!previousStageRef.current) {
      previousStageRef.current = currentStage;
      return;
    }
    if (previousStageRef.current !== currentStage) {
      previousStageRef.current = currentStage;
      setSidebarPulse(true);
      const timeout = window.setTimeout(() => setSidebarPulse(false), 1800);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [currentStage]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const conversationStatus = useMemo(() => {
    if (isRecording) {
      return {
        color: 'error',
        text: '正在语音回答',
        hint: '保持自然表达，尽量把结论、思路和结果讲完整。',
      };
    }
    if (isLoading) {
      return {
        color: 'processing',
        text: 'AI 面试官正在组织追问',
        hint: '正在根据你的回答组织下一轮问题，请稍等。',
      };
    }
    if (isSpeaking) {
      return {
        color: 'warning',
        text: 'AI 面试官正在提问',
        hint: '先听完问题，再结合项目经验和技术细节作答。',
      };
    }
    return {
      color: 'success',
      text: '轮到你回答了',
      hint: '建议先给结论，再补充思路、方案和结果。',
    };
  }, [isLoading, isRecording, isSpeaking]);
  const latestInterviewerMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'interviewer' && !messages[i].isLoading) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const handleReplayAi = () => {
    if (!lastAiMessage.trim()) {
      message.info('当前还没有可回放的提问。');
      return;
    }
    void speakText(lastAiMessage);
  };

  const handleSend = async (text: string, audioBlob?: Blob) => {
    if ((!text.trim() && !audioBlob) || !sessionId || isLoading) return;

    stopSpeaking();
    liveSpeechBufferRef.current = '';

    addMessage({
      id: `candidate-${Date.now()}`,
      role: 'candidate',
      content: text.trim() || '语音回答',
      timestamp: new Date().toISOString(),
    });
    setInputText('');

    const loadingId = `ai-loading-${Date.now()}`;
    addMessage({
      id: loadingId,
      role: 'interviewer',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    });
    setLoading(true);

    try {
      let fullText = '';
      let finalStage = '';
      let finalAccepted = true;
      let finalFeedback: string | null = null;

      await sendMessageStream(
        Number(sessionId),
        text.trim(),
        (event) => {
          if (event.type === 'delta') {
            const chunk = String(event.data.content || '');
            fullText += chunk;
            updateLastMessage(fullText);

            liveSpeechBufferRef.current += chunk;
            const segments = liveSpeechBufferRef.current.split(/(?<=[。！？!?])/);
            liveSpeechBufferRef.current = segments.pop() || '';
            const style = detectSpeechStyle(fullText);
            setLastSpeechStyle(style);
            segments
              .map((item) => item.trim())
              .filter(Boolean)
              .forEach((segment) => enqueueBrowserSpeech(segment, style));
            return;
          }

          if (event.type === 'done') {
            finalStage = String(event.data.stage || '');
            finalAccepted = event.data.accepted !== false;
            finalFeedback = (event.data.feedback as string | null) ?? null;
            return;
          }

          if (event.type === 'error') {
            throw new Error(String(event.data.detail || 'Streaming reply failed'));
          }
        },
        audioBlob,
      );

      if (liveSpeechBufferRef.current.trim()) {
        const style = detectSpeechStyle(fullText);
        enqueueBrowserSpeech(liveSpeechBufferRef.current.trim(), style);
        liveSpeechBufferRef.current = '';
      }

      setLastAiMessage(fullText);
      const mappedStage = mapBackendStage(finalStage);
      if (mappedStage) {
        setStage(mappedStage);
      }
      markAnswerEvaluation(finalAccepted, finalFeedback);
      if (finalAccepted) {
        incrementQuestion();
      } else if (finalFeedback) {
        message.warning(finalFeedback);
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      updateLastMessage('当前回复生成失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleAudioResult = (text: string, audioBlob?: Blob) => {
    void handleSend(text, audioBlob);
  };

  const handleRecordingChange = (recording: boolean) => {
    setIsRecording(recording);
    if (recording) {
      stopSpeaking();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(inputText);
    }
  };

  const handleEndInterview = () => {
    const riskContent =
      acceptedAnswerCount < 2
        ? '当前有效回答较少，现在结束后，本次面试总结可能不够完整。建议再完成几轮关键问答。'
        : '结束后会生成本次面试总结，并进入结果页面。';

    Modal.confirm({
      title: '确认结束本次面试吗？',
      content: riskContent,
      okText: '确认结束',
      cancelText: '继续面试',
      onOk: async () => {
        if (!sessionId) return;
        try {
          stopSpeaking();
          await endInterview(Number(sessionId));
          message.success('面试已结束，正在生成本次总结。');
          navigate(`/report/${sessionId}`);
        } catch {
          message.error('结束面试失败，请稍后重试。');
        }
      },
    });
  };

  const sidebarContent = (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card className="paper-panel" bodyStyle={{ padding: 18 }}>
        <Text type="secondary">面试方向</Text>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>
          {positionType ? positionLabelMap[positionType] || positionType : '本场面试'}
        </div>
        <Tag style={{ marginTop: 12, borderRadius: 999, paddingInline: 12, lineHeight: '30px' }}>
          当前环节：{stageMap[currentStage]?.label ?? '进行中'}
        </Tag>
      </Card>

      <Card className="paper-panel" bodyStyle={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div style={{ padding: '14px 14px 12px', borderRadius: 16, background: 'rgba(42,92,85,0.08)' }}>
            <Text type="secondary">
              <ClockCircleOutlined style={{ marginRight: 6 }} />
              面试时长
            </Text>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{formatTime(elapsedTime)}</div>
          </div>
          <div style={{ padding: '14px 14px 12px', borderRadius: 16, background: 'rgba(184,106,61,0.08)' }}>
            <Text type="secondary">
              <QuestionCircleOutlined style={{ marginRight: 6 }} />
              已完成轮次
            </Text>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{questionCount}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: '14px 14px 12px', borderRadius: 16, background: 'rgba(92,67,95,0.08)' }}>
          <Text type="secondary">稳定作答轮次</Text>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{acceptedAnswerCount}</div>
        </div>
      </Card>

      <Card
        className="paper-panel"
        bodyStyle={{ padding: 18 }}
        style={{
          boxShadow: sidebarPulse ? '0 0 0 2px rgba(42,92,85,0.16), 0 18px 40px rgba(37,30,20,0.12)' : undefined,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>面试官语音</div>
            <Text type="secondary">面试官发问时自动播放</Text>
          </div>
          <Switch checked={autoSpeakEnabled} onChange={setAutoSpeakEnabled} />
        </div>

        <div style={{ marginTop: 14 }}>
          <Text type="secondary">当前提问风格</Text>
          <div style={{ marginTop: 8 }}>
            <Tag color="processing" style={{ borderRadius: 999 }}>
              {getSpeechStyleConfig(lastSpeechStyle).label}
            </Tag>
          </div>
        </div>

        <Space wrap size={10} style={{ marginTop: 16 }}>
          <Button icon={<SoundOutlined />} onClick={handleReplayAi} disabled={!lastAiMessage.trim()} style={{ borderRadius: 12 }}>
            回放提问
          </Button>
          <Button icon={<StopOutlined />} onClick={stopSpeaking} disabled={!isSpeaking} style={{ borderRadius: 12 }}>
            静音
          </Button>
        </Space>
      </Card>

      {lastAnswerAccepted === false && lastAnswerFeedback ? (
        <Alert type="warning" showIcon message="上一轮回答需要补强" description={lastAnswerFeedback} style={{ borderRadius: 16 }} />
      ) : null}

      {acceptedAnswerCount < 2 ? (
        <Alert
          type="info"
          showIcon
          message="建议再完成至少 2 轮关键问答"
          description="这样生成的面试总结会更完整，也更容易看出你的稳定优势和短板。"
          style={{ borderRadius: 16 }}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="当前内容已经足够生成面试总结"
          description="如果你想完成一次快速演练，现在结束也能得到较完整的反馈。"
          style={{ borderRadius: 16 }}
        />
      )}

      <Button
        type="primary"
        danger
        icon={<PoweroffOutlined />}
        onClick={handleEndInterview}
        block
        size="large"
        style={{ height: 48, borderRadius: 14, fontWeight: 700 }}
      >
        结束本次面试
      </Button>
    </div>
  );

  const collapsedRail = (
    <div
      style={{
        width: 72,
        borderLeft: '1px solid var(--line-soft)',
        background: 'rgba(255,250,242,0.72)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '18px 10px',
        gap: 14,
      }}
    >
      <Tooltip title="展开控制面板">
        <Button shape="circle" icon={<MenuUnfoldOutlined />} onClick={() => setSidebarCollapsed(false)} />
      </Tooltip>
      <Tag color="processing" style={{ writingMode: 'vertical-rl', borderRadius: 999 }}>
        {stageMap[currentStage]?.label ?? '进行中'}
      </Tag>
      <Tag style={{ writingMode: 'vertical-rl', borderRadius: 999 }}>
        {formatTime(elapsedTime)}
      </Tag>
      <Button danger shape="circle" icon={<PoweroffOutlined />} onClick={handleEndInterview} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', padding: '24px 0', overflow: 'hidden' }}>
      <div
        className="app-shell"
        style={{ width: 'calc(100vw - 24px)', maxWidth: 1680, height: 'calc(100vh - 48px)' }}
      >
        <div
          className="editorial-panel"
          style={{
            overflow: 'hidden',
            background: 'rgba(255,252,246,0.78)',
            height: '100%',
          }}
        >
          <div
            style={{
              padding: '24px 20px 20px',
              borderBottom: '1px solid var(--line-soft)',
              background:
                'linear-gradient(135deg, rgba(24,22,31,0.98) 0%, rgba(35,32,43,0.96) 56%, rgba(42,92,85,0.9) 100%)',
              color: 'var(--text-inverse)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.76)' }}>
                  Interview Session
                </div>
                <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 32, margin: '14px 0 8px' }}>
                  当前模拟正在进行
                </Title>
                <Paragraph style={{ color: 'rgba(248,241,231,0.74)', marginBottom: 0, maxWidth: 720 }}>
                  保持回答有结构、先结论后展开，必要时结合项目经验和实际场景说明你的思考过程。
                </Paragraph>
              </div>

              <Space wrap size={10}>
                <Tag style={{ borderRadius: 999, paddingInline: 12, lineHeight: '30px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
                  {positionType ? positionLabelMap[positionType] || positionType : '本场面试'}
                </Tag>
                <Tag style={{ borderRadius: 999, paddingInline: 12, lineHeight: '30px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
                  {stageMap[currentStage]?.label ?? '进行中'}
                </Tag>
                <Tag color={conversationStatus.color} style={{ borderRadius: 999, paddingInline: 12, lineHeight: '30px' }}>
                  {conversationStatus.text}
                </Tag>
                {isMobile ? (
                  <Button icon={<MenuUnfoldOutlined />} onClick={() => setMobileDrawerOpen(true)} style={{ borderRadius: 12 }}>
                    控制面板
                  </Button>
                ) : (
                  <Button
                    icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                    style={{ borderRadius: 12 }}
                  >
                    {sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
                  </Button>
                )}
              </Space>
            </div>

            <div style={{ marginTop: 18 }}>
              <Steps
                className="interview-stage-steps"
                current={stageMap[currentStage]?.index ?? 0}
                items={Object.values(stageMap).map((item) => ({ title: item.label }))}
                style={{ '--antd-steps-title-color': '#fff' } as React.CSSProperties}
              />
            </div>

            {isSpeaking ? (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 16px',
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  background:
                    'linear-gradient(135deg, rgba(214,165,93,0.18), rgba(255,255,255,0.08) 40%, rgba(42,92,85,0.22))',
                  border: '1px solid rgba(214,165,93,0.22)',
                  boxShadow: '0 16px 34px rgba(13,14,18,0.18)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'radial-gradient(circle, rgba(214,165,93,0.94), rgba(42,92,85,0.94))',
                      boxShadow: '0 0 0 8px rgba(214,165,93,0.08)',
                    }}
                  >
                    <SoundOutlined style={{ color: '#fff', fontSize: 18 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#f8f1e7' }}>AI 面试官正在提问</div>
                    <div style={{ color: 'rgba(248,241,231,0.76)', fontSize: 13 }}>
                      请先听完问题，再结合项目经验和技术细节作答
                    </div>
                  </div>
                </div>

                <div
                  aria-hidden
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 4,
                    height: 24,
                    paddingInline: 6,
                  }}
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: `${10 + (i % 3) * 5}px`,
                        borderRadius: 999,
                        background: i % 2 === 0 ? '#d6a55d' : '#f8f1e7',
                        transformOrigin: 'bottom center',
                        animation: `aiWaveBounce ${0.7 + i * 0.05}s ease-in-out ${i * 0.08}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', minHeight: 0, height: 'calc(100% - 170px)' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 20px 0' }}>
                <Alert
                  type="info"
                  showIcon
                  message={conversationStatus.text}
                  description={conversationStatus.hint}
                  style={{
                    borderRadius: 16,
                    border: isSpeaking ? '1px solid rgba(214,165,93,0.32)' : undefined,
                    boxShadow: isSpeaking ? '0 16px 34px rgba(37,30,20,0.08)' : undefined,
                    background: isSpeaking
                      ? 'linear-gradient(135deg, rgba(255,247,231,0.98), rgba(238,248,245,0.96))'
                      : undefined,
                  }}
                  action={
                    <Space wrap>
                      <Button size="small" icon={<SoundOutlined />} onClick={handleReplayAi} disabled={!lastAiMessage.trim()}>
                        回放
                      </Button>
                      <Button size="small" icon={<StopOutlined />} onClick={stopSpeaking} disabled={!isSpeaking}>
                        静音
                      </Button>
                    </Space>
                  }
                />
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '18px 20px 20px',
                  background:
                    'radial-gradient(circle at top left, rgba(184,106,61,0.06), transparent 24%), radial-gradient(circle at top right, rgba(42,92,85,0.06), transparent 22%), linear-gradient(180deg, rgba(255,250,242,0.82), rgba(244,238,227,0.9))',
                }}
              >
                <div style={{ maxWidth: 1180, marginRight: 'auto' }}>
                  {messages.length === 0 ? (
                    <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
                      <Title level={4} className="display-title" style={{ marginTop: 0 }}>
                        正在进入面试状态
                      </Title>
                      <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                        AI 面试官即将发出第一轮问题。你可以先用文字组织结构，再逐步切换到语音回答。
                      </Paragraph>
                    </Card>
                  ) : null}

                  {messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      isLoading={msg.isLoading}
                      isSpeaking={Boolean(isSpeaking && msg.id === latestInterviewerMessageId)}
                      isActive={Boolean(msg.role === 'interviewer' && msg.id === latestInterviewerMessageId)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div
                style={{
                  padding: '18px 20px 20px',
                  borderTop: '1px solid var(--line-soft)',
                  background: 'rgba(255,252,246,0.92)',
                }}
              >
                <div style={{ maxWidth: 1180, marginRight: 'auto' }}>
                  <Card className="paper-panel" bodyStyle={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                      <AudioRecorder
                        onResult={handleAudioResult}
                        onRecordingChange={handleRecordingChange}
                        disabled={isLoading}
                        onError={(text) => message.warning(text)}
                      />
                      <div style={{ flex: 1 }}>
                        <TextArea
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="输入你的回答。建议先给结论，再展开思路、方案和结果。按 Enter 发送，Shift + Enter 换行。"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          style={{
                            borderRadius: 14,
                            border: '1px solid var(--line-soft)',
                            background: '#fffdfa',
                            fontSize: 14,
                            padding: '10px 12px',
                          }}
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => void handleSend(inputText)}
                        loading={isLoading}
                        disabled={!inputText.trim()}
                        style={{ height: 44, borderRadius: 14, paddingInline: 18, fontWeight: 700 }}
                      >
                        发送
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            {!isMobile ? (
              sidebarCollapsed ? (
                collapsedRail
              ) : (
                <aside
                  style={{
                    width: 350,
                    borderLeft: '1px solid var(--line-soft)',
                    background: 'rgba(255,250,242,0.72)',
                    padding: 18,
                    overflow: 'auto',
                    flexShrink: 0,
                    height: '100%',
                  }}
                >
                  {sidebarContent}
                </aside>
              )
            ) : (
              <Drawer
                title="面试控制面板"
                placement="right"
                width={340}
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
              >
                {sidebarContent}
              </Drawer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Interview;

