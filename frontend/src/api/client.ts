import axios from 'axios';
import { message } from 'antd';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const trialToken = localStorage.getItem('trial_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (trialToken) {
      config.headers['X-Trial-Token'] = trialToken;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      switch (status) {
        case 401:
          localStorage.removeItem('token');
          localStorage.removeItem('trial_token');
          message.error('登录状态已失效，请重新进入系统。');
          window.location.href = '/login';
          break;
        case 403:
          message.error(data?.detail || '当前无权访问该内容。');
          break;
        case 422:
          message.error(data?.detail || '请求参数有误。');
          break;
        default:
          message.error(data?.detail || '服务器异常，请稍后重试。');
      }
    } else {
      message.error('网络连接异常，请检查服务是否正常启动。');
    }
    return Promise.reject(error);
  },
);

export default client;
