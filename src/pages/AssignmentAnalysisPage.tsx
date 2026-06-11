import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, AlertTriangle, BarChart3, PieChart, Search, ArrowRight, Activity, ShieldAlert
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

const AssignmentAnalysisPage: React.FC = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // 1. Fetch user roles for SALES_TL and SALES_TM
  const { data: salesAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ['sales-agents-list'],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['SALES_TL', 'SALES_TM']);
      
      if (rolesError) throw rolesError;
      
      const userIds = rolesData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      
      if (profilesError) throw profilesError;

      return profilesData.map(p => {
        const matchingRole = rolesData.find(r => r.user_id === p.user_id)?.role || 'SALES_TM';
        return {
          user_id: p.user_id,
          full_name: p.full_name || 'Unknown',
          email: p.email,
          role: matchingRole
        };
      });
    },
    enabled: !!user,
  });

  // 2. Fetch leads (select only assigned_to and lead_status columns for optimization)
  const { data: leadStats, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-assigned-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('assigned_to, lead_status, assignment_type');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
  // 3. Compute stats
  const analysisData = useMemo(() => {
    if (!salesAgents || !leadStats) return { agents: [], totalPoolLeads: 0, idleCount: 0, avgLoad: 0 };

    const activeStatuses = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect'];

    const totalPoolLeads = leadStats.filter(
      l => !l.assigned_to || l.assignment_type === 'Pending'
    ).length;

    const agents = salesAgents.map(agent => {
      const agentLeads = leadStats.filter(l => l.assigned_to === agent.user_id);
      const activeLeads = agentLeads.filter(l => activeStatuses.includes(l.lead_status || '')).length;
      
      let queueStatus: 'EMPTY' | 'LOW' | 'LOADED' = 'LOADED';
      if (activeLeads === 0) {
        queueStatus = 'EMPTY';
      } else if (activeLeads < 5) {
        queueStatus = 'LOW';
      }

      return {
        ...agent,
        activeLeads,
        totalLeads: agentLeads.length,
        queueStatus
      };
    });

    const idleCount = agents.filter(a => a.activeLeads === 0).length;
    const totalActiveLeadsAssigned = agents.reduce((sum, a) => sum + a.activeLeads, 0);
    const avgLoad = agents.length > 0 ? parseFloat((totalActiveLeadsAssigned / agents.length).toFixed(1)) : 0;

    return {
      agents,
      totalPoolLeads,
      idleCount,
      avgLoad
    };
  }, [salesAgents, leadStats]);

  // 4. Filter agents for the table
  const filteredAgents = useMemo(() => {
    return analysisData.agents.filter(a => {
      const matchesSearch = a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            a.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'ALL' || a.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || a.queueStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [analysisData.agents, searchTerm, roleFilter, statusFilter]);

  // 5. Prepare chart data
  const barChartData = useMemo(() => {
    return analysisData.agents
      .map(a => ({
        name: a.full_name,
        'Active Leads': a.activeLeads,
        'Total Leads': a.totalLeads
      }))
      .sort((a, b) => b['Active Leads'] - a['Active Leads']);
  }, [analysisData.agents]);

  const pieChartData = useMemo(() => {
    return analysisData.agents
      .filter(a => a.activeLeads > 0)
      .map(a => ({
        name: a.full_name,
        value: a.activeLeads
      }))
      .sort((a, b) => b.value - a.value);
  }, [analysisData.agents]);

  const isLoading = agentsLoading || leadsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent/40 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-accent/30 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-accent/30 rounded-xl" />
          <div className="h-96 bg-accent/30 rounded-xl" />
        </div>
      </div>
    );
  }

  // Guard: Access restricted to ADMIN, LEAD_TL
  if (role !== 'ADMIN' && role !== 'LEAD_TL') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold font-display mb-2">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You do not have permission to view the Lead Assignment Analysis panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Sales Lead Assignment Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor real-time lead volume, capacity, and queue balance for Sales TLs and Members.
          </p>
        </div>
        <Button 
          onClick={() => navigate('/assign')} 
          className="nb-gradient text-white hover:opacity-90 gap-2 shrink-0 self-start md:self-auto"
        >
          Assign Leads <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="glass-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Sales Agents</p>
                <p className="text-3xl font-bold font-display">{analysisData.agents.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <Card className="glass-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Idle Agents (0 Leads)</p>
                <p className={`text-3xl font-bold font-display ${analysisData.idleCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {analysisData.idleCount}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${analysisData.idleCount > 0 ? 'bg-destructive/15 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <UserCheck className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="glass-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Leads / Agent</p>
                <p className="text-3xl font-bold font-display">{analysisData.avgLoad}</p>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                <Activity className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card className="glass-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Unassigned Pool</p>
                <p className="text-3xl font-bold font-display">{analysisData.totalPoolLeads}</p>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Analysis Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Workload Queue Load Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg font-display font-semibold">Agent Workload & Queues</CardTitle>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search agent..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                  
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-28 h-9 text-xs">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value="SALES_TM">Sales TM</SelectItem>
                      <SelectItem value="SALES_TL">Sales TL</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-28 h-9 text-xs">
                      <SelectValue placeholder="All Queues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Queues</SelectItem>
                      <SelectItem value="EMPTY">🔴 Empty</SelectItem>
                      <SelectItem value="LOW">🟡 Low</SelectItem>
                      <SelectItem value="LOADED">🟢 Loaded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
              <div className="min-w-full divide-y divide-border/40">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-accent/25 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-5 py-3">Agent</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3 text-center">Active Leads</th>
                      <th className="px-5 py-3 text-center">Total Leads</th>
                      <th className="px-5 py-3">Queue Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredAgents.map((agent) => (
                      <tr key={agent.user_id} className="hover:bg-accent/10 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-foreground">{agent.full_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="outline" className="text-xs">
                            {agent.role === 'SALES_TL' ? 'Sales TL' : 'Sales Member'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold font-display">
                          {agent.activeLeads}
                        </td>
                        <td className="px-5 py-3.5 text-center text-muted-foreground font-display">
                          {agent.totalLeads}
                        </td>
                        <td className="px-5 py-3.5">
                          {agent.queueStatus === 'EMPTY' && (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/20 gap-1">
                              🔴 Empty Queue
                            </Badge>
                          )}
                          {agent.queueStatus === 'LOW' && (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 gap-1">
                              🟡 Low Queue
                            </Badge>
                          )}
                          {agent.queueStatus === 'LOADED' && (
                            <Badge className="bg-green-500/15 text-green-600 border-green-500/20 gap-1">
                              🟢 Loaded
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/assign')}
                            className="hover:bg-primary/15 text-primary hover:text-primary gap-1 text-xs"
                          >
                            Assign <ArrowRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredAgents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No sales agents found matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Charts Visualizations */}
        <div className="space-y-6">
          {/* Chart 1: Active Leads Bar Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Active Lead Queue Load
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2" style={{ height: `${Math.max(240, barChartData.length * 36)}px` }}>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} layout="vertical" margin={{ left: -5, right: 10, top: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={115} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '11px' }} />
                    <Bar dataKey="Active Leads" fill="hsl(222, 100%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data available</div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2: Donut Share Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-indigo-500" /> Share of Total Active Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="h-60 pt-2 flex flex-col justify-center">
              {pieChartData.length > 0 ? (
                <div className="flex items-center justify-between gap-4 h-full">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          dataKey="value"
                          label={false}
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '11px' }} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 overflow-y-auto max-h-[180px] pr-1 space-y-1.5 text-[11px] custom-scrollbar">
                    {pieChartData.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between gap-1.5 py-0.5 border-b border-border/20">
                        <div className="flex items-center gap-1 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="font-medium truncate" title={item.name}>{item.name}</span>
                        </div>
                        <span className="text-muted-foreground font-semibold shrink-0">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No active assignments</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AssignmentAnalysisPage;
