import { api } from './client';
import { User } from './types';

export async function register(input: { username: string; email: string; password: string; confirmPassword: string }) {
  const { data } = await api.post<{ user: User }>('/auth/register', input);
  return data.user;
}

export async function login(input: { email: string; password: string }) {
  const { data } = await api.post<{ user: User }>('/auth/login', input);
  return data.user;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}
