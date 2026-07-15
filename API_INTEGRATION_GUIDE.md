# EduSmart CRM — External API Integration Guide

## Overview

This document describes how to connect your **website / application form** to the **EduSmart CRM** system so that form submissions are automatically created as inquiries/leads in the CRM.

## Endpoint

```
POST https://edusmart-backend-production-f1c2.up.railway.app/api/public/inquiry
```

## Authentication

Include the API key in the request header:

```
x-api-key: your-api-key-here
```

> **Note:** The API key is configured on the server. You will receive it from the EduSmart administrator.

## Request Format

Content-Type: `application/json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `fullName` | string | Applicant's full name |
| `phone` | string | Phone number (digits only, e.g. `0712345678`) |
| `email` | string | Email address |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `programOfInterest` | string | Course/program applying for |
| `intakePeriod` | string | e.g. "January", "May", "September" |
| `studyMode` | string | "Full Time", "Part Time", "Online" |
| `source` | string | Default: "Website" |
| `kcseGrade` | string | KCSE grade (A, A-, B+, B, etc.) |
| `gender` | string | "Male", "Female" |
| `county` | string | Home county |
| `town` | string | Home town |
| `message` | string | Additional notes or message from applicant |

### Example Request

```json
{
  "fullName": "John Kamau",
  "phone": "0712345678",
  "email": "john@example.com",
  "programOfInterest": "Diploma in Information Technology",
  "intakePeriod": "September",
  "studyMode": "Full Time",
  "kcseGrade": "B+",
  "gender": "Male",
  "county": "Nairobi",
  "town": "CBD",
  "message": "I would like to know more about the fee structure"
}
```

### Example using fetch (JavaScript)

```javascript
const response = await fetch('https://edusmart-backend-production-f1c2.up.railway.app/api/public/inquiry', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key-here'
  },
  body: JSON.stringify({
    fullName: 'John Kamau',
    phone: '0712345678',
    email: 'john@example.com',
    programOfInterest: 'Diploma in Information Technology',
    intakePeriod: 'September',
    studyMode: 'Full Time',
    source: 'Website'
  })
});

const data = await response.json();
console.log(data);
// { success: true, inquiry: { id: 123, fullName: "John Kamau", ... } }
```

### Example using PHP (cURL)

```php
$ch = curl_init('https://edusmart-backend-production-f1c2.up.railway.app/api/public/inquiry');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'x-api-key: your-api-key-here'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  'fullName' => 'John Kamau',
  'phone' => '0712345678',
  'email' => 'john@example.com',
  'programOfInterest' => 'Diploma in Information Technology',
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
$data = json_decode($response, true);
```

## Response

### Success (201 Created)

```json
{
  "success": true,
  "inquiry": {
    "id": 123,
    "fullName": "John Kamau",
    "phone": "0712345678",
    "email": "john@example.com",
    "status": "new",
    "score": 70,
    "createdAt": "2026-07-12T19:00:00.000Z"
  }
}
```

### Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Full name is required"
}
```

## What Happens After Submission

1. Inquiry is created in EduSmart CRM
2. Lead score is calculated automatically
3. Staff are notified of the new inquiry
4. A QA quality check is created if fields are missing
5. The inquiry appears instantly in the CRM dashboard

## Testing

You can test the endpoint using:

```bash
curl -X POST https://edusmart-backend-production-f1c2.up.railway.app/api/public/inquiry \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key-123" \
  -d '{"fullName":"Test User","phone":"0711111111","email":"test@example.com"}'
```

## Notes

- The system will **automatically assign** the inquiry to available staff using round-robin rotation
- Duplicate phone numbers will be flagged but not blocked
- All submissions are logged and timestamped
- Rate limit: 100 requests per minute per API key
