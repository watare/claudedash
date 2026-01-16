import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { login, isLoading, error, clearError } = useAuthStore();

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (error) {
      clearError();
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await login(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="rounded-md bg-[#F6465D]/10 border border-[#F6465D] p-3 text-sm text-[#F6465D]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-[#EAECEF]">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={handleEmailChange}
          error={!!errors.email}
          disabled={isLoading}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-sm text-[#F6465D]">{errors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-[#EAECEF]">
          Password
        </label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={handlePasswordChange}
          error={!!errors.password}
          disabled={isLoading}
          autoComplete="current-password"
        />
        {errors.password && (
          <p className="text-sm text-[#F6465D]">{errors.password}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="outline"
        className="w-full"
        isLoading={isLoading}
      >
        Sign In
      </Button>
    </form>
  );
}
