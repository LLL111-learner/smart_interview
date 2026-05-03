import { Avatar } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface ChatBubbleProps {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
  isLoading?: boolean;
  isSpeaking?: boolean;
  isActive?: boolean;
}

const styleId = 'chat-bubble-animations';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes chatBubbleBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.42; }
      30% { transform: translateY(-6px); opacity: 1; }
    }
    @keyframes chatBubbleFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes aiAvatarPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(214,165,93,0.22); }
      50% { transform: scale(1.04); box-shadow: 0 0 0 14px rgba(214,165,93,0); }
    }
    @keyframes aiWaveBounce {
      0%, 100% { transform: scaleY(0.4); opacity: 0.45; }
      50% { transform: scaleY(1); opacity: 1; }
    }
    @keyframes aiBubbleGlow {
      0%, 100% { box-shadow: 0 18px 38px rgba(37,30,20,0.1); }
      50% { box-shadow: 0 18px 42px rgba(42,92,85,0.16), 0 0 0 1px rgba(214,165,93,0.22); }
    }
    @keyframes aiBubbleShimmer {
      0% { transform: translateX(-130%); opacity: 0; }
      20% { opacity: 0.22; }
      100% { transform: translateX(150%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function ChatBubble({ role, content, timestamp, isLoading, isSpeaking = false, isActive = false }: ChatBubbleProps) {
  const isInterviewer = role === 'interviewer';
  const showSpeakingState = isInterviewer && !isLoading && isSpeaking;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isInterviewer ? 'flex-start' : 'flex-end',
        gap: 12,
        marginBottom: 22,
        animation: 'chatBubbleFadeIn 0.32s ease-out',
      }}
    >
      {isInterviewer ? (
        <div
          style={{
            flexShrink: 0,
            position: 'relative',
            width: 42,
            paddingTop: 2,
          }}
        >
          {showSpeakingState ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: -5,
                borderRadius: '50%',
                border: '1px solid rgba(214,165,93,0.28)',
                animation: 'aiAvatarPulse 1.45s ease-in-out infinite',
              }}
            />
          ) : null}
          <Avatar
            icon={<RobotOutlined />}
            size={42}
            style={{
              background: showSpeakingState
                ? 'linear-gradient(135deg, #2a5c55, #356f67 58%, #d6a55d)'
                : 'linear-gradient(135deg, #2a5c55, #356f67)',
              boxShadow: showSpeakingState
                ? '0 12px 30px rgba(42,92,85,0.28), 0 0 0 4px rgba(214,165,93,0.08)'
                : '0 10px 24px rgba(42,92,85,0.22)',
              position: 'relative',
              zIndex: 1,
              flexShrink: 0,
            }}
          />
          {showSpeakingState ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: -12,
                height: 12,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    borderRadius: 999,
                    background: i % 2 === 0 ? '#d6a55d' : '#2a5c55',
                    height: `${8 + ((i + 1) % 3) * 4}px`,
                    transformOrigin: 'bottom center',
                    animation: `aiWaveBounce ${0.62 + i * 0.05}s ease-in-out ${i * 0.08}s infinite`,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          maxWidth: '72%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isInterviewer ? 'flex-start' : 'flex-end',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: isInterviewer ? '8px 22px 22px 22px' : '22px 8px 22px 22px',
            background: isInterviewer
              ? 'linear-gradient(180deg, rgba(255,253,249,0.98), rgba(248,242,233,0.98))'
              : 'linear-gradient(135deg, #2a5c55 0%, #356f67 52%, #234640 100%)',
            color: isInterviewer ? '#1f1b16' : '#f8f1e7',
            border: isInterviewer
              ? showSpeakingState || isActive
                ? '1px solid rgba(214,165,93,0.32)'
                : '1px solid rgba(57,46,32,0.12)'
              : '1px solid rgba(42,92,85,0.24)',
            boxShadow: isInterviewer
              ? showSpeakingState || isActive
                ? '0 18px 40px rgba(37,30,20,0.12)'
                : '0 14px 34px rgba(37,30,20,0.08)'
              : '0 16px 36px rgba(42,92,85,0.2)',
            animation: showSpeakingState ? 'aiBubbleGlow 1.4s ease-in-out infinite' : undefined,
          }}
        >
          {showSpeakingState ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(100deg, transparent 0%, rgba(214,165,93,0.04) 30%, rgba(214,165,93,0.18) 50%, transparent 70%)',
                transform: 'translateX(-130%)',
                animation: 'aiBubbleShimmer 2.2s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
          ) : null}

          {isInterviewer ? (
            <div
              style={{
                width: 4,
                flexShrink: 0,
                background: showSpeakingState
                  ? 'linear-gradient(180deg, #d6a55d, #2a5c55, #d6a55d)'
                  : 'linear-gradient(180deg, #2a5c55, #d6a55d)',
              }}
            />
          ) : null}

          <div
            style={{
              padding: '14px 16px',
              fontSize: 14,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px 4px' }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isInterviewer ? '#2a5c55' : '#f8f1e7',
                      animation: `chatBubbleBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
            ) : (
              content
            )}
          </div>
        </div>

        <span
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginTop: 7,
            paddingInline: 6,
            letterSpacing: '0.03em',
          }}
        >
          {isInterviewer ? 'AI 面试官' : '你'} · {dayjs(timestamp).format('HH:mm:ss')}
        </span>
      </div>

      {!isInterviewer ? (
        <Avatar
          icon={<UserOutlined />}
          size={42}
          style={{
            background: 'linear-gradient(135deg, #b86a3d, #d29b73)',
            boxShadow: '0 10px 24px rgba(184,106,61,0.22)',
            flexShrink: 0,
          }}
        />
      ) : null}
    </div>
  );
}

export default ChatBubble;
