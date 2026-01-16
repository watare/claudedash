import { GitHubButton } from '@/components/auth/GitHubButton';
import { LoginForm } from '@/components/auth/LoginForm';

export function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0E11] px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#EAECEF]">
            bmad-orchestrator
          </h1>
          <p className="mt-2 text-sm text-[#848E9C]">
            Sign in to access the dashboard
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-lg bg-[#1E2329] p-8 shadow-lg">
          {/* GitHub OAuth Button - Primary */}
          <GitHubButton />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2B3139]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#1E2329] px-4 text-[#848E9C]">or</span>
            </div>
          </div>

          {/* Password Login Form - Secondary */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
