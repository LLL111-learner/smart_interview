import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FireOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import RadarChart from '@/components/RadarChart';
import { getCurrentUser, getTargetDirectionLabel, type UserInfo } from '@/api/auth';
import {
  getGrowthOverview,
  getGrowthTrend,
  getRecommendations,
  type GrowthOverview,
  type TrendItem,
} from '@/api/report';

const { Title, Text, Paragraph } = Typography;

type WeakPoint = {
  topic: string;
  frequency: number;
  avg_score: number;
};

type LearningTask = {
  title: string;
  due_date: string;
  completed: boolean;
};

type RecentInterview = {
  session_id: number;
  position?: string;
  position_type?: string;
  date: string;
  score: number;
};

type GrowthRecommendations = {
  weak_points?: WeakPoint[];
  weak_areas?: string[];
  learning_tasks?: LearningTask[];
  training_plan?: Array<{ day?: number; focus?: string; duration?: string }>;
  recent_interviews?: RecentInterview[];
};

const statCards: Array<{
  key: keyof GrowthOverview;
  label: string;
  suffix: string;
  precision?: number;
  icon: React.ReactNode;
  gradient: string;
}> = [
  {
    key: 'total_interviews',
    label: '累计训练次数',
    suffix: '场',
    icon: <CalendarOutlined style={{ fontSize: 28 }} />,
    gradient: 'linear-gradient(135deg, #2a5c55, #3d7f76)',
  },
  {
    key: 'avg_score',
    label: '平均得分',
    suffix: '分',
    precision: 1,
    icon: <RiseOutlined style={{ fontSize: 28 }} />,
    gradient: 'linear-gradient(135deg, #5c435f, #87648b)',
  },
  {
    key: 'highest_score',
    label: '最高成绩',
    suffix: '分',
    icon: <TrophyOutlined style={{ fontSize: 28 }} />,
    gradient: 'linear-gradient(135deg, #b86a3d, #d28f63)',
  },
  {
    key: 'streak_days',
    label: '连续训练天数',
    suffix: '天',
    icon: <FireOutlined style={{ fontSize: 28 }} />,
    gradient: 'linear-gradient(135deg, #d6a55d, #e3bc83)',
  },
];

function toSafeScore(value: unknown): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function normalizeRecommendations(raw: unknown): {
  weakPoints: WeakPoint[];
  tasks: LearningTask[];
  recentInterviews: RecentInterview[];
} {
  const rec = (raw ?? {}) as GrowthRecommendations;

  const weakPoints: WeakPoint[] = Array.isArray(rec.weak_points)
    ? rec.weak_points.map((item) => ({
        topic: String(item.topic ?? ''),
        frequency: Number(item.frequency ?? 0),
        avg_score: toSafeScore(item.avg_score),
      }))
    : Array.isArray(rec.weak_areas)
      ? rec.weak_areas.map((topic) => ({ topic: String(topic), frequency: 1, avg_score: 0 }))
      : [];

  const tasksFromApi: LearningTask[] = Array.isArray(rec.learning_tasks)
    ? rec.learning_tasks.map((item) => ({
        title: String(item.title ?? ''),
        due_date: String(item.due_date ?? ''),
        completed: Boolean(item.completed),
      }))
    : [];

  const tasksFromPlan: LearningTask[] = Array.isArray(rec.training_plan)
    ? rec.training_plan.map((item, index) => ({
        title: item.focus ? `Day ${item.day ?? index + 1}: ${item.focus}` : `Day ${item.day ?? index + 1}`,
        due_date: item.duration ?? `Day ${item.day ?? index + 1}`,
        completed: false,
      }))
    : [];

  const recentInterviews: RecentInterview[] = Array.isArray(rec.recent_interviews)
    ? rec.recent_interviews.map((item) => ({
        session_id: Number(item.session_id ?? 0),
        position: item.position,
        position_type: item.position_type,
        date: String(item.date ?? ''),
        score: toSafeScore(item.score),
      }))
    : [];

  return {
    weakPoints,
    tasks: tasksFromApi.length > 0 ? tasksFromApi : tasksFromPlan,
    recentInterviews,
  };
}

