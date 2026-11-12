export const TELECRM_API_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';

export const TELECRM_API_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

export const DEFAULT_API_HEADERS = [{ key: 'Content-Type', value: 'application/json' }];

export const DEFAULT_TELECRM_FLOW_BODY = `{
  "fields": {
    "Name": "{{name}}",
    "phone": "{{phone}}",
    "LEADTAG": "WHATSAPP-0808",
    "REMARK": "{{button}}"
  },
  "actions": [
    {
      "type": "SYSTEM_NOTE",
      "text": "Lead Source: Whatsapp_Leads"
    }
  ]
}`;
