# MyFNG MCP (read-only) — standalone package

Read-only Model Context Protocol server for MyFNG Supabase data.

**This is a package only.** It is **not** auto-connected to Cursor. Use it from any MCP host only when you choose to. Status + tool catalog also live in Super Admin → **MyFNG MCP**.

## Tools (29)

| Area | Tools |
|------|--------|
| CRM | `search_leads`, `get_lead`, `get_lead_timeline`, `list_lead_statuses`, `list_duplicates`, `get_pipeline_summary` |
| Calls | `search_call_logs`, `get_call`, `get_recordings`, `get_call_intelligence`, `get_dial_sessions`, `get_telecaller_activity` |
| Reports | `get_leaderboard`, `get_call_activity`, `get_team_performance`, `compare_periods` |
| People | `list_telecallers`, `get_telecaller`, `get_assignments`, `get_shift_summary` |
| Bookings | `search_bookings`, `get_booking`, `list_workshops`, `get_job_status` |
| System | `get_system_monitor`, `check_env_status`, `list_recent_errors` |
| Safety | `describe_schema`, `run_readonly_query` |

## Build

```bash
cd packages/myfng-mcp
npm install
npm run build
```

Env comes from `apps/web/.env.local` when using `scripts/run-with-env.mjs` (preferred), or set:

- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `MYFNG_MCP_MASK_PII=true`, `MYFNG_MCP_MAX_ROWS=50`

## Claude.ai (the link)

Claude does **not** use a Mac file path. It needs the public HTTPS connector:

`https://myfng.in/api/mcp`

1. Super Admin → **MyFNG MCP** → **Generate token**
2. Open [Claude Connectors](https://claude.ai/settings/connectors) → Add custom connector → **Web**
3. Paste the URL above
4. Auth: **None**. Request header `authorization` = `Bearer <token>`

`localhost` and `node /Users/.../run-with-env.mjs` will not work in Claude.ai (Anthropic’s servers call the URL).

## Optional local stdio (Cursor on this Mac only)


Example config (absolute path on your machine):

```json
{
  "mcpServers": {
    "myfng": {
      "command": "node",
      "args": ["/ABS/PATH/MyFNG/packages/myfng-mcp/scripts/run-with-env.mjs"]
    }
  }
}
```

Do **not** commit secrets. Prefer the runner script so keys stay in `.env.local`.

## Admin panel

Super Admin → System & Governance → **MyFNG MCP**  
`/dashboard/super_admin/myfng-mcp`

Shows package status, tool list, and a copyable config snippet.
