import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Collapse, Radio, Space, Steps, Tag, Typography, message } from 'antd';
import {
  AudioOutlined,
  CheckCircleOutlined,
  FieldTimeOutlined,
  RocketOutlined,
  SettingOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { getCurrentUser, getTargetDirectionLabel } from '@/api/auth';
import { clearTrialSession, createInterview, createTrialInterview } from '@/api/interview';

const { Title, Paragraph, Text } = Typography;

const positionOptions = [
  { value: 'java_backend', label: 'Java 后端', direction: 'backend_services', focus: '服务端设计、数据库、JVM 与工程能力' },
  { value: 'web_frontend', label: 'Web 前端', direction: 'frontend_client', focus: '浏览器基础、框架工程化、交互实现与性能优化' },
  { value: 'embedded', label: '嵌入式开发', direction: 'hardware_embedded', focus: 'C/C++、硬件接口、RTOS 与底层调试' },
  { value: 'python_algorithm', label: 'Python 算法', direction: 'algorithm_data', focus: '算法思维、数据处理、模型理解与编码实现' },
  { value: 'software_testing', label: '软件测试', direction: 'testing_quality', focus: '测试设计、质量保障、自动化与缺陷分析' },
  { value: 'devops', label: 'DevOps', direction: 'devops_infra', focus: 'Linux、容器、CI/CD 与运维排障' },
] as const;

const difficultyOptions = [
  { value: 'easy', label: '基础难度', description: '节奏更平稳，适合先熟悉面试流程与基本表达。' },
  { value: 'standard', label: '标准难度', description: '更接近常规校招与实习面试场景，适合作为默认选择。' },
  { value: 'hard', label: '进阶难度', description: '追问更深入，适合已有准备基础后进行强化训练。' },
] as const;

const interviewTypeOptions = [
  { value: 'comprehensive', label: '综合模拟', description: '覆盖技术、项目、表达与综合素质，适合完整演练。' },
  { value: 'technical', label: '技术专项', description: '聚焦核心知识点、实现思路与工程细节。' },
  { value: 'project', label: '项目深挖', description: '围绕项目经历追问设计取舍、难点处理与结果复盘。' },
  { value: 'pressure', label: '压力面试', description: '增加连续追问与节奏压力，训练临场应对能力。' },
] as const;

const directionDefaultPositionMap: Record<string, string> = {
  frontend_client: 'web_frontend',
  backend_services: 'java_backend',
  algorithm_data: 'python_algorithm',
  testing_quality: 'software_testing',
  devops_infra: 'devops',
  hardware_embedded: 'embedded',
};

function InterviewSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [position, setPosition] = useState('java_backend');
  const [difficulty, setDifficulty] = useState('standard');
  const [interviewType, setInterviewType] = useState('comprehensive');
  const [micTested, setMicTested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentDirection, setCurrentDirection] = useState('');
  const [isCompact, setIsCompact] = useState(false);

  const hasLogin = !!localStorage.getItem('token');
  const isTrialMode = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('trial') === '1' || (!hasLogin && !!localStorage.getItem('trial_token'));
  }, [hasLogin, location.search]);
  const trialModeLabel = hasLogin ? '试用模式' : '游客模式';

  useEffect(() => {
    const updateViewport = () => setIsCompact(window.innerWidth < 1180);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const fromHome = query.get('position');
    const validPositions = new Set(positionOptions.map((item) => item.value));

    if (fromHome && validPositions.has(fromHome as (typeof positionOptions)[number]['value'])) {
      setPosition(fromHome);
      return;
    }

    if (!hasLogin) {
      setCurrentDirection('');
      return;
    }

    getCurrentUser()
      .then((user) => {
        const direction = user.target_position || '';
        setCurrentDirection(direction);
        const defaultPosition = directionDefaultPositionMap[direction];
        if (defaultPosition) {
          setPosition(defaultPosition);
        }
      })
      .catch(() => {
        setCurrentDirection('');
      });
  }, [hasLogin, location.search]);

  const selectedPosition = useMemo(() => positionOptions.find((item) => item.value === position), [position]);
  const selectedDifficulty = useMemo(() => difficultyOptions.find((item) => item.value === difficulty), [difficulty]);
  const selectedInterviewType = useMemo(
    () => interviewTypeOptions.find((item) => item.value === interviewType),
    [interviewType],
  );

  const recommendationText = useMemo(() => {
    if (!currentDirection || !selectedPosition) return '';
    if (selectedPosition.direction === currentDirection) {
      return `你的目标方向是“${getTargetDirectionLabel(currentDirection)}”，当前选择与目标一致，适合直接开始本轮训练。`;
    }
    return `你的目标方向是“${getTargetDirectionLabel(currentDirection)}”，当前也可以切换到更贴近目标岗位的模拟方向。`;
  }, [currentDirection, selectedPosition]);

  const quickStartText = useMemo(() => {
    if (!selectedPosition || !selectedDifficulty || !selectedInterviewType) return '';
    return `${selectedPosition.label} · ${selectedDifficulty.label} · ${selectedInterviewType.label}`;
  }, [selectedDifficulty, selectedInterviewType, selectedPosition]);

  const launchMetrics = useMemo(
    () => [
      { label: '面试方向', value: selectedPosition?.label || '-' },
      { label: '难度', value: selectedDifficulty?.label || '-' },
      { label: '模式', value: selectedInterviewType?.label || '-' },
      { label: '预计时长', value: difficulty === 'hard' ? '12-18 分钟' : difficulty === 'easy' ? '6-10 分钟' : '8-12 分钟' },
    ],
    [difficulty, selectedDifficulty, selectedInterviewType, selectedPosition],
  );

  const launchHighlights = [
    { title: '动态追问', description: '会根据你的回答继续深挖，不是固定题单式问答。' },
    { title: '表达分析', description: '结合内容与表达表现，输出更接近真实面试的反馈。' },
    { title: '结构化总结', description: '结束后生成评分、薄弱点和改进建议，方便复盘。' },
    { title: '成长记录', description: '本次结果会进入成长页，便于持续观察趋势变化。' },
  ];

  const launchReminders = [
    micTested ? '麦克风已检测，可直接开始语音模拟。' : '如果准备语音作答，建议先做一次麦克风检测。',
    '单题建议回答 30 秒左右，系统更容易给出稳定评估。',
    '如果当前环境不方便开麦，也可以先用文字开始。',
  ];

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicTested(true);
      message.success('麦克风检测通过，可以开始语音模拟。');
    } catch {
      message.error('麦克风检测失败，请检查浏览器权限或设备连接。');
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      if (isTrialMode) clearTrialSession();

      const session = isTrialMode
        ? await createTrialInterview({
            position_type: position,
            difficulty,
            interview_type: interviewType,
          })
        : await createInterview({
            position_type: position,
            difficulty,
            interview_type: interviewType,
          });

      message.success(isTrialMode ? `已进入${trialModeLabel}并创建本次模拟。` : '模拟已创建，正在进入面试。');
      navigate(`/interview/${session.id}`);
    } finally {
      setLoading(false);
    }
  };

  const ctaBar = (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 20,
        padding: '12px 14px',
        borderRadius: 18,
        background: 'rgba(255,250,242,0.94)',
        border: '1px solid rgba(57,46,32,0.12)',
        boxShadow: '0 20px 40px rgba(37,30,20,0.14)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>开始本次模拟</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{quickStartText}</div>
        </div>
        <Button
          type="primary"
          icon={<AudioOutlined />}
          loading={loading}
          onClick={handleStart}
          style={{ height: 44, borderRadius: 14, paddingInline: 20, fontWeight: 700 }}
        >
          开始面试
        </Button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 0 96px' }}>
      <div className="app-shell" style={{ width: 'min(1480px, calc(100vw - 24px))' }}>
        <section
          className="editorial-panel"
          style={{
            padding: '26px',
            position: 'relative',
            overflow: 'hidden',
            background:
              'linear-gradient(135deg, rgba(24,22,31,0.96) 0%, rgba(35,32,43,0.94) 55%, rgba(42,92,85,0.9) 100%)',
            color: 'var(--text-inverse)',
          }}
        >
          <div className="ghost-grid" />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ maxWidth: 760 }}>
                <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.76)' }}>
                  Quick Start
                </div>
                <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 44, lineHeight: 1.08, margin: '18px 0 12px' }}>
                  推荐配置已就绪
                </Title>
                <Paragraph style={{ color: 'rgba(248,241,231,0.78)', fontSize: 16, lineHeight: 1.85, marginBottom: 0, maxWidth: 680 }}>
                  你可以直接开始本次模拟。如果需要，也可以在下方进一步调整岗位、难度、面试模式和语音设置。
                </Paragraph>
              </div>

              <Card bordered={false} style={{ minWidth: 280, background: 'rgba(255,255,255,0.08)', color: '#f8f1e7' }} bodyStyle={{ padding: 18 }}>
                <Text style={{ color: 'rgba(248,241,231,0.66)' }}>当前状态</Text>
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px', background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {isTrialMode ? trialModeLabel : '正式面试'}
                  </Tag>
                  {currentDirection ? (
                    <Tag style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px', background: 'rgba(214,165,93,0.14)', color: '#f8f1e7', border: '1px solid rgba(214,165,93,0.18)' }}>
                      目标方向：{getTargetDirectionLabel(currentDirection)}
                    </Tag>
                  ) : null}
                </div>
              </Card>
            </div>

            <Steps
              current={2}
              items={[
                { title: '确认岗位' },
                { title: '快速开始' },
                { title: '需要时再细调' },
              ]}
            />
          </div>
        </section>

        {isTrialMode ? (
          <Alert
            showIcon
            type="info"
            message={hasLogin ? '当前正在使用试用模式。' : '当前为游客试用模式。'}
            description={
              hasLogin
                ? '试用模式下也可以完整体验模拟流程，但建议后续登录正式账号，便于统一保存训练记录。'
                : '游客模式适合快速体验，登录后可以保留历史记录并持续跟踪成长曲线。'
            }
            style={{ marginTop: 18, borderRadius: 18 }}
          />
        ) : null}

        <section
          style={{
            marginTop: 22,
            display: 'grid',
            gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.18fr) minmax(360px, 0.82fr)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">Position</div>
                  <Title level={4} className="display-title" style={{ margin: '14px 0 6px', fontSize: 28 }}>
                    先确认岗位
                  </Title>
                  <Text type="secondary">这是唯一必须显式选择的部分，其他项都可以先用推荐值。</Text>
                </div>
                {currentDirection ? (
                  <Tag color="processing" style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>
                    推荐方向：{getTargetDirectionLabel(currentDirection)}
                  </Tag>
                ) : null}
              </div>

              {recommendationText ? (
                <Alert showIcon type="info" message={recommendationText} style={{ marginTop: 18, borderRadius: 14 }} />
              ) : null}

              <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                {positionOptions.map((item) => {
                  const active = item.value === position;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPosition(item.value)}
                      style={{
                        textAlign: 'left',
                        width: '100%',
                        borderRadius: 18,
                        padding: isCompact ? '14px 16px' : '16px 18px',
                        border: active ? '1px solid rgba(42,92,85,0.34)' : '1px solid var(--line-soft)',
                        background: active
                          ? 'linear-gradient(135deg, rgba(42,92,85,0.14), rgba(255,250,242,0.98))'
                          : 'rgba(255,250,242,0.92)',
                        boxShadow: active ? '0 14px 28px rgba(42,92,85,0.1)' : 'none',
                        cursor: 'pointer',
                        transition: 'var(--transition-base)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                          <div style={{ marginTop: 6, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.focus}</div>
                        </div>
                        {active ? <CheckCircleOutlined style={{ color: 'var(--brand-ink)', fontSize: 20 }} /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="paper-panel" bodyStyle={{ padding: 0, overflow: 'hidden' }}>
              <Collapse
                ghost
                defaultActiveKey={[]}
                items={[
                  {
                    key: 'advanced',
                    label: (
                      <Space>
                        <SettingOutlined />
                        <span style={{ fontWeight: 700 }}>高级设置</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ display: 'grid', gap: 22, paddingTop: 6 }}>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 10 }}>
                            难度
                          </Text>
                          <Radio.Group value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                            <Space wrap>
                              {difficultyOptions.map((item) => (
                                <Radio.Button key={item.value} value={item.value} style={{ borderRadius: 12 }}>
                                  {item.label}
                                </Radio.Button>
                              ))}
                            </Space>
                          </Radio.Group>
                          <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
                            {selectedDifficulty?.description}
                          </Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 10 }}>
                            模拟模式
                          </Text>
                          <Radio.Group value={interviewType} onChange={(event) => setInterviewType(event.target.value)}>
                            <Space wrap>
                              {interviewTypeOptions.map((item) => (
                                <Radio.Button key={item.value} value={item.value} style={{ borderRadius: 12 }}>
                                  {item.label}
                                </Radio.Button>
                              ))}
                            </Space>
                          </Radio.Group>
                          <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
                            {selectedInterviewType?.description}
                          </Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 10 }}>
                            语音设置
                          </Text>
                          <Space wrap size={12}>
                            <Button
                              icon={micTested ? <CheckCircleOutlined /> : <SoundOutlined />}
                              onClick={testMicrophone}
                              type={micTested ? 'default' : 'primary'}
                              style={{ borderRadius: 14, height: 42, paddingInline: 16 }}
                            >
                              {micTested ? '麦克风已通过检测' : '检测麦克风'}
                            </Button>
                            <Tag style={{ borderRadius: 999, paddingInline: 12, lineHeight: '28px' }}>
                              {micTested ? '可以直接进行语音作答' : '暂未检测，可先使用文字模式'}
                            </Tag>
                          </Space>
                        </div>
                      </div>
                    ),
                  },
                ]}
                style={{ padding: '6px 22px 14px' }}
              />
            </Card>
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Card
              className="editorial-panel"
              bodyStyle={{ padding: 22 }}
              style={{
                background: 'linear-gradient(180deg, rgba(255,250,242,0.92), rgba(246,240,230,0.98))',
                position: isCompact ? 'static' : 'sticky',
                top: isCompact ? undefined : 16,
              }}
            >
              <div className="eyebrow">Recommended Launch</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                本次推荐配置
              </Title>

              <div style={{ display: 'grid', gap: 14 }}>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.74)',
                    border: '1px solid var(--line-soft)',
                  }}
                >
                  <Text type="secondary">推荐配置</Text>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{quickStartText}</div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  {launchMetrics.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 16,
                        background: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(57,46,32,0.08)',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.label}
                      </Text>
                      <div style={{ marginTop: 6, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {!isCompact ? (
                  <>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <RocketOutlined style={{ fontSize: 18, color: 'var(--brand-ink)', marginTop: 2 }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>你将获得什么</div>
                          <Text type="secondary">开始后会进入连续追问式模拟，而不是单次问答演示。</Text>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 10,
                        }}
                      >
                        {launchHighlights.map((item, index) => (
                          <div
                            key={item.title}
                            style={{
                              padding: '14px',
                              borderRadius: 16,
                              background: index % 2 === 0 ? 'rgba(42,92,85,0.08)' : 'rgba(184,106,61,0.08)',
                              border: '1px solid rgba(57,46,32,0.08)',
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                            <Text type="secondary" style={{ lineHeight: 1.7 }}>
                              {item.description}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 18,
                        background: 'rgba(24,22,31,0.04)',
                        border: '1px dashed rgba(57,46,32,0.16)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <FieldTimeOutlined style={{ color: 'var(--brand-warm)' }} />
                        <div style={{ fontWeight: 700 }}>开始前提醒</div>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {launchReminders.map((item) => (
                          <div key={item} style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {!isCompact ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<AudioOutlined />}
                  loading={loading}
                  onClick={handleStart}
                  block
                  style={{ marginTop: 22, height: 52, borderRadius: 16, fontWeight: 700 }}
                >
                  {isTrialMode ? `开始${trialModeLabel}` : '开始面试'}
                </Button>
              ) : null}
            </Card>
          </div>
        </section>
      </div>

      {isCompact ? ctaBar : null}
    </div>
  );
}

export default InterviewSetup;
