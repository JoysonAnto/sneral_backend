# Service Partner KYC Documentation v1.2

This document provides a detailed overview of the KYC (Know Your Customer) and Onboarding APIs for the Snearal Service Partner platform. 

> [!IMPORTANT]
> All endpoints require a valid Bearer Token in the `Authorization` header.
> `Authorization: Bearer <your_jwt_token>`

## 1. Submit KYC Documents
Submits identity and financial documents for manual verification.

**Endpoint:** `POST /api/v1/kyc/submit`  
**Content-Type:** `multipart/form-data`

### Request Payload (Form-Data)
The API supports both `camelCase` and `snake_case` field names for maximum compatibility.

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `aadhaar_front` | File | Yes | Image/PDF of Aadhaar Card (Front side) |
| `aadhaar_back` | File | Yes | Image/PDF of Aadhaar Card (Back side) |
| `pan_card` | File | Yes | Image/PDF of PAN Card |
| `bank_passbook` | File | Yes | Image/PDF of Bank Passbook or Cancelled Cheque |
| `photo` | File | No | Passport size photograph of the partner |

### Response Example (201 Created)
```json
{
  "success": true,
  "message": "KYC documents submitted successfully",
  "data": {
    "status": "PENDING_VERIFICATION",
    "documentsSubmitted": 4
  }
}
```

---

## 2. Check My KYC Status (Recommended)
Retrieves the KYC verification status for the currently authenticated user.

**Endpoint:** `GET /api/v1/kyc/me`

### Response Example (200 OK)
```json
{
  "success": true,
  "message": "Your KYC status retrieved successfully",
  "data": {
    "partnerId": "39268fb-...",
    "status": "PENDING_VERIFICATION",
    "remarks": "Documents are under review",
    "lastUpdated": "2026-05-09T11:37:00Z",
    "documents": [
      { "type": "aadhaarFront", "verified": false },
      { "type": "panCard", "verified": false }
    ]
  }
}
```

---

## 3. Check KYC Status (By ID)
Retrieves KYC status for a specific partner. Note: The system now accepts both **Partner ID** and **User ID** for this endpoint to prevent lookup failures.

**Endpoint:** `GET /api/v1/kyc/:partnerId`

### Response Example (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "APPROVED",
    "verifiedAt": "2026-05-08T10:00:00Z"
  }
}
```

---

## 4. Instant PAN Verification (Eko API)
Perform instant verification of PAN details using the integrated Eko API.

**Endpoint:** `POST /api/v1/kyc/eko/verify-pan`  
**Content-Type:** `application/json`

### Request Payload
```json
{
  "panNumber": "ABCDE1234F",
  "fullName": "John Doe"
}
```

### Response Example (200 OK)
```json
{
  "success": true,
  "message": "PAN details verified",
  "data": {
    "isValid": true,
    "fullNameMatch": true,
    "ekoResponse": { ... }
  }
}
```

---

## 5. Instant Bank Verification (Eko API)
Perform instant verification of Bank Account details using a penny-drop test.

**Endpoint:** `POST /api/v1/kyc/eko/verify-bank`  
**Content-Type:** `application/json`

### Request Payload
```json
{
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234"
}
```

### Response Example (200 OK)
```json
{
  "success": true,
  "message": "Bank account verified",
  "data": {
    "accountHolderName": "JOHN DOE",
    "status": "SUCCESS"
  }
}
```

---

## 📉 KYC Status Enums
| Status | Description |
| :--- | :--- |
| `PENDING` | Initial state, no documents uploaded yet |
| `PENDING_VERIFICATION` | Documents uploaded, waiting for admin approval |
| `APPROVED` | Verification successful, partner is now active |
| `REJECTED` | Verification failed (check `remarks` for reason) |
| `ACTION_REQUIRED` | Corrections needed (e.g., blurry image) |

---

> **Developer Note:**  
> If you encounter a `MulterError: Unexpected field`, ensure you are using the field names listed in section 1. The backend is configured to accept both `aadhaarFront` and `aadhaar_front`.
