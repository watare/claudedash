# Story 2.7: Epic/Story Progress Display

Status: done

## Story

As a **user**,
I want **to see epic and story progress with status indicators**,
So that **I understand how far along each project is** (FR43).

## Acceptance Criteria

1. **Given** I click [View Details] on a project card, **When** the project detail view opens, **Then** I see all epics listed with completion status
2. **Given** epics are displayed, **Then** each epic shows story count: "3/7 stories complete"
3. **Given** epics are displayed, **Then** a progress bar visualizes completion percentage
4. **Given** I expand an epic, **When** stories are displayed, **Then** each story shows: number, title, status badge (draft/in-progress/review/done)
5. **Given** stories are displayed, **Then** the current active story is highlighted
6. **Given** I click a story, **When** the story details appear, **Then** I see its acceptance criteria

## Tasks / Subtasks

- [x] Task 1: Create ProjectDetail Page/View (AC: #1)
  - [x] Create `dashboard/src/pages/ProjectView.tsx` or modal component
  - [x] Fetch full project details with epics on mount
  - [x] Display project header with name and overall status
  - [x] Add back navigation to dashboard
  - [x] Create co-located test file

- [x] Task 2: Create EpicList Component (AC: #1, #2, #3)
  - [x] Create `dashboard/src/components/projects/EpicList.tsx`
  - [x] Display all epics with expand/collapse functionality
  - [x] Show completion count "X/Y stories complete"
  - [x] Add progress bar showing percentage
  - [x] Handle loading and empty states

- [x] Task 3: Create EpicCard Component (AC: #2, #3)
  - [x] Create `dashboard/src/components/projects/EpicCard.tsx`
  - [x] Display epic number, title, and status
  - [x] Show story count and progress bar
  - [x] Implement expand/collapse toggle
  - [x] Highlight current active epic

- [x] Task 4: Create StoryList Component (AC: #4, #5)
  - [x] Create `dashboard/src/components/projects/StoryList.tsx`
  - [x] Display stories within expanded epic
  - [x] Show story number, title, and status badge
  - [x] Highlight current active story
  - [x] Make stories clickable for details

- [x] Task 5: Create StoryStatusBadge Component (AC: #4)
  - [x] Create `dashboard/src/components/ui/StoryStatusBadge.tsx`
  - [x] Map status to badge colors and text
  - [x] Status values: backlog, ready-for-dev, in-progress, review, done

- [x] Task 6: Create StoryDetail Component (AC: #6)
  - [x] Create `dashboard/src/components/projects/StoryDetail.tsx`
  - [x] Display acceptance criteria as checklist
  - [x] Show story metadata (assigned agent, duration, etc.)
  - [x] Link to view logs for active story

- [x] Task 7: Implement Progress Bar Component (AC: #3)
  - [x] Create `dashboard/src/components/ui/ProgressBar.tsx`
  - [x] Display visual progress with percentage
  - [x] Use gold color for completed portion
  - [x] Show percentage text overlay or beside

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Create ui/index.ts barrel export for StoryStatusBadge [dashboard/src/components/ui/]
- [ ] [AI-Review][LOW] Extract EpicStatusBadge to separate component file for consistency [dashboard/src/components/projects/EpicCard.tsx:82-107]
- [ ] [AI-Review][LOW] Load actual epic titles from epics.md instead of "Epic {number}" placeholder [src/services/projects.js:204]

## Dev Notes

### Architecture & File Locations

**Files to Create:**
```
dashboard/src/
├── pages/
│   └── ProjectView.tsx           # Project detail page
├── components/
│   ├── ui/
│   │   ├── ProgressBar.tsx       # Reusable progress bar
│   │   └── StoryStatusBadge.tsx  # Status badge component
│   └── projects/
│       ├── EpicList.tsx          # List of epics
│       ├── EpicList.test.tsx
│       ├── EpicCard.tsx          # Individual epic display
│       ├── EpicCard.test.tsx
│       ├── StoryList.tsx         # Stories within epic
│       ├── StoryList.test.tsx
│       └── StoryDetail.tsx       # Story acceptance criteria
```

**Modify:**
- `dashboard/src/App.tsx` - Add route for /projects/:id

### Technical Requirements

**Progress Display Layout:**
```
+-----------------------------------------------------------+
| ← Back    Project: bmad-orchestrator                       |
|           Status: Running | 2/5 epics complete             |
+-----------------------------------------------------------+
|                                                            |
| Epic 1: Secure Dashboard Foundation              [Done] ✓  |
| ═══════════════════════════════════════════════ 100%       |
|   7/7 stories complete                                     |
|                                                            |
| Epic 2: Real-Time Project Monitoring      [In Progress]    |
| ═══════════════════════════════ 57%                        |
|   4/7 stories complete                                     |
| ┌──────────────────────────────────────────────────────┐   |
| │ 2.1 Dashboard Layout                    [Done] ✓      │   |
| │ 2.2 Projects Store & API                [Done] ✓      │   |
| │ 2.3 Project Cards Display               [Done] ✓      │   |
| │ 2.4 Agents Store & API                  [Done] ✓      │   |
| │ ★ 2.5 Agent Activity Panel              [In Progress] │   |
| │ 2.6 WebSocket Real-Time Updates         [Ready]       │   |
| │ 2.7 Epic/Story Progress Display         [Backlog]     │   |
| └──────────────────────────────────────────────────────┘   |
|                                                            |
| Epic 3: Status Verification System             [Backlog]   |
| ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%              |
|   0/6 stories complete                                     |
+-----------------------------------------------------------+
```

**Status Badge Colors:**
| Status | Color | Background |
|--------|-------|------------|
| backlog | #848E9C (gray) | #2B3139 |
| ready-for-dev | #1E90FF (blue) | #1E90FF20 |
| in-progress | #FCD535 (yellow) | #FCD53520 |
| review | #F0B90B (gold) | #F0B90B20 |
| done | #0ECB81 (green) | #0ECB8120 |

### Implementation Patterns

**ProjectView Page:**
```tsx
// dashboard/src/pages/ProjectView.tsx
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectsStore } from '@/stores/projectsStore';
import { EpicList } from '@/components/projects/EpicList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const ProjectView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentProject, fetchProjectById, isLoading } = useProjectsStore();

  useEffect(() => {
    if (id) {
      fetchProjectById(id);
    }
  }, [id, fetchProjectById]);

  if (isLoading || !currentProject) {
    return <ProjectViewSkeleton />;
  }

  const completedEpics = currentProject.epics?.filter(e => e.status === 'done').length || 0;
  const totalEpics = currentProject.epics?.length || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#EAECEF]">
            {currentProject.name}
          </h1>
          <p className="text-sm text-[#848E9C]">
            {currentProject.status} | {completedEpics}/{totalEpics} epics complete
          </p>
        </div>
      </div>

      {/* Epic List */}
      <EpicList
        epics={currentProject.epics || []}
        currentStoryId={currentProject.currentStory}
      />
    </div>
  );
};
```

**EpicCard Component:**
```tsx
// dashboard/src/components/projects/EpicCard.tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StoryList } from './StoryList';
import type { Epic } from '@/types/project';

interface EpicCardProps {
  epic: Epic;
  currentStoryId?: string | null;
  defaultExpanded?: boolean;
}

export const EpicCard: React.FC<EpicCardProps> = ({
  epic,
  currentStoryId,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const completedStories = epic.stories.filter(s => s.status === 'done').length;
  const totalStories = epic.stories.length;
  const progressPercent = totalStories > 0
    ? Math.round((completedStories / totalStories) * 100)
    : 0;

  const isActive = epic.stories.some(s => s.id === currentStoryId);
  const isDone = epic.status === 'done';

  return (
    <div
      className={`
        rounded-lg border
        ${isActive ? 'border-[#F0B90B]' : 'border-[#2B3139]'}
        bg-[#1E2329]
      `}
    >
      {/* Epic Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#848E9C]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#848E9C]" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#EAECEF]">
                Epic {epic.number}: {epic.title}
              </span>
              {isDone && (
                <Check className="w-4 h-4 text-[#0ECB81]" />
              )}
            </div>
            <span className="text-xs text-[#848E9C]">
              {completedStories}/{totalStories} stories complete
            </span>
          </div>
        </div>
        <EpicStatusBadge status={epic.status} />
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <ProgressBar percent={progressPercent} />
      </div>

      {/* Stories List (Expanded) */}
      {isExpanded && (
        <div className="border-t border-[#2B3139] px-4 py-3">
          <StoryList
            stories={epic.stories}
            currentStoryId={currentStoryId}
          />
        </div>
      )}
    </div>
  );
};

const EpicStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    backlog: 'bg-[#2B3139] text-[#848E9C]',
    'in-progress': 'bg-[#FCD535]/20 text-[#FCD535]',
    done: 'bg-[#0ECB81]/20 text-[#0ECB81]'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.backlog}`}>
      {status.replace('-', ' ')}
    </span>
  );
};
```

**StoryList Component:**
```tsx
// dashboard/src/components/projects/StoryList.tsx
import { useState } from 'react';
import { StoryStatusBadge } from '@/components/ui/StoryStatusBadge';
import { StoryDetail } from './StoryDetail';
import type { Story } from '@/types/project';

interface StoryListProps {
  stories: Story[];
  currentStoryId?: string | null;
}

export const StoryList: React.FC<StoryListProps> = ({ stories, currentStoryId }) => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  return (
    <div className="space-y-1">
      {stories.map((story) => {
        const isCurrent = story.id === currentStoryId;

        return (
          <button
            key={story.id}
            className={`
              w-full px-3 py-2 rounded flex items-center justify-between text-left
              ${isCurrent ? 'bg-[#F0B90B]/10' : 'hover:bg-[#2B3139]'}
            `}
            onClick={() => setSelectedStory(story)}
          >
            <div className="flex items-center gap-2">
              {isCurrent && <span className="text-[#F0B90B]">★</span>}
              <span className={`text-sm ${isCurrent ? 'text-[#EAECEF]' : 'text-[#848E9C]'}`}>
                {story.id} {story.title}
              </span>
            </div>
            <StoryStatusBadge status={story.status} />
          </button>
        );
      })}

      {/* Story Detail Modal/Panel */}
      {selectedStory && (
        <StoryDetail
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
};
```

**StoryStatusBadge Component:**
```tsx
// dashboard/src/components/ui/StoryStatusBadge.tsx
import type { StoryStatus } from '@/types/project';

interface StoryStatusBadgeProps {
  status: StoryStatus;
}

const statusConfig: Record<StoryStatus, { bg: string; text: string; label: string }> = {
  backlog: { bg: 'bg-[#2B3139]', text: 'text-[#848E9C]', label: 'Backlog' },
  'ready-for-dev': { bg: 'bg-[#1E90FF]/20', text: 'text-[#1E90FF]', label: 'Ready' },
  'in-progress': { bg: 'bg-[#FCD535]/20', text: 'text-[#FCD535]', label: 'In Progress' },
  review: { bg: 'bg-[#F0B90B]/20', text: 'text-[#F0B90B]', label: 'Review' },
  done: { bg: 'bg-[#0ECB81]/20', text: 'text-[#0ECB81]', label: 'Done' }
};

export const StoryStatusBadge: React.FC<StoryStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.backlog;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};
```

**ProgressBar Component:**
```tsx
// dashboard/src/components/ui/ProgressBar.tsx
interface ProgressBarProps {
  percent: number;
  showLabel?: boolean;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  showLabel = true,
  height = 6
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 bg-[#2B3139] rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full bg-[#F0B90B] rounded-full transition-all duration-300"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-[#848E9C] w-10 text-right">
          {clampedPercent}%
        </span>
      )}
    </div>
  );
};
```

### Router Setup

Add route in App.tsx:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ProjectView } from './pages/ProjectView';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### Project Structure Notes

- ProjectView is a page component accessed via route
- EpicCard manages its own expand/collapse state
- StoryDetail could be modal or slide-in panel
- All components follow co-located test pattern

### Dependencies on Other Stories

- **Requires Story 2.2**: projectsStore with fetchProjectById
- **Requires Story 2.3**: Project cards link to this view
- **Enhanced by Story 3.6**: Verification badges on status

### Testing Requirements

**EpicCard Tests:**
```tsx
describe('EpicCard', () => {
  const mockEpic: Epic = {
    number: 1,
    title: 'Test Epic',
    status: 'in-progress',
    stories: [
      { id: '1-1', title: 'Story 1', status: 'done' },
      { id: '1-2', title: 'Story 2', status: 'in-progress' },
      { id: '1-3', title: 'Story 3', status: 'backlog' }
    ]
  };

  it('shows story count', () => {
    render(<EpicCard epic={mockEpic} />);
    expect(screen.getByText('1/3 stories complete')).toBeInTheDocument();
  });

  it('expands to show stories on click', () => {
    render(<EpicCard epic={mockEpic} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('1-1 Story 1')).toBeInTheDocument();
  });

  it('highlights current story', () => {
    render(<EpicCard epic={mockEpic} currentStoryId="1-2" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('★')).toBeInTheDocument();
  });
});
```

**ProgressBar Tests:**
```tsx
describe('ProgressBar', () => {
  it('displays correct percentage', () => {
    render(<ProgressBar percent={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('clamps percent to 0-100', () => {
    const { rerender } = render(<ProgressBar percent={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();

    rerender(<ProgressBar percent={-10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
```

### Accessibility Requirements

- Expand/collapse buttons have aria-expanded
- Progress bar has aria-valuenow, aria-valuemin, aria-valuemax
- Current story announced with screen reader text
- Keyboard navigation for story selection
- Focus management when story detail opens

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Journey Flows]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/project-context.md#Naming Conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented ProjectView page at `/projects/:id` route with project header, epic completion count, and back navigation
- Created EpicList component that displays all epics with auto-expansion for epic containing current story
- Created EpicCard component with expand/collapse functionality, progress bar, story count, and status badge
- Created StoryList component showing stories within epics, with current story highlighting (★)
- Created StoryStatusBadge component with proper color coding for all status values (backlog, ready-for-dev, in-progress, review, done)
- Created StoryDetail modal component with story metadata, acceptance criteria placeholder, and "View Agent Logs" button for in-progress stories
- Created ProgressBar component with accessibility attributes (aria-valuenow, aria-valuemin, aria-valuemax), value clamping (0-100), and optional label
- Updated App.tsx with `/projects/:id` protected route
- Updated ProjectList to navigate to project detail view when "View Details" is clicked
- Added exports to components/projects/index.ts
- All components follow co-located test pattern with comprehensive test coverage
- All 323 tests passing including 73 new tests for Story 2.7 components
- Accessibility requirements met: aria-expanded on toggles, aria attributes on progress bar, keyboard escape to close modal, focus management

**Code Review Fixes (2026-01-15):**
- Added `acceptanceCriteria`, `assignedAgent`, and `duration` fields to Story type
- Implemented backend parsing of acceptance criteria from story markdown files
- Updated StoryDetail to display actual acceptance criteria (AC #6 fully implemented)
- Added conditional display of assignedAgent and duration in story metadata
- Added onClick handler to View Agent Logs button (placeholder for Story 4.5)
- All 328 tests passing (5 new tests added for code review fixes)

### File List

**New Files:**
- dashboard/src/pages/ProjectView.tsx
- dashboard/src/pages/ProjectView.test.tsx
- dashboard/src/components/projects/EpicList.tsx
- dashboard/src/components/projects/EpicList.test.tsx
- dashboard/src/components/projects/EpicCard.tsx
- dashboard/src/components/projects/EpicCard.test.tsx
- dashboard/src/components/projects/StoryList.tsx
- dashboard/src/components/projects/StoryList.test.tsx
- dashboard/src/components/projects/StoryDetail.tsx
- dashboard/src/components/projects/StoryDetail.test.tsx
- dashboard/src/components/ui/ProgressBar.tsx
- dashboard/src/components/ui/ProgressBar.test.tsx
- dashboard/src/components/ui/StoryStatusBadge.tsx
- dashboard/src/components/ui/StoryStatusBadge.test.tsx

**Modified Files:**
- dashboard/src/App.tsx (added ProjectView import and /projects/:id route)
- dashboard/src/components/projects/index.ts (added exports for new components)
- dashboard/src/components/projects/ProjectList.tsx (added navigation to project detail view)
- dashboard/src/components/projects/ProjectList.test.tsx (wrapped tests in MemoryRouter)

**Code Review Modified Files:**
- dashboard/src/types/project.ts (added acceptanceCriteria, assignedAgent, duration to Story type)
- dashboard/src/components/projects/StoryDetail.tsx (acceptance criteria display, metadata fields, onClick handler)
- dashboard/src/components/projects/StoryDetail.test.tsx (new tests for AC, metadata, onClick)
- src/services/projects.js (parseAcceptanceCriteria, findStoryFile functions, buildEpicsFromStatus update)

## Change Log

- 2026-01-15: Story 2.7 implementation complete - Epic/Story Progress Display with all UI components, tests, and accessibility features
- 2026-01-15: Code review completed - Fixed HIGH issues (AC #6 acceptance criteria), MEDIUM issues (metadata, onClick handler), added 5 new tests. All 328 tests pass.
