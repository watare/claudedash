import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectCard } from './ProjectCard';
import { ConfirmStopDialog } from './ConfirmStopDialog';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUIStore } from '@/stores/uiStore';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function ProjectList() {
  const navigate = useNavigate();
  const { projects, isLoading, startProject, stopProject, startingProjectId, stoppingProjectId } =
    useProjectsStore();
  const { activeProjectId, setActiveProject } = useUIStore();
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [projectToStop, setProjectToStop] = useState<string | null>(null);

  const handleViewDetails = (projectId: string) => {
    setActiveProject(projectId);
    navigate(`/projects/${projectId}`);
  };

  const handleApprove = (projectId: string) => {
    // Placeholder for Epic 4 - will open approval modal
    toast.info('Approval workflow coming in Epic 4', {
      description: `Project ${projectId} requires approval`,
    });
  };

  const handleViewLogs = (projectId: string) => {
    // Placeholder for Story 4.5 - Log Viewer Panel
    toast.info('Log viewer coming in Story 4.5', {
      description: `Viewing logs for project ${projectId}`,
    });
  };

  const handleStartWorkflow = async (projectId: string) => {
    try {
      const result = await startProject(projectId);
      if (result.success) {
        toast.success('Workflow started', {
          description: `Orchestration started for ${projectId}`,
        });
      } else {
        toast.error('Failed to start workflow', {
          description: result.error || 'Unknown error',
        });
      }
    } catch (err) {
      console.error('Start workflow error:', err);
      toast.error('Failed to start workflow', {
        description: err instanceof Error ? err.message : 'Unexpected error',
      });
    }
  };

  const handleStopWorkflow = (projectId: string) => {
    setProjectToStop(projectId);
    setStopDialogOpen(true);
  };

  const handleConfirmStop = async () => {
    if (!projectToStop) return;

    const result = await stopProject(projectToStop);
    if (result.success) {
      toast.info('Workflow stopped', {
        description: `Orchestration stopped for ${projectToStop}`,
      });
    } else {
      toast.error('Failed to stop workflow', {
        description: result.error || 'Unknown error',
      });
    }
    setStopDialogOpen(false);
    setProjectToStop(null);
  };

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4"
        data-testid="project-list-loading"
      >
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-64 text-[#848E9C]"
        data-testid="project-list-empty"
      >
        <p className="text-lg">No projects configured</p>
        <p className="text-sm mt-2">
          Point the orchestrator at a project with a PRD and epics.md
        </p>
      </div>
    );
  }

  const projectToStopName = projectToStop
    ? projects.find((p) => p.id === projectToStop)?.name || projectToStop
    : '';

  return (
    <>
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4"
        data-testid="project-list"
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            isStarting={startingProjectId === project.id}
            isStopping={stoppingProjectId === project.id}
            onViewDetails={handleViewDetails}
            onViewLogs={handleViewLogs}
            onApprove={handleApprove}
            onStartWorkflow={handleStartWorkflow}
            onStopWorkflow={handleStopWorkflow}
          />
        ))}
      </div>

      <ConfirmStopDialog
        open={stopDialogOpen}
        onOpenChange={setStopDialogOpen}
        projectName={projectToStopName}
        onConfirm={handleConfirmStop}
        isStopping={stoppingProjectId === projectToStop}
      />
    </>
  );
}
