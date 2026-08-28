import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../components/ui';
import { getErrorMessage } from '../api/client';
import { validateEmail } from '../utils/validation';

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = password ? undefined : 'Hasło jest wymagane';
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    setFormError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Nie udało się zalogować'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-lg font-semibold text-ink">Zaloguj się</h1>

      {formError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">{formError}</div>
      )}

      <Input
        label="Adres e-mail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        maxLength={255}
      />
      <Input
        label="Hasło"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        maxLength={128}
      />

      <Button type="submit" isLoading={loading} className="mt-2 w-full">
        Zaloguj się
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Nie masz konta?{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Zarejestruj się
        </Link>
      </p>
    </form>
  );
}
