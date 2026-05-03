import client from './client';

export interface AdminOverview {
  total_users: number;
  today_new_users: number;
  total_interviews: number;
  completed_interviews: number;
}

export interface DirectionDistributionItem {
  target_position: string;
  user_count: number;
}

export interface AdminUserItem {
  id: number;
  username: string;
  real_name?: string;
  target_position?: string;
  is_admin: boolean;
  created_at: string;
  interview_count: number;
  completed_interview_count: number;
  avg_score?: number | null;
}

export interface AdminUsersResponse {
  items: AdminUserItem[];
  total: number;
}

export function getAdminOverview(): Promise<AdminOverview> {
  return client.get('/admin/overview');
}

export function getDirectionDistribution(): Promise<DirectionDistributionItem[]> {
  return client.get('/admin/directions');
}

export function getAdminUsers(): Promise<AdminUsersResponse> {
  return client.get('/admin/users');
}
