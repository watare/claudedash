import { useState } from 'react';
import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth';

export function GitHubButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);

    // Reset loading state after timeout if redirect fails (e.g., blocked, network error)
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    // Navigate to GitHub OAuth URL (provided by authService)
    window.location.href = authService.getGitHubAuthUrl();

    // Clear timeout if navigation succeeds (component unmounts)
    return () => clearTimeout(timeoutId);
  };

  return (
    <Button
      onClick={handleClick}
      isLoading={isLoading}
      className="w-full bg-[#F0B90B] text-[#0B0E11] hover:bg-[#F0B90B]/90"
    >
      <Github className="mr-2 h-5 w-5" />
      Sign in with GitHub
    </Button>
  );
}
