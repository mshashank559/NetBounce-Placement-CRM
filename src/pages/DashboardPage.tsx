import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Phone, CheckCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BDDashboard from '@/components/BDDashboard';
import BDMemberDashboard from '@/components/BDMemberDashboard';
import SalesTLDashboard from '@/components/SalesTLDashboardNew';
import SalesMemberDashboard from '@/components/SalesMemberDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import ProcessAnalystDashboard from '@/components/ProcessAnalystDashboard';
import AccountantDashboard from '@/components/AccountantDashboard';

import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { backfillMissingLeadHistory } from '@/lib/backfillLeadHistory';

const DashboardPage: React.FC = () => {
  const { role } = useAuth();
  
  if (role === 'LEAD_TL') {
    return <BDDashboard />;
  }

  if (role === 'LEAD_GEN') {
    return <BDMemberDashboard />;
  }

  if (role === 'SALES_TL') {
    return <SalesTLDashboard />;
  }

  if (role === 'SALES_TM') {
    return <SalesMemberDashboard />;
  }

  if (role === 'ADMIN') {
    return <AdminDashboard />;
  }

  if (role === 'PROCESS_ANALYST') {
    return <ProcessAnalystDashboard />;
  }

  if (role === 'ACCOUNTANT') {
    return <AccountantDashboard />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
      <p className="text-muted-foreground text-lg">Loading dashboard...</p>
      <p className="text-xs text-muted-foreground max-w-sm">
        If loading takes longer than usual, click below to refresh your session.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Retry Loading Dashboard
      </Button>
    </div>
  );
};

export default DashboardPage;
