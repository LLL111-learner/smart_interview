import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  LinkOutlined,
  ShareAltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import RadarChart from '@/components/RadarChart';
import ScoreCard from '@/components/ScoreCard';
import { getTargetDirectionLabel } from '@/api/auth';
import { getReport, type InterviewReport } from '@/api/report';

const { Paragraph, Text, Title } = Typography;

const dimensionColors = ['#2a5c55', '#b86a3d', '#5c435f', '#3f6c8c', '#2f7d57', '#d6a55d', '#b44945'];

function Report() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGuestMode = useMemo(() => !localStorage.getItem('token') && !!localStorage.getItem('trial_token'), []);

  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);
    getReport(Number(sessionId))
      .then(setReport)
      .catch((err) => {
        console.error('report fetch failed:', err);
        setError('报告加载失败，请稍后刷新页面重试。');
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleShareReport = async () => {
    if (!report) return;
    const shareUrl = window.location.href;
    const shareTitle = `模拟面试报告 ${report.total_score} 分 | ${report.level}`;
    const shareText = `我完成了一次 ${getTargetDirectionLabel(report.position_type)} 模拟面试，综合得分 ${report.total_score} 分，评级 ${report.level}。`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      }
    } catch (error) {
      const err = error as DOMException;
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(`${shareTitle}\n${shareText}\n${shareUrl}`);
      message.success('报告链接已复制到剪贴板。');
    } catch {
      message.warning('复制失败，请手动复制浏览器地址栏链接。');
    }
  };

  const handleExportPdf = () => {
    if (!report) return;
    const oldTitle = document.title;
    document.title = `模拟面试报告-${report.session_id}`;
    message.info('即将打开打印面板，你可以在其中另存为 PDF。');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = oldTitle;
      }, 500);
    }, 80);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" tip="正在生成本次面试报告..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 680, margin: '80px auto', padding: '0 20px' }}>
        <Alert
          type="error"
          showIcon
          message="报告读取失败"
          description={error}
          action={
            <Space direction="vertical">
              <Button size="small" onClick={() => navigate('/')}>
                返回首页
              </Button>
              <Button size="small" type="primary" onClick={() => window.location.reload()}>
                重新加载
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Empty description="暂无可显示的报告数据" />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    );
  }

  const radarData = report.dimensions.map((item) => item.score);
  const radarLabels = report.dimensions.map((item) => item.dimension);
  const topDimension = [...report.dimensions].sort((a, b) => b.score - a.score)[0];
  const weakDimension = [...report.dimensions].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="report-page" style={{ padding: '24px 0 52px' }}>
      <div className="app-shell">
        <div className="report-no-print" style={{ marginBottom: 18 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ borderRadius: 14 }}>
            返回首页
          </Button>
        </div>

        {isGuestMode ? (
          <Alert
            showIcon
            type="info"
            style={{ marginBottom: 18, borderRadius: 18 }}
            message="当前查看的是体验模式报告"
            description="体验报告可用于快速复盘，但成长曲线、历史统计等长期能力追踪建议登录后使用。"
            action={
              <Button type="primary" size="small" icon={<UserOutlined />} onClick={() => navigate('/login')}>
                登录保存成长记录
              </Button>
            }
          />
        ) : null}

        <section
          className="editorial-panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '26px',
            background:
              'linear-gradient(135deg, rgba(24,22,31,0.96) 0%, rgba(35,32,43,0.94) 58%, rgba(92,67,95,0.9) 100%)',
            color: 'var(--text-inverse)',
          }}
        >
          <div className="ghost-grid" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ maxWidth: 700 }}>
                <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.76)' }}>
                  Interview Report
                </div>
                <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 44, lineHeight: 1.1, margin: '18px 0 10px' }}>
                  这不是一次“打分结束”，而是一份可以继续训练的复盘文档
                </Title>
                <Paragraph style={{ color: 'rgba(248,241,231,0.78)', fontSize: 16, lineHeight: 1.85, marginBottom: 0, maxWidth: 660 }}>
                  报告会从内容质量、表达表现、逐题反馈和提升建议四个层面回看本次模拟，帮助你把一次练习真正转化成可执行的提升动作。
                </Paragraph>
              </div>

              <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
                <Tag style={{ borderRadius: 999, width: 'fit-content', paddingInline: 12, lineHeight: '30px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
                  岗位：{getTargetDirectionLabel(report.position_type)}
                </Tag>
                <Tag style={{ borderRadius: 999, width: 'fit-content', paddingInline: 12, lineHeight: '30px', background: 'rgba(214,165,93,0.12)', color: '#fff', border: '1px solid rgba(214,165,93,0.16)' }}>
                  会话 ID：{report.session_id}
                </Tag>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 72, lineHeight: 0.95, fontWeight: 700, color: '#f8f1e7' }}>{report.total_score}</span>
                  <span style={{ color: 'rgba(248,241,231,0.76)', fontSize: 20, paddingBottom: 8 }}>分</span>
                </div>
                <Text style={{ color: 'rgba(248,241,231,0.76)', fontSize: 16 }}>评级：{report.level}</Text>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 24 }}>
              <Card bordered={false} style={{ background: 'rgba(255,255,255,0.08)' }} bodyStyle={{ padding: 16 }}>
                <Text style={{ color: 'rgba(248,241,231,0.62)' }}>优势维度</Text>
                <div style={{ marginTop: 8, color: '#fff', fontSize: 18, fontWeight: 700 }}>{topDimension?.dimension || '暂无'}</div>
              </Card>
              <Card bordered={false} style={{ background: 'rgba(255,255,255,0.08)' }} bodyStyle={{ padding: 16 }}>
                <Text style={{ color: 'rgba(248,241,231,0.62)' }}>待提升维度</Text>
                <div style={{ marginTop: 8, color: '#fff', fontSize: 18, fontWeight: 700 }}>{weakDimension?.dimension || '暂无'}</div>
              </Card>
              <Card bordered={false} style={{ background: 'rgba(255,255,255,0.08)' }} bodyStyle={{ padding: 16 }}>
                <Text style={{ color: 'rgba(248,241,231,0.62)' }}>复盘题目数</Text>
                <div style={{ marginTop: 8, color: '#fff', fontSize: 18, fontWeight: 700 }}>{report.question_reviews.length}</div>
              </Card>
            </div>
          </div>
        </section>

        <Row gutter={[20, 20]} style={{ marginTop: 22 }}>
          <Col xs={24} lg={8}>
            <Card className="paper-panel" bodyStyle={{ padding: 20 }}>
              <ScoreCard score={report.total_score} level={report.level} dimensions={report.dimensions} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Capability Map</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 12px', fontSize: 28 }}>
                多维能力画像
              </Title>
              {report.dimensions.length > 0 ? (
                <RadarChart data={radarData} labels={radarLabels} title="综合能力维度雷达" />
              ) : (
                <Empty description="暂无维度数据" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[20, 20]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={15}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Dimensions</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                分维度评估
              </Title>
              <div style={{ display: 'grid', gap: 14 }}>
                {report.dimensions.map((dim, idx) => (
                  <div
                    key={dim.dimension}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 18,
                      background: 'rgba(255,250,242,0.88)',
                      border: '1px solid var(--line-soft)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <Text strong>{dim.dimension}</Text>
                      <Tag color={dim.score >= 80 ? 'success' : dim.score >= 60 ? 'processing' : 'warning'} style={{ borderRadius: 999, paddingInline: 10 }}>
                        {dim.score} 分
                      </Tag>
                    </div>
                    <Progress
                      percent={dim.score}
                      showInfo={false}
                      strokeWidth={10}
                      strokeColor={dimensionColors[idx % dimensionColors.length]}
                      style={{ margin: '12px 0 8px' }}
                    />
                    <Text type="secondary">{dim.comment}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Summary</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 12px', fontSize: 28 }}>
                总评摘要
              </Title>
              <Paragraph style={{ color: 'var(--text-secondary)', lineHeight: 1.85 }}>{report.overall_comment}</Paragraph>

              {report.expression_summary && report.expression_summary.sample_count > 0 ? (
                <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                  <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(42,92,85,0.08)' }}>
                    <Text type="secondary">语速</Text>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{report.expression_summary.speech_rate}</div>
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(184,106,61,0.08)' }}>
                    <Text type="secondary">停顿占比</Text>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
                      {(report.expression_summary.pause_ratio * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(92,67,95,0.08)' }}>
                    <Text type="secondary">流畅度 / 自信度</Text>
                    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
                      {report.expression_summary.fluency_score} / {report.expression_summary.confidence}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert style={{ marginTop: 16, borderRadius: 16 }} type="info" showIcon message="本次语音表达样本不足，暂未生成表达分析。" />
              )}
            </Card>
          </Col>
        </Row>

        <Card className="paper-panel" bodyStyle={{ padding: 22 }} style={{ marginTop: 20 }}>
          <div className="eyebrow">Question Review</div>
          <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
            逐题复盘
          </Title>
          {report.question_reviews.length > 0 ? (
            <Collapse
              bordered={false}
              style={{ background: 'transparent' }}
              items={report.question_reviews.map((item, idx) => ({
                key: String(idx),
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--brand-ink), #356f67)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <Text strong style={{ flex: 1 }}>
                      {item.question}
                    </Text>
                    <Tag color={item.score >= 80 ? 'success' : item.score >= 60 ? 'processing' : 'warning'} style={{ borderRadius: 999 }}>
                      {item.score} 分
                    </Tag>
                  </div>
                ),
                style: {
                  marginBottom: 12,
                  borderRadius: 16,
                  background: 'rgba(255,250,242,0.88)',
                  border: '1px solid var(--line-soft)',
                },
                children: (
                  <div style={{ paddingLeft: 42, display: 'grid', gap: 10 }}>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text type="secondary">回答概览：</Text>
                      {item.answer_summary}
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text type="secondary">评语：</Text>
                      {item.comment}
                    </Paragraph>
                    {item.suggestions ? (
                      <Paragraph style={{ marginBottom: 0 }}>
                        <Text type="secondary">建议：</Text>
                        <span style={{ color: 'var(--brand-ink)' }}>{item.suggestions}</span>
                      </Paragraph>
                    ) : null}
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="暂无逐题复盘内容" />
          )}
        </Card>

        <Row gutter={[20, 20]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={12}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Highlights</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                做得好的地方
              </Title>
              {report.strengths.length > 0 ? (
                <List
                  dataSource={report.strengths}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <CheckCircleOutlined style={{ color: 'var(--success)' }} />
                        <Text>{item}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无优势总结" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Weak Points</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                需要补强的地方
              </Title>
              {report.weaknesses.length > 0 ? (
                <List
                  dataSource={report.weaknesses}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <CloseCircleOutlined style={{ color: 'var(--warning)' }} />
                        <Text>{item}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无短板总结" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[20, 20]} style={{ marginTop: 4 }}>
          <Col xs={24} lg={12}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Suggestions</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                下一步改进建议
              </Title>
              {report.suggestions.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {report.suggestions.map((item, idx) => (
                    <div key={idx} style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(92,67,95,0.08)' }}>
                      <Text strong>{idx + 1}. </Text>
                      <Text>{item}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无建议数据" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card className="paper-panel" bodyStyle={{ padding: 22 }}>
              <div className="eyebrow">Resources</div>
              <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
                推荐学习资源
              </Title>
              {report.resources.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {report.resources.map((item, idx) => (
                    <div key={idx} style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid var(--line-soft)', background: 'rgba(255,250,242,0.88)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <Space>
                          <LinkOutlined style={{ color: 'var(--brand-ink)' }} />
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.title}
                            </a>
                          ) : (
                            <Text strong>{item.title}</Text>
                          )}
                        </Space>
                        <Tag>{item.type}</Tag>
                      </div>
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        {item.description}
                      </Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无资源推荐" />
              )}
            </Card>
          </Col>
        </Row>

        <Card className="paper-panel" bodyStyle={{ padding: 22 }} style={{ marginTop: 20 }}>
          <div className="eyebrow">Training Plan</div>
          <Title level={4} className="display-title" style={{ margin: '14px 0 14px', fontSize: 28 }}>
            建议训练计划
          </Title>
          {report.training_plan.length > 0 ? (
            report.training_plan.map((day) => (
              <div key={day.day} style={{ padding: '14px 0', borderBottom: '1px dashed var(--line-soft)' }}>
                <Space>
                  <TrophyOutlined style={{ color: 'var(--brand-gold)' }} />
                  <Text strong>{day.title}</Text>
                </Space>
                <div style={{ display: 'grid', gap: 8, marginTop: 12, paddingLeft: 24 }}>
                  {day.tasks.map((task, idx) => (
                    <Text key={idx}>{`${idx + 1}. ${task}`}</Text>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <Empty description="暂无训练计划" />
          )}
        </Card>

        <Divider />

        <div className="report-no-print" style={{ textAlign: 'center', paddingBottom: 24 }}>
          <Space size="middle" wrap>
            <Button icon={<ShareAltOutlined />} size="large" style={{ borderRadius: 14, height: 46 }} onClick={handleShareReport}>
              分享报告
            </Button>
            <Button icon={<DownloadOutlined />} size="large" style={{ borderRadius: 14, height: 46 }} onClick={handleExportPdf}>
              导出 PDF
            </Button>
            {isGuestMode ? (
              <Button size="large" icon={<UserOutlined />} onClick={() => navigate('/login')} style={{ borderRadius: 14, height: 46 }}>
                登录保存记录
              </Button>
            ) : null}
            <Button
              size="large"
              type="primary"
              icon={<BulbOutlined />}
              onClick={() => navigate(isGuestMode ? '/interview/setup?trial=1' : '/interview/setup')}
              style={{ borderRadius: 14, height: 46, fontWeight: 700 }}
            >
              再练一场
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
}

export default Report;

