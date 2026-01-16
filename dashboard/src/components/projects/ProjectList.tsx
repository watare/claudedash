import { useNavigate } from 'react-router-dom';
import { ProjectCard } from './ProjectCard';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUIStore } from '@/stores/uiStore';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function ProjectList() {
  const navigate = useNavigate();
  const { projects, isLoading } = useProjectsStore();
  const { activeProjectId, setActiveProject } = useUIStore();

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

  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4"
      data-testid="project-list"
    >
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          isActive={project.id === activeProjectId}
          onViewDetails={handleViewDetails}
          onViewLogs={handleViewLogs}
          onApprove={handleApprove}
        />
      ))}
    </div>
  );
}
