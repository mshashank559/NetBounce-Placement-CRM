import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-glow h-12 w-12 rounded-full nb-gradient" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads/new" element={<AddLeadPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/assign" element={<AssignLeadsPage />} />
        <Route path="/calls" element={<CallTrackerPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
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
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
