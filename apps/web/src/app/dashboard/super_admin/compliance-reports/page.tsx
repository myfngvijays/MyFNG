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
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <FileCheck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-300 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Compliance Reports</h1>
              <p className="text-white/90 text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Generate audit reports for GDPR, SOC2, and ISO27001 compliance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Generator */}
      <div className="card p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-text-heading mb-4 sm:mb-5 md:mb-6">Generate Compliance Report</h2>

        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {/* Report Type */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-2">Report Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => setReportType('general')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                  reportType === 'general'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 sm:mb-2" />
                <div className="font-semibold text-xs sm:text-sm">General Audit</div>
                <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">Summary statistics</div>
              </button>

              <button
                onClick={() => setReportType('gdpr')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                  reportType === 'gdpr'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 sm:mb-2" />
                <div className="font-semibold text-xs sm:text-sm">GDPR</div>
                <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">Data privacy compliance</div>
              </button>

              <button
                onClick={() => setReportType('soc2')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                  reportType === 'soc2'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 sm:mb-2" />
                <div className="font-semibold text-xs sm:text-sm">SOC2</div>
                <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">Security & availability</div>
              </button>

              <button
                onClick={() => setReportType('iso27001')}
                className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                  reportType === 'iso27001'
                    ? 'border-orange-600 bg-orange-50 text-orange-700'
                    : 'border-gray-300 hover:border-orange-400'
                }`}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1.5 sm:mb-2" />
                <div className="font-semibold text-xs sm:text-sm">ISO27001</div>
                <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">Information security</div>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Start Date</label>
              <input
                type="date"
                className="form-input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">End Date</label>
              <input
                type="date"
                className="form-input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-text-body mb-1.5 sm:mb-2">Export Format</label>
            <div className="flex gap-3 sm:gap-4">
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                  className="form-radio w-4 h-4 sm:w-5 sm:h-5"
                />
                <span className="text-xs sm:text-sm">JSON</span>
              </label>
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'json' | 'csv')}
                  className="form-radio w-4 h-4 sm:w-5 sm:h-5"
                />
                <span className="text-xs sm:text-sm">CSV</span>
              </label>
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating || !startDate || !endDate}
              className="btn-primary flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Generate & Download Report</span>
                  <span className="sm:hidden">Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        <div className="card p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-text-heading">GDPR Compliance</h3>
          </div>
          <p className="text-xs sm:text-sm text-text-body">
            Track data access logs, deletion requests, and user consents for GDPR compliance.
          </p>
        </div>

        <div className="card p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-text-heading">SOC2 Compliance</h3>
          </div>
          <p className="text-xs sm:text-sm text-text-body">
            Monitor access controls, security events, and change management for SOC2 audits.
          </p>
        </div>

        <div className="card p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-text-heading">ISO27001 Compliance</h3>
          </div>
          <p className="text-xs sm:text-sm text-text-body">
            Track information security events, audit trails, and data integrity for ISO27001.
          </p>
        </div>
      </div>
    </div>
  );
}

