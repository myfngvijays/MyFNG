'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { 
  ArrowLeft, Phone, Wrench, MapPin, Clock, 
  CheckCircle, XCircle, Star, TrendingUp, 
  Mail, Calendar, Building, AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

export default function RSAMechanicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const mechanicId = params?.id as string;
  
  const [mechanic, setMechanic] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (mechanicId) {
      fetchMechanicDetail();
      fetchAssignments();
    }
  }, [mechanicId]);

  const fetchMechanicDetail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_mechanic_rsa')
        .select('*')
        .eq('id', mechanicId)
        .single();

      if (error) throw error;
      setMechanic(data);
    } catch (error: any) {
      console.error('Error fetching mechanic:', error);
      toast.error('Failed to load mechanic details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('rsa_leads')
        .select('id, customer_name, contact_number, vehicle_number, lead_status, requested_at, service_type')
        .eq('assigned_mechanic_id', mechanicId)
        .order('requested_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const handleToggleAvailability = async () => {
    if (!mechanic) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('company_mechanic_rsa')
        .update({ is_available: !mechanic.is_available })
        .eq('id', mechanicId);

      if (error) throw error;
      
      setMechanic({ ...mechanic, is_available: !mechanic.is_available });
      toast.success(`Mechanic marked as ${!mechanic.is_available ? 'Available' : 'Busy'}`);
    } catch (error: any) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    } finally {
      setUpdating(false);
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (loading) {
    return (
      <DashboardLayout role="rsa_manager">
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 animate-spin text-brand-primary mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading mechanic details...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!mechanic) {
    return (
      <DashboardLayout role="rsa_manager">
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
          <div className="text-center py-8 sm:py-10 md:py-12">
            <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-red-500 mx-auto mb-2 sm:mb-3 md:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2">Mechanic Not Found</h2>
            <p className="text-gray-600 mb-4 sm:mb-5 md:mb-6 text-xs sm:text-sm md:text-base">The mechanic you're looking for doesn't exist.</p>
            <Link
              href="/dashboard/rsa_manager/mechanics"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors text-xs sm:text-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Back to Mechanics
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6">
          <Link
            href="/dashboard/rsa_manager/mechanics"
            className="inline-flex items-center gap-1.5 sm:gap-2 text-brand-primary hover:text-brand-primary-hover mb-3 sm:mb-4 text-xs sm:text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Back to Mechanics</span>
          </Link>
          
          <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">{mechanic.mechanic_name}</h1>
                <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base">Code: {mechanic.mechanic_code}</p>
              </div>
              <div
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm ${
                  mechanic.is_available
                    ? 'bg-green-500/20 text-green-100'
                    : 'bg-red-500/20 text-red-100'
                }`}
              >
                {mechanic.is_available ? (
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                )}
                <span className="font-semibold">
                  {mechanic.is_available ? 'Available' : 'Busy'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Basic Information</h2>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-text-secondary">Mechanic Name</span>
                  <span className="text-xs sm:text-sm text-text-body font-semibold">{mechanic.mechanic_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                  <span className="text-xs sm:text-sm font-medium text-text-secondary">Mechanic Code</span>
                  <span className="text-xs sm:text-sm text-text-body font-semibold">{mechanic.mechanic_code}</span>
                </div>
                {mechanic.timing && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary">Availability Timing</span>
                    <span className="text-xs sm:text-sm text-text-body">{mechanic.timing}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2">
                  <span className="text-xs sm:text-sm font-medium text-text-secondary">Status</span>
                  <span className={`text-xs sm:text-sm font-semibold ${
                    mechanic.active ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {mechanic.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Contact Information</h2>
              <div className="space-y-2 sm:space-y-3">
                <button
                  onClick={() => handleCall(mechanic.number)}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[10px] sm:text-xs text-text-secondary">Primary Number</p>
                    <p className="text-xs sm:text-sm font-semibold text-text-body truncate">{mechanic.number}</p>
                  </div>
                </button>

                {mechanic.alternate_number1 && (
                  <button
                    onClick={() => handleCall(mechanic.alternate_number1)}
                    className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                  >
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[10px] sm:text-xs text-text-secondary">Alternate Number 1</p>
                      <p className="text-xs sm:text-sm font-semibold text-text-body truncate">{mechanic.alternate_number1}</p>
                    </div>
                  </button>
                )}

                {mechanic.alternate_number2 && (
                  <button
                    onClick={() => handleCall(mechanic.alternate_number2)}
                    className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-gray-200 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                  >
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[10px] sm:text-xs text-text-secondary">Alternate Number 2</p>
                      <p className="text-xs sm:text-sm font-semibold text-text-body truncate">{mechanic.alternate_number2}</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Service Information */}
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Service Information</h2>
              <div className="space-y-3 sm:space-y-4">
                {mechanic.service_tag && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary">Primary Service</span>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] sm:text-xs font-semibold">
                      {mechanic.service_tag}
                    </span>
                  </div>
                )}
                {mechanic.service_tag2 && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary">Secondary Service</span>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] sm:text-xs font-semibold">
                      {mechanic.service_tag2}
                    </span>
                  </div>
                )}
                {mechanic.service_tag3 && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2 border-b border-gray-100">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary">Tertiary Service</span>
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-[10px] sm:text-xs font-semibold">
                      {mechanic.service_tag3}
                    </span>
                  </div>
                )}
                {mechanic.service_areas && mechanic.service_areas.length > 0 && (
                  <div className="py-2">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary block mb-1.5 sm:mb-2">Service Areas</span>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {mechanic.service_areas.map((area: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] sm:text-xs"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mechanic.current_location && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-2">
                    <span className="text-xs sm:text-sm font-medium text-text-secondary">Current Location</span>
                    <span className="text-xs sm:text-sm text-text-body break-words">{mechanic.current_location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Assignments */}
            {assignments.length > 0 && (
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Recent Assignments</h2>
                <div className="space-y-2 sm:space-y-3">
                  {assignments.map((assignment) => (
                    <Link
                      key={assignment.id}
                      href={`/dashboard/rsa_manager/leads/${assignment.id}`}
                      className="block p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0 mb-1.5 sm:mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-text-heading text-sm sm:text-base truncate">{assignment.customer_name}</h3>
                          {assignment.vehicle_number && (
                            <p className="text-xs sm:text-sm text-text-secondary mt-0.5 sm:mt-1">
                              Vehicle: {assignment.vehicle_number}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold self-start sm:self-auto ${
                            assignment.lead_status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {assignment.lead_status}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[10px] sm:text-xs text-text-secondary mt-1.5 sm:mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{new Date(assignment.requested_at).toLocaleString()}</span>
                        </span>
                        {assignment.service_type && (
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{assignment.service_type}</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats & Actions */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            {/* Performance Stats */}
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Performance</h2>
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-lg">
                  <Star className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-500 fill-yellow-500 mx-auto mb-1.5 sm:mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold text-text-heading">
                    {mechanic.rating ? mechanic.rating.toFixed(1) : '0.0'}
                  </p>
                  <p className="text-xs sm:text-sm text-text-secondary">Rating</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold text-text-heading">
                    {mechanic.total_jobs_completed || 0}
                  </p>
                  <p className="text-xs sm:text-sm text-text-secondary">Jobs Completed</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 lg:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Actions</h2>
              <button
                onClick={handleToggleAvailability}
                disabled={updating}
                className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-semibold transition-colors text-xs sm:text-sm ${
                  mechanic.is_available
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    {mechanic.is_available ? (
                      <>
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Mark as Busy</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Mark as Available</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

