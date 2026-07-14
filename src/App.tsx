import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthPage from "@/pages/AuthPage";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardPage from "@/pages/DashboardPage";
import AddLeadPage from "@/pages/AddLeadPage";
import LeadsPage from "@/pages/LeadsPage";
import AssignLeadsPage from "@/pages/AssignLeadsPage";
import CallTrackerPage from "@/pages/CallTrackerPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import SalesTLDashboardPage from "@/pages/SalesTLDashboardPage";
import RevenuePage from "@/pages/RevenuePage";
import DNRFollowupsPage from "@/pages/DNRFollowupsPage";
import BDTLDashboardPage from "@/pages/BDTLDashboardPage";
import UserManagementPage from "@/pages/UserManagementPage";
import LoginActivityPage from "@/pages/LoginActivityPage";
import AssignmentAnalysisPage from "@/pages/AssignmentAnalysisPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache stale duration
      refetchOnWindowFocus: false, // Prevent refetching when window gains focus
    },
  },
});

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow h-12 w-12 rounded-full nb-gradient" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
};

const AuthGate = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthGate />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/leads-view" element={<DashboardPage />} />
                  <Route path="/leads/new" element={<AddLeadPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/assign" element={<AssignLeadsPage />} />
                  <Route path="/calls" element={<CallTrackerPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/sales-performance" element={<SalesTLDashboardPage />} />
                  <Route path="/revenue" element={<RevenuePage />} />
                  <Route path="/dnr-followups" element={<DNRFollowupsPage />} />
                  <Route path="/bd-performance" element={<BDTLDashboardPage />} />
                  <Route path="/users" element={<UserManagementPage />} />
                  <Route path="/login-activity" element={<LoginActivityPage />} />
                  <Route path="/assignment-analysis" element={<AssignmentAnalysisPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
