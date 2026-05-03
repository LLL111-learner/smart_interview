import client from './client';

export interface RegisterData {
  username: string;
  password: string;
  real_name: string;
  target_position: string;
}

export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  target_position: string;
  is_admin: boolean;
  created_at: string;
}

export const targetDirectionLabelMap: Record<string, string> = {
  frontend_client: '前端开发',
  backend_services: '后端开发',
  algorithm_data: '算法与数据',
  testing_quality: '测试与质量保障',
  devops_infra: 'DevOps 与运维基础设施',
  hardware_embedded: '嵌入式开发',
  java_backend: 'Java 后端',
  web_frontend: 'Web 前端',
  embedded: '嵌入式开发',
  python_algorithm: 'Python 算法',
  software_testing: '软件测试',
  devops: 'DevOps',
};

export function getTargetDirectionLabel(value?: string) {
  if (!value) return '暂未设置';
  return targetDirectionLabelMap[value] || value;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return client.post('/auth/login', { username, password });
}

export function register(data: RegisterData): Promise<LoginResponse> {
  return client.post('/auth/register', data);
}

export function getCurrentUser(): Promise<UserInfo> {
  return client.get('/auth/me');
}

export function logout() {
  localStorage.removeItem('token');
}
