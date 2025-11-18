# 🔌 MyFNG REST API v1 Documentation
## Third-party Integration API

**Version:** 1.0.0  
**Base URL:** `https://api.myfng.com/v1`  
**Authentication:** API Key (Bearer Token)

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Leads API](#leads-api)
3. [Workshops API](#workshops-api)
4. [Webhooks](#webhooks)
5. [Rate Limiting](#rate-limiting)
6. [Error Codes](#error-codes)
7. [Code Examples](#code-examples)

---

## 🔐 Authentication

All API requests require an API key passed in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### Generate API Key

```http
POST /api/v1/auth/generate-key
Content-Type: application/json

{
  "workshop_id": "uuid",
  "name": "My Integration",
  "permissions": ["leads:read", "leads:write"]
}
```

**Response:**
```json
{
  "api_key": "myfng_live_abc123...",
  "created_at": "2025-11-17T10:00:00Z",
  "expires_at": "2026-11-17T10:00:00Z"
}
```

---

## 📊 Leads API

### List Leads

```http
GET /api/v1/leads
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (NEW, ACCEPTED, etc.) |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| from_date | string | ISO 8601 date string |
| to_date | string | ISO 8601 date string |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "lead_number": "LN000123",
      "customer_name": "John Doe",
      "customer_phone": "+919876543210",
      "vehicle_number": "MH12AB1234",
      "vehicle_make": "Maruti",
      "vehicle_model": "Swift",
      "service_type": "General Service",
      "status": "ACCEPTED",
      "created_at": "2025-11-17T10:00:00Z",
      "workshop_id": "uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### Get Lead by ID

```http
GET /api/v1/leads/:id
```

**Response:**
```json
{
  "id": "uuid",
  "lead_number": "LN000123",
  "customer_name": "John Doe",
  "customer_phone": "+919876543210",
  "customer_email": "john@example.com",
  "vehicle_number": "MH12AB1234",
  "vehicle_make": "Maruti",
  "vehicle_model": "Swift",
  "service_type": "General Service",
  "problem_description": "Engine making noise",
  "status": "ACCEPTED",
  "priority": "MEDIUM",
  "pickup_required": false,
  "estimated_cost": 5000,
  "final_amount": null,
  "assigned_mechanic_id": "uuid",
  "created_at": "2025-11-17T10:00:00Z",
  "updated_at": "2025-11-17T11:00:00Z",
  "workshop": {
    "id": "uuid",
    "name": "ABC Workshop",
    "address": "123 Main St"
  }
}
```

### Create Lead

```http
POST /api/v1/leads
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_phone": "+919876543210",
  "customer_email": "john@example.com",
  "vehicle_number": "MH12AB1234",
  "vehicle_make": "Maruti",
  "vehicle_model": "Swift",
  "vehicle_year": 2020,
  "service_type": "General Service",
  "problem_description": "Engine making noise",
  "pickup_required": false
}
```

**Response:** (201 Created)
```json
{
  "id": "uuid",
  "lead_number": "LN000124",
  "status": "NEW",
  "created_at": "2025-11-17T12:00:00Z"
}
```

### Update Lead Status

```http
PATCH /api/v1/leads/:id/status
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "notes": "Work started"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "updated_at": "2025-11-17T13:00:00Z"
}
```

---

## 🏢 Workshops API

### Get Workshop Details

```http
GET /api/v1/workshops/:id
```

**Response:**
```json
{
  "id": "uuid",
  "name": "ABC Workshop",
  "address": "123 Main St, Mumbai",
  "phone": "+919876543210",
  "email": "abc@workshop.com",
  "is_active": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Get Workshop Statistics

```http
GET /api/v1/workshops/:id/stats
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | 7d, 30d, 90d (default: 30d) |

**Response:**
```json
{
  "period": "30d",
  "total_leads": 150,
  "accepted_leads": 120,
  "completed_leads": 100,
  "rejected_leads": 10,
  "pending_leads": 20,
  "revenue": 500000,
  "avg_acceptance_time_minutes": 15,
  "avg_completion_time_hours": 48,
  "sla_compliance_rate": 85
}
```

---

## 🔔 Webhooks

### Register Webhook

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-domain.com/webhook",
  "events": ["lead.created", "lead.accepted", "lead.completed"],
  "secret": "your_webhook_secret"
}
```

**Response:**
```json
{
  "id": "uuid",
  "url": "https://your-domain.com/webhook",
  "events": ["lead.created", "lead.accepted", "lead.completed"],
  "is_active": true,
  "created_at": "2025-11-17T10:00:00Z"
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `lead.created` | New lead created |
| `lead.accepted` | Lead accepted by workshop |
| `lead.rejected` | Lead rejected |
| `lead.status_changed` | Status updated |
| `mechanic.assigned` | Mechanic assigned to lead |
| `invoice.generated` | Invoice created |
| `payment.received` | Payment successful |

### Webhook Payload Example

```json
{
  "event": "lead.created",
  "timestamp": "2025-11-17T10:00:00Z",
  "data": {
    "lead_id": "uuid",
    "lead_number": "LN000125",
    "customer_name": "John Doe",
    "vehicle_number": "MH12AB1234",
    "service_type": "General Service",
    "status": "NEW"
  },
  "signature": "sha256_hash_of_payload"
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}
```

---

## ⚡ Rate Limiting

| Tier | Requests per minute | Requests per day |
|------|---------------------|------------------|
| Free | 60 | 1,000 |
| Basic | 300 | 10,000 |
| Pro | 1,000 | 100,000 |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1637155200
```

---

## ⚠️ Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

**Error Response:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid lead ID provided",
    "details": {
      "field": "id",
      "reason": "Must be a valid UUID"
    }
  }
}
```

---

## 💻 Code Examples

### Node.js

```javascript
const axios = require('axios');

const API_KEY = 'myfng_live_abc123...';
const BASE_URL = 'https://api.myfng.com/v1';

async function getLeads() {
  try {
    const response = await axios.get(`${BASE_URL}/leads`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      params: {
        status: 'NEW',
        limit: 20
      }
    });
    
    console.log('Leads:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

getLeads();
```

### Python

```python
import requests

API_KEY = 'myfng_live_abc123...'
BASE_URL = 'https://api.myfng.com/v1'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Get leads
response = requests.get(
    f'{BASE_URL}/leads',
    headers=headers,
    params={'status': 'NEW', 'limit': 20}
)

if response.status_code == 200:
    leads = response.json()
    print('Leads:', leads)
else:
    print('Error:', response.json())
```

### cURL

```bash
# Get leads
curl -X GET 'https://api.myfng.com/v1/leads?status=NEW&limit=20' \
  -H 'Authorization: Bearer myfng_live_abc123...' \
  -H 'Content-Type: application/json'

# Create lead
curl -X POST 'https://api.myfng.com/v1/leads' \
  -H 'Authorization: Bearer myfng_live_abc123...' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "John Doe",
    "customer_phone": "+919876543210",
    "vehicle_number": "MH12AB1234",
    "vehicle_make": "Maruti",
    "vehicle_model": "Swift",
    "service_type": "General Service"
  }'
```

---

## 📚 Postman Collection

Download our official Postman collection:  
👉 [MyFNG API v1 Postman Collection](https://api.myfng.com/docs/postman.json)

---

## 🆘 Support

For API support:
- **Email:** api-support@myfng.com
- **Documentation:** https://docs.myfng.com
- **Status Page:** https://status.myfng.com

---

**Last Updated:** November 17, 2025  
**API Version:** 1.0.0  
**Status:** Production Ready

