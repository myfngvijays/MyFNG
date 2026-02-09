/**
 * RSA Manager Service
 * Handles all RSA lead management operations for RSA_MANAGER role
 */

import { createClient } from '../supabase/client';

export interface RSALead {
  id: string;
  customer_name: string;
  contact_number: string;
  vehicle_number: string;
  vehicle_model?: string;
  service_type: string;
  priority: string;
  lead_status: string;
  complaint_status: string;
  address?: string;
  pincode?: string;
  location_link?: string;
  latitude?: number;
  longitude?: number;
  media_upload?: string[];
  customer_quoted_amount?: number;
  assigned_manager_id?: string;
  assigned_manager_name?: string;
  assigned_mechanic_id?: string;
  assigned_mechanic_name?: string;
  assigned_mechanic_contact?: string;
  requested_at: string;
  lead_registered_at: string;
  assigned_to_manager_at?: string;
  mechanic_assigned_datetime?: string;
  mechanic_reached_datetime?: string;
  mechanic_completed_datetime?: string;
  assigned_remark?: string;
  dispatch_remark?: string;
  reached_remark?: string;
  complete_remark?: string;
  remark?: string;
}

export interface RSAManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface CompanyMechanicRSA {
  id: string;
  mechanic_code: string;
  mechanic_name: string;
  number: string;
  alternate_number1?: string;
  alternate_number2?: string;
  service_tag?: string;
  service_tag2?: string;
  service_tag3?: string;
  timing?: string;
  active: boolean;
  service_areas?: string[];
  is_available: boolean;
  rating?: number;
  total_jobs_completed?: number;
}

export interface TimelineEntry {
  id: string;
  status: string;
  status_description?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  updated_at: string;
  created_at: string;
}

