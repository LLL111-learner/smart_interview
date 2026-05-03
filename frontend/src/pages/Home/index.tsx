import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  CodeOutlined,
  GlobalOutlined,
  LogoutOutlined,
  RocketOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { getCurrentUser, getTargetDirectionLabel, logout, type UserInfo } from '@/api/auth';

const { Title, Paragraph, Text } = Typography;

const positions = [
  {
    key: 'java_backend',
    title: 'Java 后端',
    tone: '#2a5c55',
    icon: <CodeOutlined style={{ fontSize: 26, color: '#2a5c55' }} />,
    summary: '覆盖 Spring 体系、数据库、缓存、中间件和工程化问题，适合准备企业常见后端技术面。',
    tags: ['Spring', 'MySQL', 'Redis', 'JVM'],
  },
  {
    key: 'web_frontend',
    title: 'Web 前端',
    tone: '#b86a3d',
    icon: <GlobalOutlined style={{ fontSize: 26, color: '#b86a3d' }} />,
    summary: '聚焦浏览器原理、React / Vue 工程化、性能优化和交互实现，更贴近日常前端校招场景。',
    tags: ['React', 'TypeScript', '工程化', '性能优化'],
  },
  {
    key: 'embedded',
    title: '嵌入式开发',
    tone: '#5c435f',
    icon: <RocketOutlined style={{ fontSize: 26, color: '#5c435f' }} />,
    summary: '围绕 C/C++、RTOS、硬件接口和底层调试展开，适合系统与硬件方向的面试训练。',
    tags: ['C/C++', 'RTOS', '驱动接口', '底层调试'],
  },
  {
    key: 'python_algorithm',
    title: 'Python 算法',
    tone: '#3f6c8c',
    icon: <BarChartOutlined style={{ fontSize: 26, color: '#3f6c8c' }} />,
    summary: '训练算法思路表达、复杂度分析、数据处理与模型理解，适合算法与数据相关岗位准备。',
    tags: ['Python', '算法题', '数据结构', '机器学习'],
  },
  {
    key: 'software_testing',
    title: '软件测试',
    tone: '#6c7d34',
    icon: <RobotOutlined style={{ fontSize: 26, color: '#6c7d34' }} />,
    summary: '覆盖测试设计、自动化、质量保障和线上问题排查，帮助你建立完整的测试岗位表达框架。',
    tags: ['测试设计', '自动化', '缺陷分析', '质量保障'],
  },
  {
    key: 'devops',
    title: 'DevOps',
    tone: '#8e4b45',
    icon: <RocketOutlined style={{ fontSize: 26, color: '#8e4b45' }} />,
    summary: '聚焦 Linux、容器、CI/CD、监控和运维排障，适合基础设施与运维方向模拟练习。',
    tags: ['Linux', 'Docker', 'CI/CD', 'K8s'],
  },
] as const;

const featureCards = [
  {
    title: '岗位定制题库',
    description: '每条岗位轨道都有独立的提问重点，不再用一套通用问题覆盖所有人。',
    value: '06',
  },
  {
    title: '随时训练',
    description: '支持文字与语音双输入，不需要预约，也不依赖人工陪练即可反复模拟。',
    value: '24/7',
  },
  {
    title: '成长闭环',
    description: '练习、评分、报告、建议与成长面板串成一条连续反馈链路。',
    value: 'Loop',
  },
];

