/**
 * Database types for Supabase
 * These should match your Supabase schema
 */

export type Database = {
  public: {
    Tables: {
      home_carousel_banners: {
        Row: {
          id: string;
          title: string | null;
          image_url: string;
          route_name: string;
          route_params: Record<string, any>;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['home_carousel_banners']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['home_carousel_banners']['Insert']>;
      };
      users_login: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          full_name: string;
          role_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          profile_image: string | null;
          department: string | null;
          workshop_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users_login']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users_login']['Insert']>;
      };
      roles: {
        Row: {
          id: string;
          role_code: string;
          role_name: string;
          description: string | null;
          permissions: Record<string, any>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      workshops: {
        Row: {
          id: string;
          name: string;
          address: string;
          city: string;
          state: string;
          pincode: string;
          contact_person: string;
          phone: string;
          email: string;
          is_verified: boolean;
          audit_score: number | null;
          gst_number: string | null;
          map_link: string | null;
          latitude: number | null;
          longitude: number | null;
          zone_id: string | null;
          bank_account_number: string | null;
          ifsc_code: string | null;
          upi_id: string | null;
          commission_percentage: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      service_leads: {
        Row: {
          id: string;
          lead_number: string;
          lead_type: 'NORMAL' | 'RSA' | 'HOME_SERVICE';
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          vehicle_number: string;
          vehicle_make: string | null;
          vehicle_model: string | null;
          vehicle_year: number | null;
          service_type: string;
          description: string | null;
          estimated_amount: number | null;
          actual_amount: number | null;
          status: 'NEW' | 'ASSIGNED' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
          priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          assigned_to_id: string | null;
          workshop_id: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          address: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          notes: string | null;
          internal_notes: string | null;
          assigned_at: string | null;
          accepted_at: string | null;
          declined_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_by_id: string | null;
          updated_by_id: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

