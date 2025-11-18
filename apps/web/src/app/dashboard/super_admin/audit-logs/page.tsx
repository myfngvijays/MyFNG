'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Shield, Search, Calendar, User, Database, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 50;

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage]);

  async function fetchAuditLogs() {
    const supabase = createClient();

    try {
      const from = (currentPage - 1) * logsPerPage;
      const to = from + logsPerPage - 1;

      const { data: logsData, count } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user_id(full_name, email)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      setLogs(logsData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesTable = filterTable === 'all' || log.table_name === filterTable;
    
    return matchesSearch && matchesAction && matchesTable;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean);
  const uniqueTables = [...new Set(logs.map(l => l.table_name))].filter(Boolean);

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'CREATE': 'text-green-600 bg-green-50',
      'UPDATE': 'text-blue-600 bg-blue-50',
      'DELETE': 'text-red-600 bg-red-50',
      'READ': 'text-gray-600 bg-gray-50',
      'LOGIN': 'text-purple-600 bg-purple-50',
      'LOGOUT': 'text-orange-600 bg-orange-50'
    };
    return colors[action] || 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audit logs...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-heading flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Audit Logs
          </h1>
          <p className="text-text-body mt-2">System-wide activity monitoring and compliance tracking</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600">Total Logs</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Today's Activity</p>
            <p className="text-2xl font-bold text-blue-600">
              {logs.filter(l => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return new Date(l.created_at) >= today;
              }).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Unique Users</p>
            <p className="text-2xl font-bold">
              {new Set(logs.map(l => l.user_id?.email).filter(Boolean)).size}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Tables Monitored</p>
            <p className="text-2xl font-bold">{uniqueTables.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search logs by action, table, or user..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
              <select
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
              >
                <option value="all">All Tables</option>
                {uniqueTables.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="card">
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      {log.table_name && (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {log.table_name}
                        </span>
                      )}
                      {log.record_id && (
                        <span className="text-xs text-gray-400">
                          ID: {log.record_id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      {log.user_id && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_id.full_name || log.user_id.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                      {log.ip_address && (
                        <span className="text-xs">IP: {log.ip_address}</span>
                      )}
                    </div>

                    {/* Show data changes if available */}
                    {(log.old_data || log.new_data) && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                          View Details
                        </summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono space-y-1">
                          {log.old_data && (
                            <div>
                              <span className="font-semibold">Old:</span>
                              <pre className="text-xs overflow-x-auto">{JSON.stringify(log.old_data, null, 2)}</pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div>
                              <span className="font-semibold">New:</span>
                              <pre className="text-xs overflow-x-auto">{JSON.stringify(log.new_data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No audit logs found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn btn-outline disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700">
              Page {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={logs.length < logsPerPage}
              className="btn btn-outline disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

