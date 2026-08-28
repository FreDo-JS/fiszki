import { api } from './client';
import { DailyStat, DeckProgress, StatsOverview } from './types';

export async function getOverview() {
  const { data } = await api.get<{ overview: StatsOverview }>('/statistics');
  return data.overview;
}

export async function getCharts(days = 30) {
  const { data } = await api.get<{ series: DailyStat[] }>('/statistics/charts', { params: { days } });
  return data.series;
}

export async function getCalendar(days = 365) {
  const { data } = await api.get<{ series: DailyStat[] }>('/statistics/calendar', { params: { days } });
  return data.series;
}

export async function getDeckProgress() {
  const { data } = await api.get<{ decks: DeckProgress[] }>('/progress');
  return data.decks;
}
