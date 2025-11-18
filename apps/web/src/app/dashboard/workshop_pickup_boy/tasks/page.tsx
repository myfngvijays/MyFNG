'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Truck, MapPin, Camera, CheckCircle, Navigation, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function PickupTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      const { data: tasksData } = await supabase
        .from('pickup_delivery_tasks')
        .select('*')
        .eq('assigned_to_id', userProfile.id)
        .in('status', ['ASSIGNED', 'IN_TRANSIT'])
        .order('scheduled_time', { ascending: true });

      setTasks(tasksData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    const supabase = createClient();
    
    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'IN_TRANSIT') {
      updates.started_at = new Date().toISOString();
    } else if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('pickup_delivery_tasks')
      .update(updates)
      .eq('id', taskId);

    if (!error) {
      fetchTasks();
    }
  }

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'PICKUP': 'bg-blue-100 text-blue-700',
      'DELIVERY': 'bg-green-100 text-green-700',
      'BOTH': 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading">My Tasks</h1>
          <p className="text-text-body mt-2">Manage your pickup and delivery tasks</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-gray-600">Total Tasks</p>
            <p className="text-2xl font-bold">{tasks.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Assigned</p>
            <p className="text-2xl font-bold text-blue-600">
              {tasks.filter(t => t.status === 'ASSIGNED').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">In Transit</p>
            <p className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.status === 'IN_TRANSIT').length}
            </p>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="card hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{task.task_number}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${getTaskTypeColor(task.task_type)}`}>
                    {task.task_type.replace('_', ' ')}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  task.status === 'IN_TRANSIT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {task.status === 'IN_TRANSIT' ? 'In Transit' : 'Assigned'}
                </span>
              </div>

              <div className="space-y-4 mb-4">
                {/* Customer Info */}
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{task.customer_name}</p>
                  <p className="text-sm text-gray-600">{task.customer_phone}</p>
                </div>

                {/* Vehicle */}
                <div>
                  <p className="text-sm text-gray-600">Vehicle</p>
                  <p className="font-semibold">{task.vehicle_number}</p>
                  {(task.vehicle_make || task.vehicle_model) && (
                    <p className="text-sm text-gray-600">{task.vehicle_make} {task.vehicle_model}</p>
                  )}
                </div>

                {/* Pickup Address */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-semibold mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Pickup Address
                  </p>
                  <p className="text-sm">{task.pickup_address}</p>
                </div>

                {/* Delivery Address */}
                {task.delivery_address && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-semibold mb-1 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Delivery Address
                    </p>
                    <p className="text-sm">{task.delivery_address}</p>
                  </div>
                )}

                {/* Customer Instructions */}
                {task.customer_instructions && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-700 font-semibold mb-1">Instructions</p>
                    <p className="text-sm">{task.customer_instructions}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {task.status === 'ASSIGNED' && (
                  <>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'IN_TRANSIT')}
                      className="btn bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Navigation className="w-5 h-5" />
                      Start Task
                    </button>
                    <button className="btn btn-outline">
                      <MapPin className="w-5 h-5" />
                      Get Directions
                    </button>
                  </>
                )}
                {task.status === 'IN_TRANSIT' && (
                  <>
                    <button className="btn btn-outline">
                      <Camera className="w-5 h-5" />
                      Upload Photos
                    </button>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                      className="btn bg-green-500 hover:bg-green-600 text-white"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Complete Task
                    </button>
                  </>
                )}
              </div>

              {task.scheduled_time && (
                <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                  Scheduled: {new Date(task.scheduled_time).toLocaleString()}
                </div>
              )}
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="card text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tasks assigned to you</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

