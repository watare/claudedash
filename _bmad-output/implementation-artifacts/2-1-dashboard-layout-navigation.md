# Story 2.1: Dashboard Layout & Navigation

Status: done

## Story

As a **user**,
I want **a dashboard layout with header, sidebar, and main content area**,
So that **I can navigate between projects and see overall status at a glance**.

## Acceptance Criteria

1. **Given** I am authenticated, **When** I access the dashboard, **Then** I see a header (48px) with logo "bmad-orchestrator" on the left
2. **Given** the header is visible, **Then** the header shows status summary: "[X Projects] [Y Agents] [Z Alerts]" in center
3. **Given** the header is visible, **Then** my GitHub avatar and dropdown menu appear on the right
4. **Given** I am on the dashboard, **Then** a sidebar (200px) shows the project list on the left
5. **Given** the dashboard loads, **Then** the main content area displays project cards
6. **Given** the sidebar is expanded, **When** I click the collapse toggle, **Then** the sidebar collapses to 48px showing only icons
7. **Given** I collapse or expand the sidebar, **Then** my preference is persisted in localStorage

## Tasks / Subtasks

- [x] Task 1: Create Dashboard Layout Shell (AC: #1, #4, #5)
  - [x] Create `dashboard/src/components/layout/Layout.tsx` - main layout wrapper
  - [x] Create `dashboard/src/components/layout/Header.tsx` - 48px fixed header
  - [x] Create `dashboard/src/components/layout/Sidebar.tsx` - 200px collapsible sidebar
  - [x] Create `dashboard/src/components/layout/MainContent.tsx` - flexible content area
  - [x] Wire layout into `App.tsx` as wrapper for authenticated routes

- [x] Task 2: Implement Header Component (AC: #1, #2, #3)
  - [x] Add logo/title "bmad-orchestrator" on left (gold #F0B90B text)
  - [x] Add status summary pills in center: Projects count, Agents count, Alerts count
  - [x] Add user avatar dropdown on right (GitHub avatar from authStore)
  - [x] Implement dropdown menu with: Profile, Settings, Logout options
  - [x] Use shadcn/ui DropdownMenu component

- [x] Task 3: Implement Sidebar Component (AC: #4, #6, #7)
  - [x] Create project list display with status indicators (colored dots)
  - [x] Add "New Project" button at bottom
  - [x] Implement collapse toggle button (chevron icon)
  - [x] Add smooth collapse animation (200ms ease-out)
  - [x] Persist sidebar state to localStorage key `sidebar-collapsed`
  - [x] Load sidebar state from localStorage on mount

- [x] Task 4: Create UI Store for Layout State (AC: #6, #7)
  - [x] Create `dashboard/src/stores/uiStore.ts` with Zustand
  - [x] Add `sidebarCollapsed: boolean` state
  - [x] Add `toggleSidebar()` action
  - [x] Add `setSidebarCollapsed(collapsed: boolean)` action
  - [x] Initialize from localStorage on store creation

- [x] Task 5: Style with Binance Dark Theme (AC: All)
  - [x] Apply `#0B0E11` background to main layout
  - [x] Apply `#1E2329` to header and cards
  - [x] Apply gold `#F0B90B` to active project indicator
  - [x] Ensure proper contrast ratios (WCAG 2.1 AA)
  - [x] Add focus indicators for keyboard navigation

### Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Header status counts hardcoded to 0 - connect to projectsStore and agentsStore when Stories 2.2/2.4 complete [Header.tsx:16-19]
- [ ] [AI-Review][MEDIUM] Sidebar Project interface defined locally - use shared type from types/project.ts when available [Sidebar.tsx:7-11]
- [ ] [AI-Review][LOW] Profile/Settings menu items disabled - implement when settings page is created

## Dev Notes

### Architecture & File Locations

**Files to Create:**
```
dashboard/src/
├── components/
│   └── layout/
│       ├── Layout.tsx          # Main layout wrapper
│       ├── Layout.test.tsx     # Co-located test
│       ├── Header.tsx          # Top header bar
│       ├── Header.test.tsx
│       ├── Sidebar.tsx         # Left sidebar
│       ├── Sidebar.test.tsx
│       └── MainContent.tsx     # Content wrapper
└── stores/
    └── uiStore.ts              # UI state (sidebar, modals, etc.)
```

**Existing Files to Modify:**
- `dashboard/src/App.tsx` - Wrap routes with Layout component

### Technical Requirements

**Dependencies Already Installed (via Epic 1):**
- React 19.x
- Tailwind CSS v4 (using `@import "tailwindcss"` syntax)
- shadcn/ui with "new-york" style
- Zustand 5.x
- Lucide React (icons)

**shadcn/ui Components to Use:**
- `DropdownMenu` - for user menu
- `Button` - for collapse toggle
- `Badge` - for status counts in header
- `Avatar` - for user avatar

**Color Tokens (from UX Design):**
```css
--bg-primary: #0B0E11;      /* App background */
--bg-secondary: #1E2329;    /* Cards, panels */
--bg-tertiary: #2B3139;     /* Elevated surfaces, hover */
--accent-gold: #F0B90B;     /* Success, verified, primary */
--accent-green: #0ECB81;    /* Running, positive */
--accent-red: #F6465D;      /* Failed, error */
--accent-yellow: #FCD535;   /* Warning */
--text-primary: #EAECEF;    /* Headings */
--text-secondary: #848E9C;  /* Labels */
--border-default: #2B3139;  /* Subtle borders */
```

### Implementation Patterns

**Zustand Store Pattern (from project-context.md):**
```typescript
// dashboard/src/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === 'true',

  toggleSidebar: () => set((state) => {
    const newValue = !state.sidebarCollapsed;
    localStorage.setItem('sidebar-collapsed', String(newValue));
    return { sidebarCollapsed: newValue };
  }),

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  }
}));
```

**Layout Component Structure:**
```tsx
// Layout.tsx - wrap authenticated routes
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-[#0B0E11]">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
};
```

**Header Component Pattern:**
```tsx
// Header.tsx - 48px fixed header
export const Header: React.FC = () => {
  const { user } = useAuthStore();
  const { projects } = useProjectsStore();
  const { agents } = useAgentsStore();

  return (
    <header className="h-12 bg-[#1E2329] border-b border-[#2B3139] flex items-center px-4">
      <div className="flex-1">
        <span className="text-[#F0B90B] font-semibold">bmad-orchestrator</span>
      </div>
      <div className="flex-1 flex justify-center gap-3">
        <Badge variant="secondary">{projects.length} Projects</Badge>
        <Badge variant="secondary">{agents.length} Agents</Badge>
        <Badge variant="destructive">0 Alerts</Badge>
      </div>
      <div className="flex-1 flex justify-end">
        <UserMenu user={user} />
      </div>
    </header>
  );
};
```

### Project Structure Notes

- All layout components go in `dashboard/src/components/layout/`
- Tests are co-located: `Header.tsx` + `Header.test.tsx`
- uiStore is separate from authStore/projectsStore - keeps concerns separated
- Layout wraps all authenticated routes in App.tsx

### Dependencies on Other Stories

- **Depends on Epic 1 completion**: Dashboard must be scaffolded with shadcn/ui
- **Story 2.2 provides**: projectsStore with project count for header
- **Story 2.4 provides**: agentsStore with agent count for header
- **For now**: Use placeholder counts until those stores exist

### Testing Requirements

**Unit Tests:**
- Test sidebar collapse/expand behavior
- Test localStorage persistence
- Test header displays correct counts
- Test user menu dropdown opens/closes

**Test Pattern:**
```tsx
// Header.test.tsx
describe('Header', () => {
  it('displays project count from store', () => {
    // Mock projectsStore with 3 projects
    render(<Header />);
    expect(screen.getByText('3 Projects')).toBeInTheDocument();
  });
});
```

### Accessibility Requirements

- All interactive elements keyboard accessible
- Focus visible indicators (2px gold outline)
- Sidebar collapse button has aria-label
- User menu has proper ARIA attributes
- Status counts have aria-live for updates

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dashboard Layout & Components]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Header Component]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Sidebar Component]
- [Source: _bmad-output/project-context.md#Code Organization Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without issues.

### Completion Notes List

- **Task 1 Complete**: Created Layout shell with Layout.tsx (main wrapper), Header.tsx (48px header), Sidebar.tsx (200px collapsible sidebar), MainContent.tsx (content wrapper), and index.ts (exports). Wired Layout into App.tsx for all authenticated routes.

- **Task 2 Complete**: Header component displays "bmad-orchestrator" logo in gold (#F0B90B), status summary badges (Projects, Agents, Alerts with placeholder counts), and user avatar with dropdown menu (Profile, Settings, Logout). Used shadcn/ui DropdownMenu and Avatar components. Added proper ARIA attributes for accessibility.

- **Task 3 Complete**: Sidebar component with project list area (placeholder for now), "New Project" button, collapse toggle with chevron icons, smooth 200ms ease-out animation, localStorage persistence via uiStore. Shows icons only when collapsed to 48px.

- **Task 4 Complete**: Created uiStore.ts with Zustand containing sidebarCollapsed state, toggleSidebar() action, setSidebarCollapsed() action, with localStorage initialization and persistence.

- **Task 5 Complete**: Applied Binance dark theme colors throughout - #0B0E11 background, #1E2329 for header/sidebar, #F0B90B gold accents. Added focus:ring-2 focus:ring-[#F0B90B] for keyboard navigation. All interactive elements have visible focus states.

- **Additional**: Added avatarUrl to User type in auth.ts to support GitHub avatar display. Installed shadcn/ui dropdown-menu and avatar components.

- **Tests**: Created comprehensive test suites for all components (45 tests total for Story 2.1, all passing):
  - uiStore.test.ts (11 tests) - sidebar state management and localStorage
  - Header.test.tsx (10 tests) - logo, status badges, dropdown menu, logout
  - Sidebar.test.tsx (12 tests) - collapse/expand, localStorage, accessibility
  - Layout.test.tsx (6 tests) - structure, children rendering
  - MainContent.test.tsx (6 tests) - render, styling, accessibility

### Change Log

- 2026-01-15: Story 2.1 implemented - Dashboard layout with header, sidebar, and main content area
- 2026-01-15: Code review completed - Fixed scope violation (removed AgentPanel from Layout), corrected test counts, added MainContent.test.tsx, disabled unimplemented menu items

### File List

**New Files Created:**
- dashboard/src/components/layout/Layout.tsx
- dashboard/src/components/layout/Layout.test.tsx
- dashboard/src/components/layout/Header.tsx
- dashboard/src/components/layout/Header.test.tsx
- dashboard/src/components/layout/Sidebar.tsx
- dashboard/src/components/layout/Sidebar.test.tsx
- dashboard/src/components/layout/MainContent.tsx
- dashboard/src/components/layout/MainContent.test.tsx
- dashboard/src/components/layout/index.ts
- dashboard/src/stores/uiStore.ts
- dashboard/src/stores/uiStore.test.ts
- dashboard/src/components/ui/dropdown-menu.tsx (via shadcn/ui)
- dashboard/src/components/ui/avatar.tsx (via shadcn/ui)

**Modified Files:**
- dashboard/src/App.tsx - Wrapped authenticated routes with Layout component
- dashboard/src/services/auth.ts - Added avatarUrl to User interface

**Deleted Files:**
- dashboard/src/components/layout/.gitkeep
