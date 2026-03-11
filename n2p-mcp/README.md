# n2p-mcp — net2phone MCP Server

Model Context Protocol server that exposes all net2phone UCaaS APIs as agent-callable tools.

## Quick Start

```bash
cd n2p-mcp
npm install
npm run build
```

## Configuration

Set environment variables before running:

| Variable | Required | Description |
|---|---|---|
| `N2P_ACCESS_TOKEN` | ✅ | Bearer JWT from a logged-in session |
| `N2P_ACCOUNT_ID` | ✅ | Your net2phone account ID (e.g. `1017456`) |
| `N2P_SIP_CLIENT_ID` | SIP tools only | SIP trunk account ID (e.g. `85169`) |

### Getting your token
Open DevTools on app.net2phone.com → Network tab → any API call → copy the `Authorization: Bearer ...` header value.

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "net2phone": {
      "command": "node",
      "args": ["/path/to/n2p-mcp/dist/index.js"],
      "env": {
        "N2P_ACCESS_TOKEN": "your-token-here",
        "N2P_ACCOUNT_ID": "1017456",
        "N2P_SIP_CLIENT_ID": "85169"
      }
    }
  }
}
```

## Available Tools (62 total)

### Account
- `get_account` — Company details, address, timezone

### Team Members (7 tools)
- `list_team_members`, `get_team_member`, `create_team_member`, `update_team_member`, `delete_team_member`, `search_team_members`, `list_team_members_light`

### Departments (4 tools)
- `list_departments`, `create_department`, `update_department`, `delete_department`

### Ring Groups (8 tools)
- `list_ring_groups`, `get_ring_group`, `create_ring_group`, `update_ring_group`, `delete_ring_group`, `add_user_to_ring_group`, `set_ring_group_members`

### Call Queues (8 tools)
- `list_call_queues`, `get_call_queue`, `create_call_queue`, `update_call_queue`, `delete_call_queue`, `add_agent_to_call_queue`, `set_call_queue_agents`

### Call Queue Reports (2 tools)
- `get_agent_activity_report` — Time-series per-agent stats (POST to api.n2p.io)
- `get_queue_activity_report` — Queue-level aggregate stats (POST to api.n2p.io)

### Schedules (5 tools)
- `list_schedules`, `create_schedule`, `update_schedule`, `delete_schedule`, `list_timezones`

### Phone Numbers (2 tools)
- `list_phone_numbers`, `list_porting_requests`

### Devices (5 tools)
- `list_devices`, `list_device_orders`, `list_sip_registrations`, `list_device_templates`, `reboot_device`

### Virtual Assistant / Welcome Menus (4 tools)
- `list_virtual_assistants`, `get_virtual_assistant`, `create_virtual_assistant`, `delete_virtual_assistant`

### Special Extensions (4 tools)
- `list_special_extensions`, `create_special_extension`, `update_special_extension`, `delete_special_extension`

### Virtual Fax (3 tools)
- `list_virtual_faxes`, `create_virtual_fax`, `delete_virtual_fax`

### Call History (2 tools)
- `list_call_history`, `get_recording_url`

### Call Blocking (4 tools)
- `list_inbound_blocked`, `list_outbound_blocked`, `add_blocked_number`, `delete_blocked_number`

### SIP Trunking (9 tools)
- `list_sip_trunks`, `get_sip_trunk`, `get_sip_limits`, `list_sip_service_addresses`, `list_sip_phone_numbers`, `list_sip_endpoints`, `get_sip_notifications`, `list_sip_call_history`, `get_sip_registration_summary`

### Delegates (3 tools)
- `list_delegates`, `add_delegate`, `delete_delegate`

### Kari's Law / E911 (3 tools)
- `list_911_contacts`, `add_911_contact`, `delete_911_contact`

### 10DLC / Messaging (2 tools)
- `list_10dlc_brands`, `list_10dlc_campaigns`

### Webhooks (2 tools)
- `list_webhooks`, `list_webhook_event_types`

### Other
- `list_tie_lines`, `list_music_options`, `list_licenses`

### Analytics (3 tools)
- `get_account_analytics`, `get_user_analytics`, `get_department_analytics`

### Voicemail
- `list_voicemails`

### Bulk Operations
- `list_bulk_operations`

## API Base URLs

| Client | Base URL | Used for |
|---|---|---|
| V1 | `https://app.net2phone.com/api` | Most resources |
| V2 | `https://app.net2phone.com/api/v2` | Call queues CRUD, 10DLC |
| N2P | `https://api.n2p.io/v2` | SIP trunking, call queue reports |

Override with env vars: `N2P_API_V1_URL`, `N2P_API_V2_URL`, `N2P_API_N2P_URL`
