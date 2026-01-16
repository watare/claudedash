import type { StoryStatus } from '@/types/project';

interface StoryStatusBadgeProps {
  status: StoryStatus;
}

const statusConfig: Record<StoryStatus, { bg: string; text: string; label: string }> = {
  backlog: { bg: 'bg-[#2B3139]', text: 'text-[#848E9C]', label: 'Backlog' },
  'ready-for-dev': { bg: 'bg-[#1E90FF]/20', text: 'text-[#1E90FF]', label: 'Ready' },
  'in-progress': { bg: 'bg-[#FCD535]/20', text: 'text-[#FCD535]', label: 'In Progress' },
  review: { bg: 'bg-[#F0B90B]/20', text: 'text-[#F0B90B]', label: 'Review' },
  done: { bg: 'bg-[#0ECB81]/20', text: 'text-[#0ECB81]', label: 'Done' },
};

export const StoryStatusBadge: React.FC<StoryStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.backlog;

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
      data-testid="story-status-badge"
    >
      {config.label}
    </span>
  );
};
