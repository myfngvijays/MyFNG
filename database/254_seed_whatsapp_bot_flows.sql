-- Seed preset WhatsApp bot flows (Router v1 + Welcome Menu v1)
-- Run after 202_bot_flow_builder.sql and 251_whatsapp_ai_brain.sql

DO $$
DECLARE
  v_router_flow_id UUID := 'a0000000-0000-4000-8000-000000000001';
  v_router_version_id UUID := 'a0000000-0000-4000-8000-000000000011';
  v_welcome_flow_id UUID := 'a0000000-0000-4000-8000-000000000002';
  v_welcome_version_id UUID := 'a0000000-0000-4000-8000-000000000012';
  v_now TIMESTAMPTZ := NOW();
  v_router_graph JSONB := '{
    "nodes": [
      {"id":"trigger_1","type":"trigger","position":{"x":80,"y":80},"data":{"label":"Inbound WhatsApp"}},
      {"id":"condition_router","type":"condition","position":{"x":80,"y":220},"data":{"label":"Route by intent / keywords"}},
      {"id":"handoff_human","type":"handoff","position":{"x":360,"y":160},"data":{"label":"Human / RSA Handoff","handoffNote":"Customer requested RSA, human agent, or live support on WhatsApp"}},
      {"id":"end_passthrough","type":"end","position":{"x":360,"y":320},"data":{"label":"Pass to MISA AI","messageBody":""}}
    ],
    "edges": [
      {"id":"edge_trigger_condition","source":"trigger_1","target":"condition_router"},
      {"id":"edge_rsa_handoff","source":"condition_router","target":"handoff_human","label":"RSA"},
      {"id":"edge_agent_handoff","source":"condition_router","target":"handoff_human","label":"contains:agent"},
      {"id":"edge_human_handoff","source":"condition_router","target":"handoff_human","label":"contains:human"},
      {"id":"edge_default_ai","source":"condition_router","target":"end_passthrough","label":"default"}
    ],
    "viewport":{"x":0,"y":0,"zoom":1}
  }'::jsonb;
  v_welcome_graph JSONB := '{
    "nodes": [
      {"id":"trigger_1","type":"trigger","position":{"x":80,"y":60},"data":{"label":"Inbound WhatsApp"}},
      {"id":"message_welcome","type":"message","position":{"x":80,"y":180},"data":{"label":"Welcome","messageBody":"Hi! Main MISA hoon — MyFNG Instant Service Assistant.\n\nAapko kya chahiye?\n• Service pricing\n• Workshop location\n• Booking\n• RSA / roadside help\n\nCar model + pincode bhejiye, ya seedha apna sawal likhiye."}},
      {"id":"condition_menu","type":"condition","position":{"x":80,"y":340},"data":{"label":"Menu router"}},
      {"id":"message_pricing","type":"message","position":{"x":320,"y":280},"data":{"label":"Pricing hint","messageBody":"Pricing ke liye car model aur 6-digit pincode bhejiye.\nExample: Swift periodic service 400601"}},
      {"id":"message_booking","type":"message","position":{"x":320,"y":360},"data":{"label":"Booking hint","messageBody":"Booking ke liye yeh details bhejiye:\n1. Car model\n2. Pincode\n3. Service type\n4. Preferred date"}},
      {"id":"message_workshop","type":"message","position":{"x":320,"y":440},"data":{"label":"Workshop hint","messageBody":"Nearby workshop ke liye apna 6-digit pincode bhejiye.\nExample: workshop near 400601"}},
      {"id":"handoff_rsa","type":"handoff","position":{"x":320,"y":520},"data":{"label":"RSA Handoff","handoffNote":"RSA / roadside assistance request from WhatsApp menu flow"}},
      {"id":"end_done","type":"end","position":{"x":560,"y":380},"data":{"label":"Done","messageBody":""}}
    ],
    "edges": [
      {"id":"edge_trigger_welcome","source":"trigger_1","target":"message_welcome"},
      {"id":"edge_welcome_condition","source":"message_welcome","target":"condition_menu"},
      {"id":"edge_pricing","source":"condition_menu","target":"message_pricing","label":"PRICING"},
      {"id":"edge_booking","source":"condition_menu","target":"message_booking","label":"BOOKING"},
      {"id":"edge_workshop","source":"condition_menu","target":"message_workshop","label":"WORKSHOP"},
      {"id":"edge_rsa","source":"condition_menu","target":"handoff_rsa","label":"RSA"},
      {"id":"edge_default","source":"condition_menu","target":"end_done","label":"default"},
      {"id":"edge_pricing_end","source":"message_pricing","target":"end_done"},
      {"id":"edge_booking_end","source":"message_booking","target":"end_done"},
      {"id":"edge_workshop_end","source":"message_workshop","target":"end_done"}
    ],
    "viewport":{"x":0,"y":0,"zoom":1}
  }'::jsonb;
