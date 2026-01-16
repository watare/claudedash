import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuthStore();

  // Placeholder counts - will be connected to stores in future stories
  const projectCount = 0;
  const agentCount = 0;
  const alertCount = 0;

  const handleLogout = async () => {
    await logout();
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header
      className="h-12 bg-[#1E2329] border-b border-[#2B3139] flex items-center px-4 shrink-0"
      role="banner"
    >
      {/* Left: Logo/Title */}
      <div className="flex-1">
        <span className="text-[#F0B90B] font-semibold text-lg">
          bmad-orchestrator
        </span>
      </div>

      {/* Center: Status Summary */}
      <div className="flex-1 flex justify-center gap-3" aria-live="polite">
        <Badge variant="secondary" className="bg-[#2B3139] text-[#EAECEF]">
          {projectCount} Projects
        </Badge>
        <Badge variant="secondary" className="bg-[#2B3139] text-[#EAECEF]">
          {agentCount} Agents
        </Badge>
        <Badge
          variant={alertCount > 0 ? 'destructive' : 'secondary'}
          className={alertCount > 0 ? '' : 'bg-[#2B3139] text-[#EAECEF]'}
        >
          {alertCount} Alerts
        </Badge>
      </div>

      {/* Right: User Menu */}
      <div className="flex-1 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#2B3139] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F0B90B] focus:ring-offset-2 focus:ring-offset-[#1E2329]"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.avatarUrl}
                alt={user?.username || 'User avatar'}
              />
              <AvatarFallback className="bg-[#2B3139] text-[#EAECEF]">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-[#848E9C]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-[#1E2329] border-[#2B3139]"
          >
            <DropdownMenuItem
              className="text-[#5E6673] cursor-not-allowed"
              disabled
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[#5E6673] cursor-not-allowed"
              disabled
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2B3139]" />
            <DropdownMenuItem
              className="cursor-pointer focus:bg-[#2B3139] focus:text-[#EAECEF] text-[#F6465D]"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
