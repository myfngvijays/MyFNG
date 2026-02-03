'use client';

import React, { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { Shield, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";

export default function FraudManagementPage() {
  const supabase = getBrowserClient();
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
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading fraud cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
            <span className="truncate">Fraud Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
            Monitor and investigate fraud cases across the platform
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Cases</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{fraudCases.length}</p>
              </div>
              <Shield className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-gray-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Active</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">
                  {fraudCases.filter(c => ['REPORTED', 'INVESTIGATING', 'ESCALATED'].includes(c.status)).length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-blue-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Resolved</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                  {fraudCases.filter(c => c.status === 'RESOLVED').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-green-400 flex-shrink-0" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Financial Impact</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">
                  ₹{(fraudCases.reduce((sum, c) => sum + (c.financial_impact || 0), 0) / 1000).toFixed(1)}K
                </p>
              </div>
              <XCircle className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 text-red-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('REPORTED')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === 'REPORTED'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reported
            </button>
            <button
              onClick={() => setFilterStatus('INVESTIGATING')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === 'INVESTIGATING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Investigating
            </button>
            <button
              onClick={() => setFilterStatus('CONFIRMED')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === 'CONFIRMED'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setFilterStatus('RESOLVED')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
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
        <div className="space-y-3 sm:space-y-4">
          {fraudCases.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
              <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No fraud cases found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1.5 sm:mt-2">All clear! 🎉</p>
            </div>
          ) : (
            fraudCases.map((fraudCase) => (
              <div key={fraudCase.id} className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                        {fraudCase.case_number}
                      </h3>
                      <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getSeverityColor(fraudCase.severity)} flex-shrink-0`}>
                        {fraudCase.severity}
                      </span>
                      <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusColor(fraudCase.status)} flex-shrink-0`}>
                        {fraudCase.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">
                      <strong>Type:</strong> {fraudCase.case_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-900">{fraudCase.fraud_description}</p>
                  </div>

                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-bold text-red-600 mb-0.5 sm:mb-1">
                      ₹{fraudCase.financial_impact?.toLocaleString() || 0}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      {formatDateDMY(fraudCase.reported_at)}
                    </p>
                  </div>
                </div>

                {fraudCase.investigation_notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm text-blue-900">
                      <strong>Investigation:</strong> {fraudCase.investigation_notes}
                    </p>
                  </div>
                )}

                {fraudCase.resolution_notes && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm text-green-900">
                      <strong>Resolution:</strong> {fraudCase.resolution_notes}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:gap-4 pt-3 sm:pt-4 border-t">
                  {fraudCase.status === 'REPORTED' && (
                    <>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700">
                        Start Investigation
                      </button>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-600 text-white text-xs sm:text-sm rounded-lg hover:bg-gray-700">
                        Mark False Positive
                      </button>
                    </>
                  )}
                  {fraudCase.status === 'INVESTIGATING' && (
                    <>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700">
                        Confirm Fraud
                      </button>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white text-xs sm:text-sm rounded-lg hover:bg-purple-700">
                        Escalate
                      </button>
                    </>
                  )}
                  {fraudCase.status === 'CONFIRMED' && (
                    <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700">
                      Mark Resolved
                    </button>
                  )}
                  <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-200">
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

