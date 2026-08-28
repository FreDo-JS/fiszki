import { api } from './client';
import { AdminDashboard, AdminUserRow, PaginatedResult, Role, UserStatus } from './types';

export async function getDashboard() {
  const { data } = await api.get<{ dashboard: AdminDashboard }>('/admin/dashboard');
  return data.dashboard;
}

export async function listUsers(params: { search?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get<PaginatedResult<AdminUserRow>>('/admin/users', { params });
  return data;
}

export async function setUserStatus(id: string, status: UserStatus) {
  const { data } = await api.patch<{ user: AdminUserRow }>(`/admin/users/${id}/status`, { status });
  return data.user;
}

export async function setUserRole(id: string, role: Role) {
  const { data } = await api.patch<{ user: AdminUserRow }>(`/admin/users/${id}/role`, { role });
  return data.user;
}

export async function deleteUser(id: string) {
  await api.delete(`/admin/users/${id}`);
}
