export function validateUsername(value: string): string | undefined {
  if (!value.trim()) return 'Nazwa użytkownika jest wymagana';
  if (value.length < 3) return 'Nazwa użytkownika musi mieć co najmniej 3 znaki';
  if (value.length > 32) return 'Nazwa użytkownika może mieć maksymalnie 32 znaki';
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return 'Dozwolone są tylko litery, cyfry, "_", "-" i "."';
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Adres e-mail jest wymagany';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Nieprawidłowy adres e-mail';
  if (value.length > 255) return 'Adres e-mail jest zbyt długi';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Hasło jest wymagane';
  if (value.length < 8) return 'Hasło musi mieć co najmniej 8 znaków';
  if (value.length > 128) return 'Hasło może mieć maksymalnie 128 znaków';
  if (!/[a-z]/.test(value)) return 'Hasło musi zawierać małą literę';
  if (!/[A-Z]/.test(value)) return 'Hasło musi zawierać wielką literę';
  if (!/[0-9]/.test(value)) return 'Hasło musi zawierać cyfrę';
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Powtórz hasło';
  if (password !== confirm) return 'Hasła muszą być identyczne';
  return undefined;
}
