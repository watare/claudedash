import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Folder, History, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

// Placeholder projects - will be connected to projectsStore in Story 2.2
interface Project {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'error' | 'completed';
}

const placeholderProjects: Project[] = [];

const statusColors: Record<Project['status'], string> = {
  running: 'bg-[#0ECB81]',
  idle: 'bg-[#848E9C]',
  error: 'bg-[#F6465D]',
  completed: 'bg-[#F0B90B]',
};

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Projects' },
    { path: '/history', icon: History, label: 'History' },
  ];

  return (
    <aside
      className={cn(
        'h-full bg-[#1E2329] border-r border-[#2B3139] flex flex-col transition-all duration-200 ease-out shrink-0',
        sidebarCollapsed ? 'w-12' : 'w-[200px]'
      )}
      role="navigation"
      aria-label="Project navigation"
    >
      {/* Navigation Links */}
      <div className="py-2 border-b border-[#2B3139]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2B3139] transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-[#F0B90B] focus:ring-inset',
                isActive && 'bg-[#2B3139] text-amber-500',
                !isActive && 'text-[#848E9C]'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-amber-500')} />
              {!sidebarCollapsed && (
                <span className={cn('text-sm', isActive ? 'text-[#EAECEF]' : 'text-[#848E9C]')}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto py-2">
        {placeholderProjects.length === 0 && !sidebarCollapsed && (
          <div className="px-3 py-4 text-center text-[#848E9C] text-sm">
            No projects yet
          </div>
        )}
        {placeholderProjects.map((project) => (
          <button
            key={project.id}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2B3139] transition-colors text-left',
              'focus:outline-none focus:ring-2 focus:ring-[#F0B90B] focus:ring-inset'
            )}
            title={sidebarCollapsed ? project.name : undefined}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                statusColors[project.status]
              )}
              aria-label={`Status: ${project.status}`}
            />
            {!sidebarCollapsed && (
              <>
                <Folder className="h-4 w-4 text-[#848E9C] shrink-0" />
                <span className="text-[#EAECEF] text-sm truncate">
                  {project.name}
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-[#2B3139] p-2 flex flex-col gap-2">
        {/* New Project Button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full justify-start text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]',
            sidebarCollapsed && 'justify-center px-0'
          )}
          title={sidebarCollapsed ? 'New Project' : undefined}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span className="ml-2">New Project</span>}
        </Button>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'w-full justify-start text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]',
            sidebarCollapsed && 'justify-center px-0'
          )}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="ml-2">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
