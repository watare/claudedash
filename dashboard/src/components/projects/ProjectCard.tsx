import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { Play, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  isActive?: boolean;
  isStarting?: boolean;
  isStopping?: boolean;
  onViewDetails: (id: string) => void;
  onViewLogs: (id: string) => void;
  onApprove?: (id: string) => void;
  onStartWorkflow?: (id: string) => void;
  onStopWorkflow?: (id: string) => void;
}

export function ProjectCard({
  project,
  isActive = false,
  isStarting = false,
  isStopping = false,
  onViewDetails,
  onViewLogs,
  onApprove,
  onStartWorkflow,
  onStopWorkflow,
}: ProjectCardProps) {
  // Safe default for status to handle potential undefined
  const status = project.status ?? 'idle';

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
      aria-label={`Project ${project.name}, status ${status}`}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 gap-0">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
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
          Status: {status}
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 px-4 py-3 border-t border-[#2B3139]">
        {/* Start/Stop Workflow Button - Primary action */}
        {(status === 'idle' || status === 'waiting' || status === 'done') && onStartWorkflow && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onStartWorkflow(project.id)}
            disabled={isStarting}
            className="bg-[#F0B90B] hover:bg-[#F0B90B]/90 text-[#0B0E11]"
            data-testid="start-workflow-button"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Start Workflow
              </>
            )}
          </Button>
        )}
        {status === 'running' && onStopWorkflow && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onStopWorkflow(project.id)}
            disabled={isStopping}
            data-testid="stop-workflow-button"
          >
            {isStopping ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="w-4 h-4 mr-1" />
                Stop
              </>
            )}
          </Button>
        )}
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
        {status === 'waiting' && onApprove && (
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
