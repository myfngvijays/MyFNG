# Dialer Leads API - Integration Guide

## Endpoint

```
POST https://your-domain.com/api/public/dialer/leads
```

- **Content-Type:** `multipart/form-data`
- **Authentication:** Not required (public endpoint)

---

## Request Fields

| Field       | Type | Required | Description                                      |
| ----------- | ---- | -------- | ------------------------------------------------ |
| phone_no    | text | Yes      | Customer ka phone number                         |
| name        | text | No       | Customer ka naam                                 |
| address     | text | No       | Customer ka address                              |
| regdate     | text | No       | Registration date                                |
| car_number  | text | No       | Vehicle number (e.g. DL01AB1234)                 |
| make        | text | No       | Car brand (Maruti, Hyundai, Tata etc.)           |
| model       | text | No       | Car model (Swift, i20, Nexon etc.)               |
| disposition | text | No       | Call disposition                                 |
| remark      | text | No       | Telecaller remark / notes                        |
| dialer_id   | text | No       | Dialer system ID                                 |
| recording   | file | No       | Call recording file (mp3, wav, ogg, aac, webm)   |

> **Note:** Only `phone_no` is mandatory. Send whichever fields are available, skip the rest.

---

## Example Request (cURL)

```bash
curl -X POST https://your-domain.com/api/public/dialer/leads \
  -F "phone_no=9876543210" \
  -F "name=Rahul Sharma" \
  -F "address=Sector 15, Noida" \
  -F "regdate=2026-03-31" \
  -F "car_number=DL01AB1234" \
  -F "make=Maruti" \
  -F "model=Swift" \
  -F "disposition=Interested" \
  -F "remark=Kal follow up karna hai" \
  -F "dialer_id=D001" \
  -F "recording=@/path/to/call_recording.mp3"
```

### Minimum Request (only required field)

```bash
curl -X POST https://your-domain.com/api/public/dialer/leads \
  -F "phone_no=9876543210"
```

---

## Responses

### Success (200)

```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Validation Error (400)

```json
{
  "error": "phone_no is required"
}
```

```json
{
  "error": "Content-Type must be multipart/form-data"
}
```

### Server Error (500)

```json
{
  "error": "Internal server error",
  "details": "..."
}
```

---

## Recording File

- Supported formats: MP3, WAV, OGG, WebM, AAC, AMR, M4A
- Max file size: 50 MB
- The file will be uploaded to cloud storage and a public URL will be saved
- Field name in form-data must be `recording`

---

## Integration Notes

1. Hit this API every time a telecaller saves a disposition on the dialer
2. The API accepts `multipart/form-data` — do NOT send JSON
3. No API key or token is needed
4. Each successful call creates a new record and returns its unique `id`
