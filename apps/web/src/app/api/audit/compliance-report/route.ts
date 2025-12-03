/**
 * Compliance Report Generator API
 * GET /api/audit/compliance-report - Generate compliance reports (GDPR, SOC2, ISO27001)
 */

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/audit/compliance-report
 * Generate compliance reports
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is Super Admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'general'; // general, gdpr, soc2, iso27001
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const format = searchParams.get('format') || 'json'; // json, csv

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }

    // Generate report based on type
    let report: any = {
      report_type: reportType,
      generated_at: new Date().toISOString(),
      period: {
        start: startDate || null,
        end: endDate || null,
      },
    };

    switch (reportType) {
      case 'gdpr':
        report = await generateGDPRReport(supabase, dateFilter);
        break;
      case 'soc2':
        report = await generateSOC2Report(supabase, dateFilter);
        break;
      case 'iso27001':
        report = await generateISO27001Report(supabase, dateFilter);
        break;
      default:
        report = await generateGeneralReport(supabase, dateFilter);
    }

    // Add metadata
    report.report_type = reportType;
    report.generated_at = new Date().toISOString();
    report.period = {
      start: startDate || null,
      end: endDate || null,
    };

    // Convert to CSV if requested
    if (format === 'csv') {
      const csv = convertReportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="compliance-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate GDPR Compliance Report
 */
async function generateGDPRReport(supabase: any, dateFilter: any) {
  const report: any = {
    compliance_standard: 'GDPR',
    sections: {},
  };

  // Data Access Requests
  const { data: accessLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('compliance_flags->>gdpr_relevant', 'true')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  // Data Deletion Requests
  const { data: deletionRequests } = await supabase
    .from('data_deletion_requests')
    .select('*')
    .gte('requested_at', dateFilter.gte || '1970-01-01')
    .lte('requested_at', dateFilter.lte || new Date().toISOString())
    .order('requested_at', { ascending: false });

  // User Consents
  const { data: consents } = await supabase
    .from('user_consents')
    .select('*')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  report.sections = {
    data_access_logs: {
      total: accessLogs?.length || 0,
      logs: accessLogs || [],
    },
    deletion_requests: {
      total: deletionRequests?.length || 0,
      pending: deletionRequests?.filter((r: any) => r.status === 'PENDING').length || 0,
      processed: deletionRequests?.filter((r: any) => r.status !== 'PENDING').length || 0,
      requests: deletionRequests || [],
    },
    user_consents: {
      total: consents?.length || 0,
      granted: consents?.filter((c: any) => c.consent_given).length || 0,
      denied: consents?.filter((c: any) => !c.consent_given).length || 0,
      consents: consents || [],
    },
  };

  return report;
}

/**
 * Generate SOC2 Compliance Report
 */
async function generateSOC2Report(supabase: any, dateFilter: any) {
  const report: any = {
    compliance_standard: 'SOC2',
    sections: {},
  };

  // Access Controls
  const { data: accessLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('compliance_flags->>soc2_relevant', 'true')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  // Security Events
  const { data: securityEvents } = await supabase
    .from('security_events')
    .select('*')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  // Configuration Changes
  const { data: configChanges } = await supabase
    .from('system_config_changes')
    .select('*')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  report.sections = {
    access_controls: {
      total_logs: accessLogs?.length || 0,
      logs: accessLogs || [],
    },
    security_events: {
      total: securityEvents?.length || 0,
      critical: securityEvents?.filter((e: any) => e.severity === 'CRITICAL').length || 0,
      high: securityEvents?.filter((e: any) => e.severity === 'HIGH').length || 0,
      resolved: securityEvents?.filter((e: any) => e.resolved).length || 0,
      unresolved: securityEvents?.filter((e: any) => !e.resolved).length || 0,
      events: securityEvents || [],
    },
    change_management: {
      total_changes: configChanges?.length || 0,
      approved: configChanges?.filter((c: any) => c.approved_by).length || 0,
      pending_approval: configChanges?.filter((c: any) => !c.approved_by).length || 0,
      changes: configChanges || [],
    },
  };

  return report;
}

/**
 * Generate ISO27001 Compliance Report
 */
async function generateISO27001Report(supabase: any, dateFilter: any) {
  const report: any = {
    compliance_standard: 'ISO27001',
    sections: {},
  };

  // Security Events
  const { data: securityEvents } = await supabase
    .from('security_events')
    .select('*')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  // Audit Logs with ISO27001 flags
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('compliance_flags->>iso27001_relevant', 'true')
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString())
    .order('created_at', { ascending: false });

  // Data Integrity Check
  const { data: integrityResults } = await supabase.rpc('verify_audit_log_integrity', {
    p_log_id: null,
    p_start_date: dateFilter.gte || null,
    p_end_date: dateFilter.lte || null,
  });

  report.sections = {
    information_security_events: {
      total: securityEvents?.length || 0,
      by_severity: {
        critical: securityEvents?.filter((e: any) => e.severity === 'CRITICAL').length || 0,
        high: securityEvents?.filter((e: any) => e.severity === 'HIGH').length || 0,
        medium: securityEvents?.filter((e: any) => e.severity === 'MEDIUM').length || 0,
        low: securityEvents?.filter((e: any) => e.severity === 'LOW').length || 0,
      },
      events: securityEvents || [],
    },
    audit_trail: {
      total_logs: auditLogs?.length || 0,
      logs: auditLogs || [],
    },
    data_integrity: {
      total_checked: integrityResults?.length || 0,
      valid: integrityResults?.filter((r: any) => r.is_valid).length || 0,
      tampered: integrityResults?.filter((r: any) => r.tampered).length || 0,
      results: integrityResults || [],
    },
  };

  return report;
}

/**
 * Generate General Audit Report
 */
async function generateGeneralReport(supabase: any, dateFilter: any) {
  const report: any = {
    compliance_standard: 'GENERAL',
    sections: {},
  };

  // Summary statistics
  const { count: totalLogs } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString());

  const { count: totalSecurityEvents } = await supabase
    .from('security_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString());

  const { count: totalConfigChanges } = await supabase
    .from('system_config_changes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dateFilter.gte || '1970-01-01')
    .lte('created_at', dateFilter.lte || new Date().toISOString());

  report.sections = {
    summary: {
      total_audit_logs: totalLogs || 0,
      total_security_events: totalSecurityEvents || 0,
      total_config_changes: totalConfigChanges || 0,
    },
  };

  return report;
}

/**
 * Convert report to CSV format
 */
function convertReportToCSV(report: any): string {
  const lines: string[] = [];
  
  lines.push(`Compliance Report: ${report.compliance_standard}`);
  lines.push(`Generated At: ${report.generated_at}`);
  lines.push(`Period: ${report.period.start || 'N/A'} to ${report.period.end || 'N/A'}`);
  lines.push('');

  // Convert sections to CSV
  for (const [sectionName, sectionData] of Object.entries(report.sections)) {
    lines.push(`Section: ${sectionName}`);
    
    if (Array.isArray(sectionData)) {
      // Array of objects
      if (sectionData.length > 0) {
        const headers = Object.keys(sectionData[0]).join(',');
        lines.push(headers);
        sectionData.forEach((item: any) => {
          const values = Object.values(item).map((v: any) => 
            typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
          ).join(',');
          lines.push(values);
        });
      }
    } else if (typeof sectionData === 'object') {
      // Object with nested data
      lines.push(JSON.stringify(sectionData, null, 2));
    }
    
    lines.push('');
  }

  return lines.join('\n');
}

