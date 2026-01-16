import type { ProjectStatus } from '@/types/project';
import { cn } from '@/lib/utils';

interface StatusDotProps {
  status: ProjectStatus;
  className?: string;
}

const statusColors: Record<ProjectStatus, string> = {
  running: 'bg-[#0ECB81]',
  waiting: 'bg-[#FCD535]',
  failed: 'bg-[#F6465D]',
  done: 'bg-[#F0B90B]',
  paused: 'bg-[#5E6673]',
  idle: 'bg-[#5E6673]',
};

const statusLabels: Record<ProjectStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  failed: 'Failed',
  done: 'Done',
  paused: 'Paused',
  idle: 'Idle',
};

export function StatusDot({ status, className }: StatusDotProps) {
  const colorClass = statusColors[status];
  const isRunning = status === 'running';

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        colorClass,
        isRunning && 'animate-pulse',
        className
      )}
      role="status"
      aria-label={`Status: ${statusLabels[status]}`}
    />
  );
}
