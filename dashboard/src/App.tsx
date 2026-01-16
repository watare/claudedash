import { BrowserRouter, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Login } from '@/pages/Login';
import { ProjectView } from '@/pages/ProjectView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/layout';
import { useAuthStore } from '@/stores/authStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { ProjectList } from '@/components/projects';

/**
 * Main App component - Dashboard scaffolding
 * Story 1.1: Basic routing structure with dark theme
 * Story 1.7: Protected routes and session management
 * Story 2.1: Dashboard layout with header, sidebar, and main content
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes with Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardWithOAuthHandler />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Project detail view - Story 2.7 */}
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProjectView />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardContent />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Dashboard wrapper that handles OAuth callback token
 * OAuth redirects to /?token=xxx which needs to be extracted
 */
function DashboardWithOAuthHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback, checkAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Handle OAuth callback - store token and clean URL
      handleOAuthCallback(token);
      // Remove token from URL
      navigate('/', { replace: true });
      // Verify the token and load user data
      checkAuth();
    }
  }, [searchParams, handleOAuthCallback, navigate, checkAuth]);

  return <DashboardContent />;
}

/**
 * Main dashboard content area - displays project cards
 * Story 2.3: Project cards showing status, work in progress, and agent count
 */
function DashboardContent() {
  const { user } = useAuthStore();
  const { fetchProjects, error } = useProjectsStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B3139]">
        <h1 className="text-xl font-semibold text-[#EAECEF]">Projects</h1>
        {user && (
          <p className="text-sm text-[#848E9C]">
            Logged in as: <span className="text-[#EAECEF]">{user.username || user.email || user.userId}</span>
          </p>
        )}
      </div>
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D]">
          {error}
        </div>
      )}
      <ProjectList />
    </div>
  );
}

export default App;
