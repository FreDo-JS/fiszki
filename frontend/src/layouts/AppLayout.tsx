import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { GlobalSearch } from '../components/GlobalSearch';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    showToast('Wylogowano pomyślnie', 'success');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-subtle">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface md:block">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 animate-slide-up bg-surface shadow-raised">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-subtle md:hidden"
            aria-label="Otwórz menu"
          >
            <Icon name="menu" />
          </button>

          <div className="hidden flex-1 sm:block">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-subtle transition-colors"
              aria-label="Przełącz motyw"
              title="Przełącz jasny/ciemny motyw"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-subtle transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {user?.username?.[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="hidden text-sm font-medium text-ink sm:block">{user?.username}</span>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised animate-fade-in"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-surface-subtle transition-colors"
                  >
                    <Icon name="logout" className="h-4 w-4" />
                    Wyloguj się
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