export class RSAManagerService {
  // Get all RSA leads
  static async getAllLeads(
    managerId?: string,
    status?: string,
    showAll: boolean = true
  ): Promise<RSALead[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_all_leads', {
        p_manager_id: managerId || null,
        p_status: status || '',
        p_show_all: showAll
      });

      if (error) {
        console.error('Error fetching RSA leads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllLeads:', error);
      return [];
    }
  }

  // Get registered/unassigned leads
  static async getRegisteredLeads(
    managerId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<RSALead[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_registered_leads', {
        p_manager_id: managerId,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Error fetching registered leads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRegisteredLeads:', error);
      return [];
    }
  }

  // Get lead detail
  static async getLeadById(leadId: string): Promise<RSALead | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_lead_detail', {
        p_lead_id: leadId
      });

      if (error) {
        console.error('Error fetching lead detail:', error);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error in getLeadById:', error);
      return null;
    }
  }

  // Get lead timeline
  static async getLeadTimeline(leadId: string): Promise<TimelineEntry[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_lead_timeline', {
        p_lead_id: leadId
      });

      if (error) {
        console.error('Error fetching lead timeline:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getLeadTimeline:', error);
      return [];
    }
  }

  // Self-assign lead
  static async claimLead(
    leadId: string,
    managerId: string,
    managerName: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_self_assign_lead', {
        p_lead_id: leadId,
        p_manager_id: managerId,
        p_manager_name: managerName
      });

      if (error) {
        console.error('Error self-assigning lead:', error);
        return { success: false, message: error.message };
      }

      return data && data.length > 0 ? data[0] : { success: false, message: 'Unknown error' };
    } catch (error: any) {
      console.error('Error in claimLead:', error);
      return { success: false, message: error.message || 'Failed to assign lead' };
    }
  }

  // Assign lead to another manager
  static async assignLead(
    leadId: string,
    assignerId: string,
    targetManagerId: string,
    assignerName?: string,
    targetManagerName?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_assign_lead', {
        p_lead_id: leadId,
        p_assigner_id: assignerId,
        p_target_manager_id: targetManagerId,
        p_assigner_name: assignerName || null,
        p_target_manager_name: targetManagerName || null
      });

      if (error) {
        console.error('Error assigning lead:', error);
        return { success: false, message: error.message };
      }

      return data && data.length > 0 ? data[0] : { success: false, message: 'Unknown error' };
    } catch (error: any) {
      console.error('Error in assignLead:', error);
      return { success: false, message: error.message || 'Failed to assign lead' };
    }
  }

  // Get all RSA managers
  static async getAllManagers(): Promise<RSAManager[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_all_managers');

      if (error) {
        console.error('Error fetching managers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllManagers:', error);
      return [];
    }
  }

  // Assign company mechanic
  static async assignMechanic(
    leadId: string,
    mechanicId: string,
    options?: {
      payment?: number;
      remark?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_assign_mechanic', {
        p_lead_id: leadId,
        p_mechanic_id: mechanicId,
        p_payment_amount: options?.payment || null,
        p_remark: options?.remark || null
      });

      if (error) {
        console.error('Error assigning mechanic:', error);
        return { success: false, message: error.message };
      }

      return data && data.length > 0 ? data[0] : { success: false, message: 'Unknown error' };
    } catch (error: any) {
      console.error('Error in assignMechanic:', error);
      return { success: false, message: error.message || 'Failed to assign mechanic' };
    }
  }

  // Search company mechanics
  static async searchMechanics(searchParams: {
    pincode?: string;
    serviceTag?: string;
    searchTerm?: string;
  }): Promise<CompanyMechanicRSA[]> {
    try {
      // Prefer server API (uses service role; avoids RPC/schema mismatch in DB)
      const params = new URLSearchParams();
      if (searchParams.pincode) params.set('pincode', String(searchParams.pincode));
      if (searchParams.serviceTag) params.set('serviceTag', String(searchParams.serviceTag));
      if (searchParams.searchTerm) params.set('searchTerm', String(searchParams.searchTerm));

      const res = await fetch(`/api/rsa/mechanics?${params.toString()}`);
      const json = await res.json().catch(() => []);
      if (!res.ok) {
        const msg = (json as any)?.error || 'Failed to search mechanics';
        console.error('Error searching mechanics via API:', msg, (json as any)?.details);
        return [];
      }

      const rows = Array.isArray(json) ? json : [];
      return rows.map((m: any) => ({
        ...m,
        // normalize service_areas: may come as string or array
        service_areas: Array.isArray(m.service_areas)
          ? m.service_areas
          : typeof m.service_areas === 'string'
            ? (() => {
                try {
                  const parsed = JSON.parse(m.service_areas);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
            : [],
      })) as any;
    } catch (error) {
      console.error('Error in searchMechanics:', error);
      return [];
    }
  }

  // Update lead status
  static async updateLeadStatus(
    leadId: string,
    status: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_update_lead_status', {
        p_lead_id: leadId,
        p_status: status,
        p_notes: notes || null
      });

      if (error) {
        console.error('Error updating lead status:', error);
        return { success: false, message: error.message };
      }

      return data && data.length > 0 ? data[0] : { success: false, message: 'Unknown error' };
    } catch (error: any) {
      console.error('Error in updateLeadStatus:', error);
      return { success: false, message: error.message || 'Failed to update status' };
    }
  }

  // Get manager statistics
  static async getManagerStatistics(managerId: string): Promise<{
    total_leads: number;
    pending_leads: number;
    completed_leads: number;
    cancelled_leads: number;
    assigned_to_me: number;
    unassigned_leads: number;
  }> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('rsa_manager_get_statistics', {
        p_manager_id: managerId
      });

      if (error) {
        console.error('Error fetching statistics:', error);
        return {
          total_leads: 0,
          pending_leads: 0,
          completed_leads: 0,
          cancelled_leads: 0,
          assigned_to_me: 0,
          unassigned_leads: 0
        };
      }

      return data && data.length > 0 ? data[0] : {
        total_leads: 0,
        pending_leads: 0,
        completed_leads: 0,
        cancelled_leads: 0,
        assigned_to_me: 0,
        unassigned_leads: 0
      };
    } catch (error) {
      console.error('Error in getManagerStatistics:', error);
      return {
        total_leads: 0,
        pending_leads: 0,
        completed_leads: 0,
        cancelled_leads: 0,
        assigned_to_me: 0,
        unassigned_leads: 0
      };
    }
  }
}

