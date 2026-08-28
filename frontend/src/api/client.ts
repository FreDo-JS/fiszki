import axios, { AxiosError } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

let refreshPromise: Promise<void> | null = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const url = original?.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        onUnauthorized?.();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && isAuthRoute === false) {
      onUnauthorized?.();
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(err: unknown, fallback = 'Wystąpił nieoczekiwany błąd'): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (message) return message;
    if (err.code === 'ERR_NETWORK') return 'Brak połączenia z serwerem. Sprawdź swoje połączenie internetowe.';
  }
  return fallback;
}
