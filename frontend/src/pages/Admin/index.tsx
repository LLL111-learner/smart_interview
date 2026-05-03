import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Row, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { getAdminOverview, getAdminUsers, getDirectionDistribution, type AdminUserItem } from '@/api/admin';
import { getCurrentUser, getTargetDirectionLabel, type UserInfo } from '@/api/auth';

const { Title, Text } = Typography;

function Admin() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [overview, setOverview] = useState({
    total_users: 0,
    today_new_users: 0,
    total_interviews: 0,
    completed_interviews: 0,
  });
  const [directionStats, setDirectionStats] = useState<Array<{ target_position: string; user_count: number }>>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getCurrentUser(), getAdminOverview(), getDirectionDistribution(), getAdminUsers()])
      .then(([user, overviewRes, directionRes, usersRes]) => {
        setCurrentUser(user);
        setOverview(overviewRes);
        setDirectionStats(directionRes);
        setUsers(usersRes.items);
        setForbidden(!user.is_admin);
      })
      .catch((error) => {
        if (error?.response?.status === 403) {
          setForbidden(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<ColumnsType<AdminUserItem>>(
    () => [
      {
        title: '用户名',
        dataIndex: 'username',
        key: 'username',
      },
      {
        title: '姓名',
        dataIndex: 'real_name',
        key: 'real_name',
        render: (value?: string) => value || '-',
      },
      {
        title: '求职方向',
        dataIndex: 'target_position',
        key: 'target_position',
        render: (value?: string) => getTargetDirectionLabel(value),
      },
      {
        title: '角色',
        dataIndex: 'is_admin',
        key: 'is_admin',
        render: (value: boolean) => (
          <Tag color={value ? 'purple' : 'default'}>{value ? '管理员' : '学生'}</Tag>
        ),
      },
      {
        title: '注册时间',
        dataIndex: 'created_at',
        key: 'created_at',
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: '面试次数',
        dataIndex: 'interview_count',
        key: 'interview_count',
      },
      {
        title: '已完成',
        dataIndex: 'completed_interview_count',
        key: 'completed_interview_count',
      },
      {
        title: '平均得分',
        dataIndex: 'avg_score',
        key: 'avg_score',
        render: (value?: number | null) => (value == null ? '-' : value.toFixed(1)),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" tip="正在加载管理后台..." />
      </div>
    );
  }

  if (forbidden || !currentUser?.is_admin) {
    return (
      <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 20px' }}>
        <Alert
          type="error"
          showIcon
          message="无权访问管理后台"
          description="当前账号不是管理员。学生账号仍可正常使用模拟面试、报告和成长档案。"
        />
        <Button icon={<ArrowLeftOutlined />} style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '28px 20px 40px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
          返回首页
        </Button>

        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 6 }}>
            管理后台
          </Title>
          <Text type="secondary">
            当前登录管理员：{currentUser.real_name || currentUser.username}
          </Text>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="注册总人数" value={overview.total_users} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="今日新增" value={overview.today_new_users} prefix={<UserAddOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="面试总场次" value={overview.total_interviews} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="已完成面试" value={overview.completed_interviews} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={8}>
            <Card title="求职方向分布" style={{ height: '100%' }}>
              {directionStats.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {directionStats.map((item) => (
                    <div
                      key={item.target_position}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: '#f8fafc',
                      }}
                    >
                      <span>{getTargetDirectionLabel(item.target_position)}</span>
                      <Tag color="blue">{item.user_count} 人</Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无用户数据" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card title="用户列表">
              <Table
                rowKey="id"
                dataSource={users}
                columns={columns}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 900 }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default Admin;
