import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectsStore } from '@/stores/projectsStore';
import { EpicList } from '@/components/projects/EpicList';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

/**
 * Project detail view showing epic and story progress
 * Story 2.7: Epic/Story Progress Display
 */
export function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { currentProject, fetchProjectById, isLoading, error } = useProjectsStore();

  useEffect(() => {
    if (id) {
      fetchProjectById(id);
    }
  }, [id, fetchProjectById]);

  if (isLoading) {
    return <ProjectViewSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6" data-testid="project-view-error">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="mt-4 p-4 rounded-lg bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D]">
          {error}
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="p-6" data-testid="project-view-not-found">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="mt-4 text-[#848E9C]">Project not found</div>
      </div>
    );
  }

  const completedEpics = currentProject.epics?.filter((e) => e.status === 'done').length || 0;
  const totalEpics = currentProject.epics?.length || 0;

  return (
    <div className="p-6" data-testid="project-view">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/">
          <Button variant="ghost" size="sm" data-testid="back-button">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#EAECEF]" data-testid="project-name">
            {currentProject.name}
          </h1>
          <p className="text-sm text-[#848E9C]" data-testid="project-status">
            <span className="capitalize">{currentProject.status}</span> | {completedEpics}/{totalEpics} epics complete
          </p>
        </div>
      </div>

      {/* Epic List */}
      {currentProject.epics && currentProject.epics.length > 0 ? (
        <EpicList epics={currentProject.epics} currentStoryId={currentProject.currentStory} />
      ) : (
        <div className="text-[#848E9C]" data-testid="no-epics">
          No epics found for this project
        </div>
      )}
    </div>
  );
}

function ProjectViewSkeleton() {
  return (
    <div className="p-6" data-testid="project-view-loading">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-8 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
