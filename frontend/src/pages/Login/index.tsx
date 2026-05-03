import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, Tabs, Typography, message } from 'antd';
import {
  BarChartOutlined,
  IdcardOutlined,
  LockOutlined,
  RocketOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { login, register, type RegisterData, targetDirectionLabelMap } from '@/api/auth';
import { clearTrialSession } from '@/api/interview';

const { Title, Text, Paragraph } = Typography;

const directionOptions = Object.entries(targetDirectionLabelMap).map(([value, label]) => ({ value, label }));

const featureItems = [
  {
    icon: <RobotOutlined style={{ fontSize: 22, color: '#f8f1e7' }} />,
    title: 'AI 面试官多轮追问',
    description: '不只是抛出问题，而是会根据你的回答继续深挖项目、技术细节和真实决策过程。',
  },
  {
    icon: <BarChartOutlined style={{ fontSize: 22, color: '#f8f1e7' }} />,
    title: '结构化评估报告',
    description: '从内容质量、表达逻辑、答题深度和改进建议几个维度形成可复用的复盘结果。',
  },
  {
    icon: <RocketOutlined style={{ fontSize: 22, color: '#f8f1e7' }} />,
    title: '长期成长追踪',
    description: '登录后可以持续记录练习表现，查看趋势变化，并根据弱项生成训练计划。',
  },
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || '/';
  }, [location.state]);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo]);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await login(values.username, values.password);
      clearTrialSession();
      localStorage.setItem('token', res.access_token);
      message.success('登录成功');
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterData) => {
    setLoading(true);
    try {
      const res = await register(values);
      clearTrialSession();
      localStorage.setItem('token', res.access_token);
      message.success('注册成功');
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const startTrial = () => {
    clearTrialSession();
    navigate('/interview/setup?trial=1');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch', padding: '18px' }}>
      <div
        className="editorial-panel"
        style={{
          width: '100%',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.08fr) minmax(360px, 460px)',
          minHeight: 'calc(100vh - 36px)',
        }}
      >
        <div
          style={{
            position: 'relative',
            padding: '40px 42px',
            color: 'var(--text-inverse)',
            background:
              'linear-gradient(145deg, rgba(24,22,31,0.98) 0%, rgba(35,32,43,0.96) 48%, rgba(92,67,95,0.92) 100%)',
          }}
        >
          <div className="ghost-grid" />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="eyebrow" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(248,241,231,0.72)' }}>
              Sign In / Sign Up
            </div>

            <Title className="display-title" style={{ color: '#f8f1e7', fontSize: 54, lineHeight: 1.08, margin: '28px 0 16px' }}>
              登录后，把模拟面试从一次体验变成可持续积累的训练过程
            </Title>

            <Paragraph
              style={{
                color: 'rgba(248,241,231,0.78)',
                fontSize: 17,
                lineHeight: 1.9,
                maxWidth: 560,
                marginBottom: 30,
              }}
            >
              账号不仅用于进入系统，更用于保存你的历史练习、维度评分、成长趋势和个性化建议。如果你只是想先试试，也可以直接进入体验模式。
            </Paragraph>

            <div style={{ display: 'grid', gap: 14, maxWidth: 560 }}>
              {featureItems.map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.09)',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ color: '#f8f1e7', fontWeight: 700, fontSize: 16 }}>{item.title}</div>
                    <div style={{ color: 'rgba(248,241,231,0.66)', marginTop: 4, lineHeight: 1.7 }}>{item.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <Text style={{ color: 'rgba(248,241,231,0.6)' }}>想先体验流程，也可以不登录直接开始。</Text>
              <Button onClick={startTrial} style={{ borderRadius: 14 }}>
                进入体验模式
              </Button>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(180deg, rgba(255,250,242,0.92), rgba(246,240,230,0.98))',
            padding: '42px 34px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div style={{ width: '100%' }}>
            <div className="eyebrow">Account Access</div>
            <Title level={3} className="display-title" style={{ margin: '18px 0 8px', fontSize: 34 }}>
              {activeTab === 'login' ? '登录你的账号' : '创建新的训练账户'}
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 26, lineHeight: 1.8 }}>
              {activeTab === 'login'
                ? '继续你之前的练习记录，查看成长趋势，或直接开始一场新的模拟面试。'
                : '注册后即可保存历史面试记录，并根据目标方向生成更有针对性的练习建议。'}
            </Text>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'login',
                  label: '登录',
                  children: (
                    <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
                      <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input prefix={<UserOutlined style={{ color: '#2a5c55' }} />} placeholder="请输入用户名" />
                      </Form.Item>
                      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                        <Input.Password prefix={<LockOutlined style={{ color: '#2a5c55' }} />} placeholder="请输入密码" />
                      </Form.Item>
                      <Form.Item style={{ marginTop: 10, marginBottom: 0 }}>
                        <Button htmlType="submit" type="primary" loading={loading} block style={{ height: 48, borderRadius: 16 }}>
                          登录并进入系统
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: 'register',
                  label: '注册',
                  children: (
                    <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large">
                      <Form.Item
                        name="username"
                        label="用户名"
                        rules={[
                          { required: true, message: '请输入用户名' },
                          { min: 3, message: '用户名至少需要 3 个字符' },
                        ]}
                      >
                        <Input prefix={<UserOutlined style={{ color: '#2a5c55' }} />} placeholder="设置用户名" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        label="密码"
                        rules={[
                          { required: true, message: '请输入密码' },
                          { min: 6, message: '密码长度至少为 6 位' },
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined style={{ color: '#2a5c55' }} />} placeholder="设置密码" />
                      </Form.Item>
                      <Form.Item name="real_name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                        <Input prefix={<IdcardOutlined style={{ color: '#2a5c55' }} />} placeholder="输入你的姓名" />
                      </Form.Item>
                      <Form.Item
                        name="target_position"
                        label="目标方向"
                        rules={[{ required: true, message: '请选择目标方向' }]}
                      >
                        <Select placeholder="选择你重点准备的岗位方向" options={directionOptions} />
                      </Form.Item>
                      <Form.Item style={{ marginTop: 10, marginBottom: 0 }}>
                        <Button htmlType="submit" type="primary" loading={loading} block style={{ height: 48, borderRadius: 16 }}>
                          注册并开始训练
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Text type="secondary">还不想注册？</Text>
              <Button type="link" onClick={startTrial} style={{ paddingInline: 8 }}>
                先进入体验模式
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
