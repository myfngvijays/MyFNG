import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRoleKey) return { supabaseAdmin: null as any, error: 'SUPABASE_SERVICE_ROLE_KEY not set' };
  const supabaseAdmin = createSupabaseAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin, error: null };
}

async function readLeadMediaTypes(
  client: any,
  leadId: string
): Promise<{ ok: boolean; detected: string[]; error?: string }> {
  const requiredTypes = ['BEFORE_FRONT', 'BEFORE_REAR', 'BEFORE_LEFT', 'BEFORE_RIGHT', 'BEFORE_DASHBOARD', 'BEFORE_ENGINE_BAY'];
  try {
    // lead_media schema varies; try multiple selects
    const selects = ['file_url, file_name, category', 'file_url, file_name', 'file_url, category', 'file_url'] as const;
    let mediaRows: any[] = [];

    for (const sel of selects) {
      const { data, error } = (await client
        .from('lead_media')
        .select(sel as any)
        .eq('lead_id', leadId)
        .limit(200)) as any;
      if (!error && Array.isArray(data)) {
        mediaRows = data;
        break;
      }
    }

    const leadTypes = (mediaRows || [])
      .map((m: any) => {
        const t = String(m?.category || '').toUpperCase().trim();
        if (t) return t;
        const fn = String(m?.file_name || '');
        const mm = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
        if (mm?.[1]) return String(mm[1]).toUpperCase();
        const url = String(m?.file_url || '');
        const mu = url.match(/(BEFORE_[A-Z0-9_]+)_\d{4,}/);
        return (mu?.[1] || '').toUpperCase();
      })
      .filter((t: string) => requiredTypes.includes(t));

    const set = new Set<string>(leadTypes);
    const detected = Array.from(set);
    const ok = requiredTypes.every((t) => set.has(t));

    return { ok, detected };
  } catch (e: any) {
    return { ok: false, detected: [], error: e?.message || String(e) };
  }
}