function Growth() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [recommendations, setRecommendations] = useState<GrowthRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setRecommendationLoading(true);
    setError(null);
    setRecommendationError(null);

    Promise.all([getCurrentUser(), getGrowthOverview(), getGrowthTrend()])
      .then(([user, ov, tr]) => {
        setCurrentUser(user);
        setOverview(ov);
        setTrend(tr);
      })
      .catch((err) => {
        console.error('growth fetch failed:', err);
        setError('成长数据加载失败，请稍后刷新页面重试。');
      })
      .finally(() => setLoading(false));

    getRecommendations()
      .then((rec) => {
        setRecommendations((rec ?? null) as GrowthRecommendations);
      })
      .catch((err) => {
        console.error('growth recommendations fetch failed:', err);
        setRecommendationError('推荐内容加载较慢，核心成长数据已先展示。');
      })
      .finally(() => setRecommendationLoading(false));
  }, []);

  const reloadRecommendations = () => {
    setRecommendationLoading(true);
    setRecommendationError(null);
    getRecommendations()
      .then((rec) => {
        setRecommendations((rec ?? null) as GrowthRecommendations);
      })
      .catch((err) => {
        console.error('growth recommendations refetch failed:', err);
        setRecommendationError('推荐内容暂时不可用，请稍后再试。');
      })
      .finally(() => setRecommendationLoading(false));
  };

  const { weakPoints, tasks, recentInterviews } = useMemo(
    () => normalizeRecommendations(recommendations),
    [recommendations],
  );

  const radarData = weakPoints.map((item) => item.avg_score);
  const radarLabels = weakPoints.map((item) => item.topic);
  const completedCount = tasks.filter((item) => item.completed).length;
  const taskPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: trend.map((item) => item.date),
      axisLabel: { rotate: 24, color: '#6c6256' },
      axisLine: { lineStyle: { color: 'rgba(57,46,32,0.12)' } },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      name: '分数',
      nameTextStyle: { color: '#6c6256' },
      axisLabel: { color: '#6c6256' },
      splitLine: { lineStyle: { color: 'rgba(57,46,32,0.08)' } },
    },
    series: [
      {
        name: '模拟得分',
        type: 'line',
        data: trend.map((item) => item.score),
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: '#2a5c55' },
        lineStyle: { width: 3, color: '#2a5c55' },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(42,92,85,0.28)' },
              { offset: 1, color: 'rgba(42,92,85,0.02)' },
            ],
          },
        },
      },
    ],
    grid: { left: 52, right: 24, top: 32, bottom: 54 },
  };

  const weakPointColumns: ColumnsType<WeakPoint> = [
    {
      title: '薄弱主题',
      dataIndex: 'topic',
      key: 'topic',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '出现次数',
      dataIndex: 'frequency',
      key: 'frequency',
      sorter: (a, b) => a.frequency - b.frequency,
      render: (value: number) => (
        <Tag style={{ borderRadius: 999, border: 'none', background: 'rgba(184,106,61,0.12)', color: '#b86a3d' }}>
          {value} 次
        </Tag>
      ),
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      sorter: (a, b) => a.avg_score - b.avg_score,
      render: (score: number) => {
        const safeScore = toSafeScore(score);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
            <Progress
              percent={safeScore}
              showInfo={false}
              strokeColor={safeScore >= 70 ? '#2f7d57' : safeScore >= 60 ? '#b77426' : '#b44945'}
              strokeWidth={8}
              style={{ flex: 1, margin: 0 }}
            />
            <Tag color={safeScore >= 70 ? 'success' : safeScore >= 60 ? 'warning' : 'error'} style={{ borderRadius: 999 }}>
              {safeScore} 分
            </Tag>
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" tip="正在加载成长面板..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', padding: '0 20px' }}>
        <Alert
          type="error"
          showIcon
          message="成长面板加载失败"
          description={error}
          action={
            <Button size="small" type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 0 52px' }}>
      <div className="app-shell">
        <div style={{ marginBottom: 18 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ borderRadius: 14 }}>
            返回首页
          </Button>
        </div>

        <section
          className="editorial-panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '26px',
            background:
              'linear-gradient(135deg, rgba(24,22,31,0.96) 0%, rgba(35,32,43,0.94) 52%, rgba(42,92,85,0.9) 100%)',
            color: 'var(--text-inverse)',
          }}
        >
          <div className="ghost-grid" />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 720 }}>
                <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.76)' }}>
                  Growth Dashboard
                </div>
                <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 44, lineHeight: 1.1, margin: '18px 0 10px' }}>
                  把每一次模拟，变成可量化的能力增长
                </Title>
                <Paragraph style={{ color: 'rgba(248,241,231,0.78)', fontSize: 16, lineHeight: 1.85, marginBottom: 0, maxWidth: 680 }}>
                  这里集中展示你的训练频率、成绩走势、薄弱点分布和接下来的训练建议，让复盘不再只看感觉，而是看得见进步。
                </Paragraph>
              </div>

              <Card bordered={false} style={{ minWidth: 280, background: 'rgba(255,255,255,0.08)' }} bodyStyle={{ padding: 18 }}>
                <Text style={{ color: 'rgba(248,241,231,0.64)' }}>当前用户</Text>
                <div style={{ marginTop: 10, color: '#fff', fontSize: 22, fontWeight: 700 }}>
                  {currentUser?.real_name || currentUser?.username || '未命名用户'}
                </div>
                <Text style={{ color: 'rgba(248,241,231,0.72)' }}>
                  目标方向：{getTargetDirectionLabel(currentUser?.target_position)}
                </Text>
              </Card>
            </div>
          </div>
        </section>

        <Row gutter={[18, 18]} style={{ marginTop: 22 }}>
          {statCards.map((card) => {
            const value = overview ? overview[card.key] : 0;
            return (
              <Col xs={12} lg={6} key={card.key}>
                <div
                  style={{
                    background: card.gradient,
                    borderRadius: 24,
                    padding: '22px 20px',
                    color: '#fff',
                    minHeight: 144,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 18px 40px rgba(37,30,20,0.12)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      top: -22,
                      right: -16,
                      background: 'rgba(255,255,255,0.12)',
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ opacity: 0.84 }}>{card.icon}</div>
                    <div style={{ marginTop: 18, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                      {card.precision ? Number(value).toFixed(card.precision) : value}
                      <span style={{ marginLeft: 4, fontSize: 14, fontWeight: 500 }}>{card.suffix}</span>
                    </div>
                    <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.78)' }}>{card.label}</div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>

        <Row gutter={[20, 20]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={15}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Trend</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 10px', fontSize: 28 }}>
                近期成绩走势
              </Title>
              <Text type="secondary">观察分数是否持续稳定提升，比单次高分更能说明训练效果。</Text>
              {trend.length > 0 ? (
                <ReactECharts option={trendOption} style={{ height: 320, marginTop: 10 }} />
              ) : (
                <Empty description="面试记录不足，暂时无法生成趋势图" style={{ marginTop: 28 }} />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Weakness Radar</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 10px', fontSize: 28 }}>
                薄弱点雷达
              </Title>
              <Text type="secondary">得分越低、出现越频繁的能力项，越值得优先补强。</Text>
              {radarData.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <RadarChart data={radarData} labels={radarLabels} title="能力分布概览" />
                </div>
              ) : (
                <Empty description="暂时没有可分析的薄弱点数据" style={{ marginTop: 28 }} />
              )}
            </Card>
          </Col>
        </Row>

        {recommendationError ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 20 }}
            message="推荐模块暂未完全加载"
            description={recommendationError}
            action={
              <Button size="small" type="primary" onClick={reloadRecommendations}>
                重试推荐内容
              </Button>
            }
          />
        ) : null}

        <Row gutter={[20, 20]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={15}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Weak Topics</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                高频薄弱主题
              </Title>
              {recommendationLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <Spin />
                </div>
              ) : weakPoints.length > 0 ? (
                <Table<WeakPoint>
                  dataSource={weakPoints}
                  columns={weakPointColumns}
                  rowKey="topic"
                  pagination={false}
                  size="middle"
                  onRow={(_, index) => ({
                    style: { background: (index ?? 0) % 2 === 1 ? 'rgba(255,250,242,0.82)' : '#fff' },
                  })}
                />
              ) : (
                <Empty description="目前没有识别出明显重复出现的薄弱主题" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card
              className="paper-panel"
              bodyStyle={{ padding: 22 }}
              extra={
                !recommendationLoading && tasks.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Progress
                      type="circle"
                      percent={taskPercent}
                      size={40}
                      strokeColor={{ '0%': '#2a5c55', '100%': '#b86a3d' }}
                      strokeWidth={10}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {completedCount}/{tasks.length}
                    </Text>
                  </div>
                ) : null
              }
            >
              <div className="eyebrow">Tasks</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                当前训练任务
              </Title>

              {recommendationLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <Spin />
                </div>
              ) : tasks.length > 0 ? (
                <>
                  <List
                    dataSource={tasks}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '14px 0', borderBottom: '1px dashed var(--line-soft)' }}>
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <Checkbox checked={item.completed}>
                              <span
                                style={{
                                  textDecoration: item.completed ? 'line-through' : 'none',
                                  color: item.completed ? '#8d8174' : 'var(--text-primary)',
                                  fontWeight: item.completed ? 400 : 600,
                                }}
                              >
                                {item.title}
                              </span>
                            </Checkbox>
                            <Space size={4} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              <ClockCircleOutlined />
                              <span>{item.due_date}</span>
                            </Space>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />

                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      完成进度
                    </Text>
                    <Progress percent={taskPercent} strokeColor={{ '0%': '#2a5c55', '100%': '#b86a3d' }} strokeWidth={10} />
                  </div>
                </>
              ) : (
                <Empty description="暂时没有训练任务，继续模拟后会自动生成提升建议" />
              )}
            </Card>
          </Col>
        </Row>

        <Card className="paper-panel" bodyStyle={{ padding: 22 }} style={{ marginTop: 20 }}>
          <div className="eyebrow">Recent Sessions</div>
          <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
            最近面试记录
          </Title>
          {recommendationLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Spin />
            </div>
          ) : recentInterviews.length > 0 ? (
            <List
              dataSource={recentInterviews}
              renderItem={(item, index) => (
                <List.Item
                  style={{
                    background: index % 2 === 1 ? 'rgba(255,250,242,0.82)' : '#fff',
                    borderRadius: 16,
                    padding: '16px 18px',
                    marginBottom: 10,
                    border: '1px solid var(--line-soft)',
                  }}
                  actions={[
                    <Button
                      type="link"
                      key="view"
                      onClick={() => navigate(`/report/${item.session_id}`)}
                      style={{ color: 'var(--brand-ink)', fontWeight: 600 }}
                    >
                      查看报告
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong>{item.position || getTargetDirectionLabel(item.position_type) || '未命名岗位'}</Text>}
                    description={<Text type="secondary">{item.date}</Text>}
                  />
                  <Tag
                    color={item.score >= 80 ? 'success' : item.score >= 60 ? 'processing' : 'warning'}
                    style={{ borderRadius: 999, fontWeight: 700, paddingInline: 12 }}
                  >
                    {item.score} 分
                  </Tag>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂时没有最近的面试记录" />
          )}
        </Card>
      </div>
    </div>
  );
}

export default Growth;
