import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  onViewDetails: (id: string) => void;
  onViewLogs: (id: string) => void;
  onApprove?: (id: string) => void;
}

export function ProjectCard({
  project,
  isActive = false,
  onViewDetails,
  onViewLogs,
  onApprove,
}: ProjectCardProps) {
  const currentWork = project.currentEpic && project.currentStory
    ? `Epic ${project.currentEpic}, Story ${project.currentStory}`
    : 'No active work';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewDetails(project.id);
    }
  };

  return (
    <Card
      className={cn(
        'bg-[#1E2329] border-[#2B3139] rounded-lg min-w-[280px] max-w-[400px]',
        'hover:bg-[#2B3139]/50 transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[#F0B90B] focus:ring-offset-2 focus:ring-offset-[#0B0E11]',
        isActive && 'border-l-[3px] border-l-[#F0B90B]'
      )}
      data-testid="project-card"
      tabIndex={0}
      role="article"
      aria-label={`Project ${project.name}, status ${project.status}`}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 gap-0">
        <div className="flex items-center gap-2">
          <StatusDot status={project.status} />
          <span className="font-medium text-[#EAECEF]">{project.name}</span>
        </div>
        <Badge variant="secondary" className="text-xs bg-[#2B3139] text-[#848E9C]">
          {project.agentCount} {project.agentCount === 1 ? 'agent' : 'agents'}
        </Badge>
      </CardHeader>

      <CardContent className="px-4 py-2 gap-1">
        <p className="text-sm text-[#848E9C]">
          Current: {currentWork}
        </p>
        <p className="text-xs text-[#5E6673] mt-1 capitalize">
          Status: {project.status}
        </p>
      </CardContent>

      <CardFooter className="flex gap-2 px-4 py-3 border-t border-[#2B3139]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(project.id)}
        >
          View Details
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewLogs(project.id)}
        >
          View Logs
        </Button>
        {project.status === 'waiting' && onApprove && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onApprove(project.id)}
          >
            Approve
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