// POST - Update job status
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Verify user is mechanic
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_MECHANIC') {
      return NextResponse.json({ error: 'Forbidden: Mechanic only' }, { status: 403 });
    }

    const leadId = params.id;

    // Get request body
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ['ASSIGNED', 'IN_PROGRESS', 'HOLD', 'WAITING_APPROVAL', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status',
        valid_statuses: validStatuses
      }, { status: 400 });
    }

    // Get current job
    const { data: currentJob, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('*, mechanic_status')
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .single();

    console.log('Current job query:', { leadId, mechanicId: userProfile.id, found: !!currentJob });

    if (jobError || !currentJob) {
      console.error('Job error:', jobError);
      return NextResponse.json({ 
        error: 'Job not found or not assigned to you',
        details: { leadId, mechanicId: userProfile.id, error: jobError?.message }
      }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updates: any = {
      mechanic_status: status,
      updated_at: now
    };

    // Set timestamps based on status
    switch (status) {
      case 'IN_PROGRESS':
        // Validate before inspection is complete
        if (!currentJob.before_inspection_complete) {
          // Check validation using RPC function
          const { data: validationResult, error: validationError } = await supabase.rpc(
            'validate_before_inspection',
            { job_id_param: currentJob.id }
          );

          if (validationError || !validationResult?.is_valid) {
            const missingPhotos = validationResult?.missing_photos || [];
            const photoCount = validationResult?.photo_count || 0;
            const minRequired = validationResult?.min_required || 6;
            let leadMediaDetected: string[] = [];
            let leadMediaUserRead: { ok: boolean; detected: string[]; error?: string } | null = null;
            let leadMediaAdminRead: { ok: boolean; detected: string[]; error?: string } | null = null;
            let leadMediaAdminReason: string | null = null;

            // First try as the logged-in mechanic (works if RLS permits)
            leadMediaUserRead = await readLeadMediaTypes(supabase as any, leadId);
            if (leadMediaUserRead.ok) {
              leadMediaDetected = leadMediaUserRead.detected;
              updates.before_inspection_complete = true;
              if (!currentJob.started_at) updates.started_at = now;
              break;
            }

            // Fallback: accept Pickup/Visit photos stored in lead_media (uploaded by supervisor/pickup boy)
            try {
              const { supabaseAdmin, error: adminErr } = getAdminClient();
              leadMediaAdminReason = adminErr || null;
              if (!supabaseAdmin) throw new Error(adminErr || 'No admin client');

              leadMediaAdminRead = await readLeadMediaTypes(supabaseAdmin as any, leadId);
              if (leadMediaAdminRead.ok) {
                leadMediaDetected = leadMediaAdminRead.detected;
                updates.before_inspection_complete = true;
                if (!currentJob.started_at) updates.started_at = now;
                break;
              }
            } catch {
              // ignore fallback errors; show standard error below
            }
            
            let errorMessage = 'Cannot start repair: Pickup/Visit photos incomplete. ';
            
            if (photoCount < minRequired) {
              errorMessage += `Required ${minRequired} photos, but only ${photoCount} uploaded. `;
            }
            
            if (missingPhotos && missingPhotos.length > 0) {
              const photoNames = missingPhotos.map((type: string) => 
                type.replace('BEFORE_', '').replace('_', ' ')
              ).join(', ');
              errorMessage += `Missing required photos: ${photoNames}. `;
            }
            
            errorMessage += 'Please upload all required Pickup/Visit photos with correct types (Front, Rear, Left, Right, Dashboard, Engine Bay).';
            
            return NextResponse.json({ 
              error: errorMessage,
              details: {
                message: 'Please complete Pickup/Visit photos checklist with all required photos',
                photo_count: photoCount,
                min_required: minRequired,
                missing_photos: missingPhotos,
                lead_media_detected: leadMediaDetected,
                lead_media_fallback: {
                  user_read: leadMediaUserRead,
                  admin_read: leadMediaAdminRead,
                  admin_reason: leadMediaAdminReason,
                },
              }
            }, { status: 400 });
          }
          
          // Mark before inspection as complete if validation passes
          updates.before_inspection_complete = true;
        }
        if (!currentJob.started_at) {
          updates.started_at = now;
        }
        break;
      case 'HOLD':
        updates.paused_at = now;
        break;
      case 'COMPLETED':
        // Validate before allowing completion using RPC function
        const { data: validationResult, error: validationError } = await supabase.rpc(
          'validate_after_service_completion',
          { job_id_param: currentJob.id }
        );

        if (validationError || !validationResult?.is_valid) {
          return NextResponse.json({ 
            error: 'Cannot complete job: Requirements not met',
            details: {
              message: 'Please complete all requirements before marking job as complete',
              photo_count: validationResult?.photo_count || 0,
              min_required: validationResult?.min_required || 6,
              missing_photos: validationResult?.missing_photos || [],
              checklist_completed: validationResult?.checklist_completed || false,
              parts_recorded: validationResult?.parts_recorded || false,
              notes_entered: validationResult?.notes_entered || false
            }
          }, { status: 400 });
        }
        updates.completed_at = now;
        break;
    }

    // Update mechanic_jobs
    const { data: updatedJob, error: updateError } = await supabase
      .from('mechanic_jobs')
      .update(updates)
      .eq('lead_id', leadId)
      .eq('mechanic_id', userProfile.id)
      .select();

    console.log('Update result:', { updatedJob, updateError, affectedRows: updatedJob?.length });

    if (updateError) {
      console.error('Error updating job status:', updateError);
      return NextResponse.json({ error: 'Failed to update job status' }, { status: 500 });
    }

    if (!updatedJob || updatedJob.length === 0) {
      return NextResponse.json({ 
        error: 'No job was updated. Job not found or not assigned to you.',
        details: { leadId, mechanicId: userProfile.id }
      }, { status: 404 });
    }

    const jobResult = updatedJob[0];

    // Get current lead status for history
    const { data: currentLead } = await supabase
      .from('service_leads')
      .select('status')
      .eq('id', leadId)
      .single();

    const oldLeadStatus = currentLead?.status || 'UNKNOWN';

    // Update service_leads based on mechanic job status
    if (status === 'COMPLETED') {
      await supabase
        .from('service_leads')
        .update({
          status: 'WORK_COMPLETED',
          mechanic_completed_at: now,
          updated_at: now
        })
        .eq('id', leadId);

      // Create status history
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: oldLeadStatus,
          new_status: 'WORK_COMPLETED',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Mechanic completed the job',
          notes: notes || 'Job completed by mechanic'
        });
    } else if (status === 'HOLD') {
      // Update service_leads to ON_HOLD when mechanic puts job on hold
      await supabase
        .from('service_leads')
        .update({
          status: 'ON_HOLD',
          updated_at: now
        })
        .eq('id', leadId);

      // Create status history
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: oldLeadStatus,
          new_status: 'ON_HOLD',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'Mechanic put job on hold',
          notes: notes || 'Job put on hold by mechanic'
        });
    } else if (status === 'IN_PROGRESS') {
      // Update service_leads to IN_PROGRESS when mechanic starts/resumes work
      if (oldLeadStatus !== 'IN_PROGRESS') {
        await supabase
          .from('service_leads')
          .update({
            status: 'IN_PROGRESS',
            mechanic_started_at: currentJob.started_at || now,
            updated_at: now
          })
          .eq('id', leadId);

        // Create status history
        await supabase
          .from('lead_status_history')
          .insert({
            lead_id: leadId,
            old_status: oldLeadStatus,
            new_status: 'IN_PROGRESS',
            changed_by: userProfile.id,
            changed_at: now,
            reason: oldLeadStatus === 'ON_HOLD' ? 'Mechanic resumed work from hold' : 'Mechanic started work',
            notes: notes || (oldLeadStatus === 'ON_HOLD' ? 'Work resumed' : 'Work started')
          });
      }
    }

    // Create activity log
    await supabase
      .from('mechanic_actions_log')
      .insert({
        lead_id: leadId,
        mechanic_id: userProfile.id,
        action_type: 'STATUS_CHANGED',
        action_description: `Status changed from ${currentJob.mechanic_status} to ${status}`,
        metadata: {
          old_status: currentJob.mechanic_status,
          new_status: status,
          notes
        }
      });

    // Calculate work duration if needed
    if (status === 'COMPLETED' && currentJob.started_at) {
      const startTime = new Date(currentJob.started_at).getTime();
      const endTime = new Date(now).getTime();
      const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));
      
      await supabase
        .from('mechanic_jobs')
        .update({
          actual_work_duration: durationMinutes
        })
        .eq('lead_id', leadId);
    }

    return NextResponse.json({
      success: true,
      message: 'Job status updated successfully',
      job: jobResult,
      old_status: currentJob.mechanic_status,
      new_status: status
    }, { status: 200 });

  } catch (error) {
    console.error('Error in update status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get current job status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClientFromRequest(request);
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;

    // Get job status
    const { data: job, error: jobError } = await supabase
      .from('mechanic_jobs')
      .select('mechanic_status, started_at, paused_at, completed_at, updated_at')
      .eq('lead_id', leadId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: job.mechanic_status,
      timestamps: {
        started_at: job.started_at,
        paused_at: job.paused_at,
        completed_at: job.completed_at,
        updated_at: job.updated_at
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

