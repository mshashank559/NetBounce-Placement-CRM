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
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-muted-foreground text-lg">Loading dashboard...</p>
    </div>
  );
};

export default DashboardPage;
