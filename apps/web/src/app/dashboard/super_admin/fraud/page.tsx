'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Shield, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';

export default function FraudManagementPage() {
  const supabase = createClientComponentClient();
  const [fraudCases, setFraudCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchFraudCases();
  }, [filterStatus]);

  const fetchFraudCases = async () => {
    try {
      let query = supabase
        .from('fraud_cases')
        .select('*')
        .order('reported_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFraudCases(data || []);
    } catch (error) {
      console.error('Error fetching fraud cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-700 bg-red-100';
      case 'HIGH': return 'text-orange-700 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-100';
      case 'LOW': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED': return 'text-green-700 bg-green-100';
      case 'CONFIRMED': return 'text-red-700 bg-red-100';
      case 'INVESTIGATING': return 'text-blue-700 bg-blue-100';
      case 'REPORTED': return 'text-orange-700 bg-orange-100';
      case 'ESCALATED': return 'text-purple-700 bg-purple-100';
      case 'FALSE_POSITIVE': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fraud cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            Fraud Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and investigate fraud cases across the platform
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cases</p>
                <p className="text-3xl font-bold text-gray-900">{fraudCases.length}</p>
              </div>
              <Shield className="w-10 h-10 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-3xl font-bold text-blue-600">
                  {fraudCases.filter(c => ['REPORTED', 'INVESTIGATING', 'ESCALATED'].includes(c.status)).length}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-3xl font-bold text-green-600">
                  {fraudCases.filter(c => c.status === 'RESOLVED').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Financial Impact</p>
                <p className="text-3xl font-bold text-red-600">
                  ₹{(fraudCases.reduce((sum, c) => sum + (c.financial_impact || 0), 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('REPORTED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'REPORTED'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reported
            </button>
            <button
              onClick={() => setFilterStatus('INVESTIGATING')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'INVESTIGATING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Investigating
            </button>
            <button
              onClick={() => setFilterStatus('CONFIRMED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'CONFIRMED'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setFilterStatus('RESOLVED')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'RESOLVED'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Fraud Cases List */}
        <div className="space-y-4">
          {fraudCases.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No fraud cases found</p>
              <p className="text-gray-400 text-sm mt-2">All clear! 🎉</p>
            </div>
          ) : (
            fraudCases.map((fraudCase) => (
              <div key={fraudCase.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {fraudCase.case_number}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getSeverityColor(fraudCase.severity)}`}>
                        {fraudCase.severity}
                      </span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(fraudCase.status)}`}>
                        {fraudCase.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <strong>Type:</strong> {fraudCase.case_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-gray-900">{fraudCase.fraud_description}</p>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      ₹{fraudCase.financial_impact?.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(fraudCase.reported_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {fraudCase.investigation_notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Investigation:</strong> {fraudCase.investigation_notes}
                    </p>
                  </div>
                )}

                {fraudCase.resolution_notes && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-900">
                      <strong>Resolution:</strong> {fraudCase.resolution_notes}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t">
                  {fraudCase.status === 'REPORTED' && (
                    <>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        Start Investigation
                      </button>
                      <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                        Mark False Positive
                      </button>
                    </>
                  )}
                  {fraudCase.status === 'INVESTIGATING' && (
                    <>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                        Confirm Fraud
                      </button>
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                        Escalate
                      </button>
                    </>
                  )}
                  {fraudCase.status === 'CONFIRMED' && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                      Mark Resolved
                    </button>
                  )}
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