function Home() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setCurrentUser(null);
      return;
    }

    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => {
        logout();
        setCurrentUser(null);
      });
  }, []);

  const trialEntryLabel = currentUser ? '游客演练' : '免登录体验';

  const welcomeCopy = useMemo(() => {
    if (!currentUser) {
      return '针对计算机相关岗位，提供更接近真实企业节奏的模拟面试体验。你可以先做体验模式，也可以登录后持续追踪自己的成长曲线。';
    }
    return `你当前的目标方向是“${getTargetDirectionLabel(currentUser.target_position)}”。现在可以直接开始一场更有针对性的模拟，也可以切换其他岗位做交叉训练。`;
  }, [currentUser]);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    navigate('/login');
  };

  const startWithPosition = (positionKey: string) => {
    if (!localStorage.getItem('token')) {
      navigate('/login', { state: { from: `/interview/setup?position=${encodeURIComponent(positionKey)}` } });
      return;
    }
    navigate(`/interview/setup?position=${encodeURIComponent(positionKey)}`);
  };

  const startInterview = () => {
    if (!localStorage.getItem('token')) {
      navigate('/login', { state: { from: '/interview/setup' } });
      return;
    }
    navigate('/interview/setup');
  };

  const startTrialInterview = () => {
    localStorage.removeItem('trial_token');
    navigate('/interview/setup?trial=1');
  };

  return (
    <div style={{ padding: '24px 0 56px' }}>
      <div className="app-shell">
        <section
          className="editorial-panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '22px 22px 26px',
            background:
              'linear-gradient(135deg, rgba(24,22,31,0.96) 0%, rgba(35,32,43,0.94) 55%, rgba(42,92,85,0.92) 100%)',
            color: 'var(--text-inverse)',
          }}
        >
          <div className="ghost-grid" />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div>
              <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.76)' }}>
                AI Interview Lab
              </div>
              <Title level={2} className="display-title" style={{ color: '#f8f1e7', margin: '14px 0 0', fontSize: 34 }}>
                AI 模拟面试与能力提升平台
              </Title>
            </div>

            {currentUser ? (
              <Space wrap size={12}>
                <div
                  style={{
                    minWidth: 220,
                    padding: '12px 14px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{currentUser.real_name || currentUser.username}</div>
                  <div style={{ color: 'rgba(248,241,231,0.66)', fontSize: 12, marginTop: 2 }}>
                    {getTargetDirectionLabel(currentUser.target_position)}
                  </div>
                </div>
                {currentUser.is_admin ? (
                  <Button icon={<SettingOutlined />} onClick={() => navigate('/admin')} style={{ borderRadius: 14 }}>
                    管理后台
                  </Button>
                ) : null}
                <Button onClick={() => navigate('/growth')} style={{ borderRadius: 14 }}>
                  成长面板
                </Button>
                <Button icon={<LogoutOutlined />} onClick={handleLogout} style={{ borderRadius: 14 }}>
                  退出登录
                </Button>
              </Space>
            ) : (
              <Space wrap size={12}>
                <Button onClick={() => navigate('/login')} style={{ borderRadius: 14 }}>
                  登录
                </Button>
                <Button type="primary" onClick={() => navigate('/login')} style={{ borderRadius: 14 }}>
                  注册账号
                </Button>
              </Space>
            )}
          </div>

          <Row gutter={[24, 24]} style={{ marginTop: 30, position: 'relative', zIndex: 1 }}>
            <Col xs={24} lg={15}>
              <div style={{ maxWidth: 720 }}>
                <Tag
                  style={{
                    borderRadius: 999,
                    padding: '6px 12px',
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#f8f1e7',
                    marginBottom: 18,
                  }}
                >
                  按岗位定制训练
                </Tag>
                <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 58, lineHeight: 1.08, marginBottom: 16 }}>
                  把一次次模拟面试，变成真正能积累下来的能力增长
                </Title>
                <Paragraph
                  style={{
                    color: 'rgba(248,241,231,0.8)',
                    fontSize: 17,
                    lineHeight: 1.9,
                    maxWidth: 650,
                    marginBottom: 0,
                  }}
                >
                  {welcomeCopy}
                </Paragraph>

                <Space wrap size={14} style={{ marginTop: 28 }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<ArrowRightOutlined />}
                    onClick={startInterview}
                    style={{ height: 50, borderRadius: 16, paddingInline: 26 }}
                  >
                    开始正式模拟
                  </Button>
                  <Button size="large" onClick={startTrialInterview} style={{ height: 50, borderRadius: 16, paddingInline: 26 }}>
                    {trialEntryLabel}
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate(currentUser ? '/growth' : '/login')}
                    style={{ height: 50, borderRadius: 16, paddingInline: 26 }}
                  >
                    查看成长面板
                  </Button>
                </Space>
              </div>
            </Col>

            <Col xs={24} lg={9}>
              <div
                style={{
                  height: '100%',
                  minHeight: 320,
                  borderRadius: 26,
                  padding: 20,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'grid',
                  gap: 14,
                }}
              >
                {featureCards.map((item) => (
                  <div
                    key={item.title}
                    style={{
                      borderRadius: 18,
                      padding: '16px 18px',
                      background: 'rgba(17,14,21,0.24)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <Text style={{ color: '#f8f1e7', fontSize: 16, fontWeight: 600 }}>{item.title}</Text>
                      <Text style={{ color: '#d6a55d', fontSize: 24, fontWeight: 700 }}>{item.value}</Text>
                    </div>
                    <Paragraph style={{ color: 'rgba(248,241,231,0.64)', margin: '8px 0 0', lineHeight: 1.7 }}>
                      {item.description}
                    </Paragraph>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </section>

        <section style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 18 }}>
            <div className="eyebrow">岗位方向</div>
            <Title level={3} className="display-title" style={{ margin: '14px 0 8px', fontSize: 34 }}>
              按岗位场景组织训练，而不是只做一套通用题
            </Title>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              你可以按目标岗位直接开始，也可以跨岗位练习，补齐自己在技术表达和知识迁移上的短板。
            </Text>
          </div>

          <Row gutter={[18, 18]}>
            {positions.map((position, index) => (
              <Col xs={24} sm={12} lg={8} key={position.key}>
                <Card
                  className="paper-panel"
                  bodyStyle={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 292 }}
                  style={{
                    background:
                      index % 3 === 0
                        ? 'linear-gradient(180deg, rgba(42,92,85,0.08), rgba(255,250,242,0.96))'
                        : index % 3 === 1
                          ? 'linear-gradient(180deg, rgba(184,106,61,0.08), rgba(255,250,242,0.96))'
                          : 'linear-gradient(180deg, rgba(92,67,95,0.08), rgba(255,250,242,0.96))',
                  }}
                  onClick={() => startWithPosition(position.key)}
                  hoverable
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${position.tone}15`,
                    }}
                  >
                    {position.icon}
                  </div>

                  <div>
                    <Title level={4} className="display-title" style={{ margin: 0, fontSize: 26 }}>
                      {position.title}
                    </Title>
                    <Paragraph style={{ color: 'var(--text-secondary)', margin: '10px 0 0', minHeight: 72, lineHeight: 1.8 }}>
                      {position.summary}
                    </Paragraph>
                  </div>

                  <div>
                    {position.tags.map((tag) => (
                      <Tag
                        key={tag}
                        style={{
                          borderRadius: 999,
                          marginBottom: 8,
                          paddingInline: 10,
                          lineHeight: '26px',
                          border: `1px solid ${position.tone}22`,
                          background: `${position.tone}0d`,
                          color: position.tone,
                        }}
                      >
                        {tag}
                      </Tag>
                    ))}
                  </div>

                  <Button type="default" icon={<ArrowRightOutlined />} style={{ marginTop: 'auto', borderRadius: 14 }}>
                    进入该岗位模拟
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        {!currentUser ? (
          <section style={{ marginTop: 26 }}>
            <Card
              className="paper-panel"
              bodyStyle={{ padding: 24 }}
              style={{
                background: 'linear-gradient(135deg, rgba(255,250,242,0.96), rgba(244,238,227,0.94))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ maxWidth: 680 }}>
                  <div className="eyebrow">先试一场</div>
                  <Title level={4} className="display-title" style={{ margin: '14px 0 8px', fontSize: 28 }}>
                    先试一场，再决定是否长期使用
                  </Title>
                  <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0, lineHeight: 1.8 }}>
                    体验模式适合快速感受面试流程、提问风格和报告输出。登录后则可以保存历史记录、持续追踪成长趋势，并反复对比自己的提升效果。
                  </Paragraph>
                </div>
                <Space wrap size={12}>
                  <Button onClick={startTrialInterview} style={{ borderRadius: 14 }}>
                    {trialEntryLabel}
                  </Button>
                  <Button type="primary" icon={<UserOutlined />} onClick={() => navigate('/login')} style={{ borderRadius: 14 }}>
                    登录后开始正式训练
                  </Button>
                </Space>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default Home;
