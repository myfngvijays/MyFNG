import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyQCDecision, notifyAccountsTeam } from '@/lib/notifications';
import { generateSeriesDocumentNumber } from '@/lib/utils/invoiceUtils';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, role_id, roles!inner(role_code)';

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

    // Verify user is supervisor
    const roleCode = (userProfile.roles as any)?.role_code;
    if (roleCode !== 'WORKSHOP_SUPERVISOR') {
      return NextResponse.json({ error: 'Forbidden: Supervisor only' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { notes, checklist_data, quality_score } = body;

    const leadId = params.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This job is closed and cannot be modified'
      }, { status: 400 });
    }

    // Verify lead is from this workshop
    if (lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ error: 'Job not in your workshop' }, { status: 403 });
    }

    // Verify lead is ready for QC (mechanic has completed work / rework resubmitted)
    // IMPORTANT: After QC rejection we set qc_status=FAILED and lead.status=REWORK_REQUIRED.
    // QC approval must only be allowed after mechanic re-completes (WORK_COMPLETED) OR mechanic_job is COMPLETED.
    const { data: mechanicJob } = await supabase
      .from('mechanic_jobs')
      .select('mechanic_status')
      .eq('lead_id', leadId)
      .maybeSingle();

    const readyByLeadStatus = ['WORK_COMPLETED', 'QC_PENDING'].includes(lead.status);
    const readyByMechanicStatus = mechanicJob?.mechanic_status === 'COMPLETED';
    // If qc_status is FAILED (rework), ignore stale mechanic_completed_at from prior completion.
    const readyByTimestamp = !!lead.mechanic_completed_at && lead.qc_status !== 'FAILED';

    const isReadyForQC = readyByLeadStatus || readyByMechanicStatus || readyByTimestamp;

    if (!isReadyForQC) {
      return NextResponse.json(
        {
          error: 'Job is not ready for QC approval',
          current_status: lead.status,
          qc_status: lead.qc_status,
          mechanic_completed_at: lead.mechanic_completed_at,
          mechanic_status: mechanicJob?.mechanic_status || null,
          ready_checks: {
            readyByLeadStatus,
            readyByMechanicStatus,
            readyByTimestamp,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update lead status to QC_APPROVED (QC passed)
    const { data: qcApprovedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        status: 'QC_APPROVED',
        qc_status: 'PASSED',
        qc_performed_by: userProfile.id,
        qc_performed_at: now,
        qc_notes: notes || 'Quality check approved',
        updated_at: now
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving QC:', updateError);
      return NextResponse.json({ 
        error: 'Failed to approve QC', 
        details: updateError.message,
        code: updateError.code,
        hint: updateError.hint
      }, { status: 500 });
    }

    // Create/Update QC check record
    await supabase
      .from('qc_checks')
      .upsert({
        lead_id: leadId,
        supervisor_id: userProfile.id,
        qc_status: 'PASSED',
        images_verified: true,
        parts_verified: true,
        mechanic_notes_approved: true,
        checklist_data: checklist_data || {},
        supervisor_notes: notes || 'Quality check passed',
        created_at: now,
        updated_at: now
      }, {
        onConflict: 'lead_id'
      });

    // Log status change in lead_status_history
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'QC_APPROVED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Quality check approved by supervisor',
        notes: notes || 'All checks passed'
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'QC_APPROVED',
        description: 'Supervisor approved quality check',
        old_status: lead.status,
        new_status: 'QC_APPROVED',
        metadata: {
          supervisor_id: userProfile.id,
          approved_at: now,
          notes: notes,
          quality_score: quality_score,
          checklist_data: checklist_data
        }
      });

    // Check if audit is required
    let nextStep = 'Job ready for billing/invoice generation';
    let finalLeadStatus: string = 'PAYMENT_AWAITING';
    if (lead.audit_required) {
      await supabase
        .from('service_leads')
        .update({
          status: 'AUDIT_PENDING',
          audit_status: 'PENDING',
          updated_at: now
        })
        .eq('id', leadId);

      finalLeadStatus = 'AUDIT_PENDING';
      nextStep = 'Job sent to auditor for final verification';
    } else {
      // NEW FLOW:
      // QC Approved triggers Order Summary (no GST) generation and moves status to PAYMENT_AWAITING.

      // 1) Ensure shared series suffix is allocated on the lead (OS/CI/TI share same suffix)
      let seriesYear = (lead as any).invoice_series_year as number | null;
      let seriesMonth = (lead as any).invoice_series_month as number | null;
      let seriesSeq = (lead as any).invoice_series_seq as number | null;

      if (!seriesYear || !seriesMonth || !seriesSeq) {
        const d = new Date();
        seriesYear = d.getFullYear();
        seriesMonth = d.getMonth() + 1;

        const { data: seqData, error: seqError } = await supabase.rpc('next_invoice_series_seq', {
          p_year: seriesYear,
          p_month: seriesMonth,
        });

        if (seqError) {
          return NextResponse.json(
            { error: 'Failed to allocate invoice series sequence', details: seqError.message },
            { status: 500 }
          );
        }

        seriesSeq = typeof seqData === 'number' ? seqData : parseInt(String(seqData || '0'), 10);

        await supabase
          .from('service_leads')
          .update({
            invoice_series_year: seriesYear,
            invoice_series_month: seriesMonth,
            invoice_series_seq: seriesSeq,
            updated_at: now,
          })
          .eq('id', leadId);
      }

      // 2) Create (or reuse) Order Summary invoice (no GST)
      const osNumber = generateSeriesDocumentNumber('OS', seriesYear!, seriesMonth!, seriesSeq!);

      const { data: existingOS } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('lead_id', leadId)
        .eq('invoice_type', 'ORDER_SUMMARY')
        .maybeSingle();

      let orderSummaryInvoiceId: string | null = existingOS?.id || null;

      if (!orderSummaryInvoiceId) {
        // Fetch pricing items + approved extra charges + job card parts (best-effort)
        const [{ data: pricingItems }, { data: extraChargesRaw }, { data: jobCard }] = await Promise.all([
          // lead_pricing_items schema uses item_name + qty; keep fallback handling below.
          supabase
            .from('lead_pricing_items')
            .select('id, item_name, base_price, final_price, qty, is_addon, status')
            .eq('lead_id', leadId)
            .eq('status', 'ACTIVE'),
          supabase
            .from('lead_extra_charges')
            .select('*')
            .eq('lead_id', leadId),
          supabase
            .from('job_cards')
            .select('id, jobcard_number, job_card_parts(part_name, part_number, quantity, unit_price, total_price)')
            .eq('lead_id', leadId)
            .maybeSingle(),
        ]);

        // Optional: load additional job master prices (workshop-specific first, then global) as a fallback
        const normalizeName = (s: string) =>
          String(s || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const masterByName = new Map<string, { oem: number; oes: number; labour: number }>();
        try {
          const { data: masterJobs } = await supabase
            .from('additional_jobs_master')
            .select('name, oem_price, oes_price, labour_price, workshop_id, is_active, deleted_at')
            .or(`workshop_id.eq.${lead.workshop_id},workshop_id.is.null`)
            .eq('is_active', true);

          for (const it of masterJobs || []) {
            if ((it as any)?.deleted_at) continue;
            const key = normalizeName(String((it as any).name || ''));
            if (!key) continue;
            const oem = Number((it as any).oem_price);
            const oes = Number((it as any).oes_price);
            const labour = Number((it as any).labour_price);
            const row = { oem: Number.isFinite(oem) ? oem : 0, oes: Number.isFinite(oes) ? oes : 0, labour: Number.isFinite(labour) ? labour : 0 };
            // Prefer workshop-specific entry over global
            if ((it as any).workshop_id === lead.workshop_id) {
              masterByName.set(key, row);
            } else if (!masterByName.has(key)) {
              masterByName.set(key, row);
            }
          }
        } catch {
          // ignore if table/columns missing
        }

        const isApprovedExtra = (row: any) => {
          const s = String(row?.status || '').trim().toUpperCase();
          const customerApproved = row?.customer_approved === true;
          return (
            customerApproved ||
            s === 'APPROVED' ||
            s === 'CUSTOMER_APPROVED' ||
            s === 'APPROVED_BY_CUSTOMER' ||
            s === 'ACCEPTED'
          );
        };

        const computeExtraAmount = (row: any) => {
          const legacy = Number(row?.amount ?? 0) || 0;
          if (legacy > 0) return legacy;
          const partType = String(row?.part_price_type || 'OEM').toUpperCase();
          const part = partType === 'OES' ? Number(row?.oes_price ?? 0) || 0 : Number(row?.oem_price ?? 0) || 0;
          const labour = Number(row?.labour_price ?? 0) || 0;
          const computed = part + labour;
          if (computed > 0) return computed;
          // Fallback: sometimes pricing is not saved to lead_extra_charges yet; use additional_jobs_master by description
          const descKey = normalizeName(String(row?.description || row?.reason || ''));
          const master = masterByName.get(descKey);
          if (master) {
            const masterPart = partType === 'OES' ? master.oes : master.oem;
            return (Number(masterPart) || 0) + (Number(master.labour) || 0);
          }
          return 0;
        };

        const extraCharges = (Array.isArray(extraChargesRaw) ? extraChargesRaw : []).filter(isApprovedExtra);

        const pricingTotal =
          (pricingItems || []).reduce((sum: number, it: any) => sum + parseFloat(it.final_price || '0'), 0) || 0;
        const extraTotal =
          (extraCharges || []).reduce((sum: number, it: any) => sum + computeExtraAmount(it), 0) || 0;
        const partsTotal =
          (jobCard?.job_card_parts || []).reduce((sum: number, p: any) => sum + parseFloat(p.total_price || '0'), 0) || 0;
        const discountAmount = parseFloat((lead as any).discount_amount || '0') || 0;

        const subTotal = Math.max(0, pricingTotal + extraTotal + partsTotal);
        const finalAmount = Math.max(0, subTotal - discountAmount);

        const lineItems: any[] = [];
        (pricingItems || []).forEach((it: any) => {
          const qtyRaw = it.quantity ?? it.qty ?? 1;
          const qty = qtyRaw ? parseFloat(String(qtyRaw)) : 1;
          const amt = parseFloat(it.final_price || '0') || 0;
          lineItems.push({
            description: it.name || it.item_name || 'Service',
            qty,
            rate: qty ? amt / qty : amt,
            amount: amt,
            category: it.is_addon ? 'ADDON' : 'SERVICE',
          });
        });
        (jobCard?.job_card_parts || []).forEach((p: any) => {
          lineItems.push({
            description: `${p.part_name || 'Part'}${p.part_number ? ` (${p.part_number})` : ''}`,
            qty: p.quantity || 1,
            rate: p.unit_price || 0,
            amount: p.total_price || 0,
            category: 'PART',
          });
        });
        (extraCharges || []).forEach((c: any) => {
          const amt = computeExtraAmount(c);
          lineItems.push({
            description: c.description || c.reason || 'Additional Request',
            qty: 1,
            rate: amt,
            amount: amt,
            category: 'EXTRA',
          });
        });

        const osInsert: any = {
          invoice_number: osNumber,
          lead_id: leadId,
          workshop_id: lead.workshop_id,
          base_amount: pricingTotal,
          parts_cost: partsTotal,
          extra_charges: extraTotal,
          labour_cost: 0,
          sub_total: subTotal,
          discount_amount: discountAmount,
          cgst_percentage: 0,
          cgst_amount: 0,
          sgst_percentage: 0,
          sgst_amount: 0,
          igst_percentage: 0,
          igst_amount: 0,
          total_tax: 0,
          final_amount: finalAmount,
          amount_in_words: null,
          status: 'GENERATED',
          payment_status: 'PENDING',
          generated_by: userProfile.id,
          invoice_type: 'ORDER_SUMMARY',
          series_year: seriesYear,
          series_month: seriesMonth,
          series_seq: seriesSeq,
          visible_to_customer: true,
          show_gst_breakup: false,
          line_items: lineItems,
        };

        const { data: createdOS, error: createOsErr } = await supabase
          .from('invoices')
          .insert(osInsert)
          .select('id')
          .single();

        if (createOsErr || !createdOS) {
          // Some installs still have UNIQUE(lead_id) on invoices (legacy schema).
          // In that case, upsert by updating the existing invoice to become ORDER_SUMMARY.
          const isDuplicateLeadInvoice =
            createOsErr?.code === '23505' ||
            /duplicate key/i.test(String(createOsErr?.message || '')) ||
            /invoices_lead_id_unique/i.test(String(createOsErr?.message || ''));

          if (isDuplicateLeadInvoice) {
            const { data: existingAnyInvoice } = await supabase
              .from('invoices')
              .select('id')
              .eq('lead_id', leadId)
              .maybeSingle();

            if (existingAnyInvoice?.id) {
              const { error: updateErr } = await supabase
                .from('invoices')
                .update({
                  ...osInsert,
                  updated_at: now,
                })
                .eq('id', existingAnyInvoice.id);

              if (!updateErr) {
                orderSummaryInvoiceId = existingAnyInvoice.id;
              } else {
                return NextResponse.json(
                  {
                    error: 'Failed to create order summary (existing invoice update failed)',
                    details: updateErr.message,
                    code: updateErr.code,
                    hint: updateErr.hint,
                  },
                  { status: 500 }
                );
              }
            } else {
              return NextResponse.json(
                {
                  error: 'Failed to create order summary (duplicate lead invoice)',
                  details: createOsErr?.message,
                  code: createOsErr?.code,
                  hint: createOsErr?.hint,
                },
                { status: 500 }
              );
            }
          } else {
            return NextResponse.json(
              {
                error: 'Failed to create order summary',
                details: createOsErr?.message,
                code: createOsErr?.code,
                hint: createOsErr?.hint,
              },
              { status: 500 }
            );
          }
        }
        if (createdOS?.id) {
          orderSummaryInvoiceId = createdOS.id;
        }
      }

      // 3) Lock billing edits + move lead to PAYMENT_AWAITING and point lead.invoice_id to OS for quick access
      await supabase
        .from('service_leads')
        .update({
          status: 'PAYMENT_AWAITING',
          billing_locked_at: now,
          invoice_id: orderSummaryInvoiceId,
          invoice_number: osNumber,
          invoice_generated_at: now,
          invoice_generated_by: userProfile.id,
          updated_at: now,
        })
        .eq('id', leadId);
      
      // Log status change
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: 'QC_APPROVED',
          new_status: 'PAYMENT_AWAITING',
          changed_by: userProfile.id,
          changed_at: now,
          reason: 'QC approved - order summary generated; awaiting payment/confirmation',
          notes: `Order Summary ${osNumber} generated. Billing locked.`,
        });
    }

    // Lead events (analytics/audit trail)
    await supabase.from('lead_events').insert([
      {
        lead_id: leadId,
        event_type: 'QC_APPROVED',
        event_description: 'Supervisor approved QC',
        event_data: { quality_score, checklist_data, notes },
        created_by: userProfile.id,
        created_at: now,
      },
      {
        lead_id: leadId,
        event_type: finalLeadStatus,
        event_description: finalLeadStatus === 'AUDIT_PENDING'
          ? 'Lead sent for audit after QC approval'
          : 'Lead ready for billing after QC approval',
        created_by: userProfile.id,
        created_at: now,
      },
    ]);

    // TODO: Send notification to workshop admin
    // TODO: Send notification to billing team
    // TODO: Send notification to auditor (if audit required)
    try {
      // Notify mechanic about QC decision
      if (lead.assigned_mechanic_id) {
        await notifyQCDecision(
          leadId,
          lead.lead_number || leadId,
          lead.assigned_mechanic_id,
          true,
          userProfile.full_name || 'Supervisor',
          notes
        );
      }

      // Notify accounts team when order summary is ready (no audit)
      if (finalLeadStatus === 'PAYMENT_AWAITING') {
        await notifyAccountsTeam(
          lead.workshop_id,
          leadId,
          lead.lead_number || leadId,
          'Order Summary Ready',
          `QC approved for lead ${lead.lead_number || leadId}. Order Summary generated; proceed with billing finalization.`,
          `/dashboard/billing/leads/${leadId}`,
          'HIGH'
        );
      }
    } catch (e) {
      console.warn('Notification dispatch failed (non-blocking):', e);
    }

    // Fetch final lead snapshot (after workflow transition)
    const { data: finalLead } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Quality check approved successfully',
      lead: finalLead || qcApprovedLead,
      next_step: nextStep,
      quality_score: quality_score
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error in approve QC API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

