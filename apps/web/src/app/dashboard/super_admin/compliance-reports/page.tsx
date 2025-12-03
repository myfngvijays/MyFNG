'use client';

import { useState } from 'react';
import { FileCheck, Download, Loader2, FileText, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ComplianceReportsPage() {
  const [reportType, setReportType] = useState<string>('general');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    setGenerating(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        start_date: startDate,
        end_date: endDate,
        format: format,
      });

      const response = await fetch(`/api/audit/compliance-report?${params.toString()}`);

      if (format === 'csv') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-report-${reportType}-${startDate}-to-${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      } else {
        const data = await response.json();
        if (response.ok) {
          // Download as JSON file
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `compliance-report-${reportType}-${startDate}-to-${endDate}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Report downloaded successfully');
        } else {
          toast.error(data.error || 'Failed to generate report');
        }
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('An error occurred while generating the report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-yellow-300" />
            <div>
              <h1 className="text-3xl font-bold">Compliance Reports</h1>
              <p className="text-white/90 mt-1">Generate audit reports for GDPR, SOC2, and ISO27001 compliance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Generator */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-text-heading mb-6">Generate Compliance Report</h2>

        <div className="space-y-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-text-body mb-2">Report Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setReportType('general')}
                className={`p-4 rounded-lg border-2 transition ${
                  reportType === 'general'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">General Audit</div>
                <div className="text-xs text-gray-600 mt-1">Summary statistics</div>
              </button>

              <button
                onClick={() => setReportType('gdpr')}
                className={`p-4 rounded-lg border-2 transition ${
                  reportType === 'gdpr'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <Shield className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">GDPR</div>
                <div className="text-xs text-gray-600 mt-1">Data privacy compliance</div>
              </button>

              <button
                onClick={() => setReportType('soc2')}
                className={`p-4 rounded-lg border-2 transition ${
                  reportType === 'soc2'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">SOC2</div>
                <div className="text-xs text-gray-600 mt-1">Security & availability</div>
              </button>

              <button
                onClick={() => setReportType('iso27001')}
                className={`p-4 rounded-lg border-2 transition ${
                  reportType === 'iso27001'
                    ? 'border-orange-600 bg-orange-50 text-orange-700'
                    : 'border-gray-300 hover:border-orange-400'
                }`}
              >
                <Shield className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">ISO27001</div>
                <div className="text-xs text-gray-600 mt-1">Information security</div>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-body mb-2">Start Date</label>
              <input
                type="date"
                className="form-input w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-body mb-2">End Date</label>
              <input
                type="date"
                className="form-input w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-text-body mb-2">Export Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                  className="form-radio"
                />
                <span>JSON</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                  className="form-radio"
                />
                <span>CSV</span>
              </label>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !startDate || !endDate}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate & Download Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <h3 className="text-lg font-bold text-text-heading">GDPR Compliance</h3>
          </div>
          <p className="text-sm text-text-body">
            Track data access logs, deletion requests, and user consents for GDPR compliance.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-8 h-8 text-purple-600" />
            <h3 className="text-lg font-bold text-text-heading">SOC2 Compliance</h3>
          </div>
          <p className="text-sm text-text-body">
            Monitor access controls, security events, and change management for SOC2 audits.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-8 h-8 text-orange-600" />
            <h3 className="text-lg font-bold text-text-heading">ISO27001 Compliance</h3>
          </div>
          <p className="text-sm text-text-body">
            Track information security events, audit trails, and data integrity for ISO27001.
          </p>
        </div>
      </div>
    </div>
  );
}

