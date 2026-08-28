import React, { useEffect, useState } from 'react';
import * as adminApi from '../api/admin';
import { AdminDashboard, AdminUserRow } from '../api/types';
import { Badge, Button, Input, Skeleton } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const pageSize = 15;

  const loadUsers = async () => {
    const result = await adminApi.listUsers({ search: debouncedSearch || undefined, page, pageSize });
    setUsers(result.items);
    setTotal(result.total);
  };

  useEffect(() => {
    adminApi.getDashboard().then(setDashboard);
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  const toggleStatus = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      await adminApi.setUserStatus(u.id, u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE');
      showToast(u.status === 'ACTIVE' ? 'Użytkownik zablokowany' : 'Użytkownik odblokowany', 'success');
      await loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      await adminApi.setUserRole(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN');
      showToast('Rola została zmieniona', 'success');
      await loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await adminApi.deleteUser(deleteTarget.id);
      showToast('Użytkownik został usunięty', 'success');
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Panel administratora</h1>
        <p className="mt-1 text-sm text-ink-muted">Zarządzaj użytkownikami i przeglądaj statystyki aplikacji.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {dashboard ? (
          <>
            <StatCard icon="users" label="Użytkownicy" value={dashboard.totalUsers} />
            <StatCard icon="userCheck" label="Aktywni (7 dni)" value={dashboard.activeUsers} tone="success" />
            <StatCard icon="userOff" label="Zablokowani" value={dashboard.blockedUsers} tone="warning" />
            <StatCard icon="layers" label="Zestawy" value={dashboard.totalDecks} />
            <StatCard icon="book" label="Fiszki" value={dashboard.totalCards} />
            <StatCard icon="repeat" label="Powtórki łącznie" value={dashboard.totalReviews} />
            <StatCard icon="calendar" label="Powtórki (7 dni)" value={dashboard.reviewsLast7Days} tone="success" />
          </>
        ) : (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Użytkownicy</h2>
          <Input placeholder="Szukaj po nazwie lub e-mailu…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Użytkownik</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Rejestracja</th>
                <th className="px-4 py-3">Fiszki / Powtórki</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Rola</th>
                <th className="px-4 py-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users === null &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-ink-faint">
                    Nie znaleziono użytkowników.
                  </td>
                </tr>
              )}
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-subtle/50">
                  <td className="px-4 py-3 font-medium text-ink">{u.username}</td>
                  <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(u.createdAt).toLocaleDateString('pl-PL')}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {u.deckCount} / {u.reviewCount}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status === 'ACTIVE' ? 'Aktywny' : 'Zablokowany'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === 'ADMIN' ? 'accent' : 'default'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === u.id || u.id === currentUser?.id}
                        onClick={() => toggleRole(u)}
                      >
                        {u.role === 'ADMIN' ? 'Odbierz admina' : 'Nadaj admina'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === u.id || u.id === currentUser?.id}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.status === 'ACTIVE' ? 'Zablokuj' : 'Odblokuj'}
                      </Button>
                      <Button size="sm" variant="danger" disabled={busyId === u.id || u.id === currentUser?.id} onClick={() => setDeleteTarget(u)}>
                        Usuń
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <Icon name="arrowLeft" className="h-4 w-4" />
              Poprzednia
            </Button>
            <span className="text-sm text-ink-muted">
              {page} / {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Następna
              <Icon name="arrowRight" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Usuń użytkownika"
        description={`Czy na pewno chcesz usunąć użytkownika "${deleteTarget?.username}"? Ta operacja jest nieodwracalna i usunie wszystkie jego dane.`}
        loading={busyId === deleteTarget?.id}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
