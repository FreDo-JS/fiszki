import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../components/ui';
import { getErrorMessage } from '../api/client';
import { validateConfirmPassword, validateEmail, validatePassword, validateUsername } from '../utils/validation';

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {
      username: validateUsername(form.username),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirmPassword: validateConfirmPassword(form.password, form.confirmPassword),
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setFormError(null);
    try {
      await register(form.username, form.email, form.password, form.confirmPassword);
      showToast('Konto zostało utworzone!', 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Nie udało się utworzyć konta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-lg font-semibold text-ink">Utwórz konto</h1>

      {formError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">{formError}</div>
      )}

      <Input label="Nazwa użytkownika" autoComplete="username" value={form.username} onChange={set('username')} error={errors.username} maxLength={32} />
      <Input label="Adres e-mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={255} />
      <Input label="Hasło" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} maxLength={128} />
      <Input
        label="Powtórz hasło"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={set('confirmPassword')}
        error={errors.confirmPassword}
        maxLength={128}
      />

      <Button type="submit" isLoading={loading} className="mt-2 w-full">
        Zarejestruj się
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Masz już konto?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