BEGIN
  INSERT INTO public.bot_flows (id, name, channel, status, active_version_id, created_at, updated_at)
  VALUES (v_router_flow_id, 'WhatsApp Router v1', 'WHATSAPP', 'PUBLISHED', v_router_version_id, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = 'PUBLISHED',
    active_version_id = v_router_version_id,
    updated_at = v_now;

  INSERT INTO public.bot_flow_versions (
    id, bot_flow_id, version_no, status, graph_json, validation_summary, published_at, created_at, updated_at
  )
  VALUES (
    v_router_version_id,
    v_router_flow_id,
    1,
    'PUBLISHED',
    v_router_graph,
    '{"errors":[],"warnings":[]}'::jsonb,
    v_now,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    graph_json = EXCLUDED.graph_json,
    status = 'PUBLISHED',
    published_at = v_now,
    updated_at = v_now;

  INSERT INTO public.bot_flows (id, name, channel, status, created_at, updated_at)
  VALUES (v_welcome_flow_id, 'WhatsApp Welcome Menu v1', 'WHATSAPP', 'DRAFT', v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = v_now;

  INSERT INTO public.bot_flow_versions (
    id, bot_flow_id, version_no, status, graph_json, validation_summary, created_at, updated_at
  )
  VALUES (
    v_welcome_version_id,
    v_welcome_flow_id,
    1,
    'DRAFT',
    v_welcome_graph,
    '{"errors":[],"warnings":[]}'::jsonb,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    graph_json = EXCLUDED.graph_json,
    updated_at = v_now;

  UPDATE public.system_settings
  SET setting_value = (
    (COALESCE(NULLIF(setting_value, ''), '{}')::jsonb)
      || jsonb_build_object('active_flow_id', v_router_flow_id::text, 'mode', 'HYBRID')
  )::text,
  updated_at = v_now
  WHERE setting_key = 'whatsapp_ai_brain_config';

  IF NOT FOUND THEN
    INSERT INTO public.system_settings (setting_key, setting_value, setting_type, category, description, default_value, is_editable, updated_at)
    VALUES (
      'whatsapp_ai_brain_config',
      jsonb_build_object(
        'enabled', false,
        'mode', 'HYBRID',
        'model', 'gpt-4o',
        'active_flow_id', v_router_flow_id::text,
        'system_prompt_addon', 'MISA = MyFNG Instant Service Assistant. Keep replies short. No long intros.',
        'fallback_message', 'Thanks for reaching out to MyFNG! Our team will get back to you shortly. For urgent help, call 9152307030.',
        'skip_assigned_chats', true,
        'tools', jsonb_build_object('pricing', true, 'workshops', true, 'service_details', true, 'booking', true)
      )::text,
      'JSON',
      'whatsapp',
      'WhatsApp AI Brain configuration for inbound auto-replies',
      '{}',
      true,
      v_now
    )
    ON CONFLICT (setting_key) DO NOTHING;
  END IF;
END $$;
