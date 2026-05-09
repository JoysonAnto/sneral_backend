# Snearal — Service Partner App API Reference

> **Base URL:** `http://<your-domain>/api/v1`  
> **Auth:** All protected endpoints require `Authorization: Bearer <access_token>` header.  
> **Test credentials:** `ramesh.electrician@service.com` / `password123`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Partner Profile & Availability](#2-partner-profile--availability)
3. [Jobs / Bookings](#3-jobs--bookings)
4. [Job Lifecycle Actions](#4-job-lifecycle-actions)
5. [OTP Flow (Start & Complete)](#5-otp-flow-start--complete)
6. [Before/After Photos & Materials](#6-beforeafter-photos--materials)
7. [KYC — Document Upload](#7-kyc--document-upload)
8. [KYC — Cashfree (Auto-Verify)](#8-kyc--cashfree-auto-verify)
9. [Wallet & Earnings](#9-wallet--earnings)
10. [Payouts](#10-payouts)
11. [Reviews](#11-reviews)
12. [Messages / Chat](#12-messages--chat)
13. [Location Tracking](#13-location-tracking)
14. [Notifications & Push](#14-notifications--push)
15. [Services Catalog](#15-services-catalog)
16. [Socket.IO Events](#16-socketio-events)

---

## 1. Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | ❌ | Register a new account |
| `POST` | `/auth/login` | ❌ | Login → returns `accessToken` + `refreshToken` |
| `POST` | `/auth/verify-otp` | ❌ | Verify phone/email OTP after registration |
| `POST` | `/auth/resend-otp` | ❌ | Resend verification OTP |
| `POST` | `/auth/forgot-password` | ❌ | Send password reset email/OTP |
| `POST` | `/auth/reset-password` | ❌ | Reset password with token/OTP |
| `POST` | `/auth/refresh-token` | ❌ | Exchange refresh token for new access token |
| `GET`  | `/auth/me` | ✅ | Get own profile |
| `PATCH`| `/auth/profile` | ✅ | Update name, phone, etc. |
| `POST` | `/auth/change-password` | ✅ | Change password (requires current password) |
| `POST` | `/auth/logout` | ✅ | Logout + invalidate tokens |

### Login Request/Response
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "ramesh.electrician@service.com",
  "password": "password123"
}
```
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "...",
      "role": "SERVICE_PARTNER"
    }
  }
}
```

---

## 2. Partner Profile & Availability

> **Prefix:** `/api/v1/partner`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/partner/availability` | ✅ SP | Toggle ONLINE / OFFLINE |
| `PATCH` | `/partner/me/availability` | ✅ SP | Alias for above |
| `GET`   | `/partner/stats` | ✅ SP | Dashboard summary (today's earnings, rating, active job) |
| `GET`   | `/partner/services` | ✅ SP | List services I offer |
| `POST`  | `/partner/services/sync` | ✅ SP | Replace my service list |

### Set Availability
```http
PATCH /api/v1/partner/availability
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "ONLINE" }   // or "OFFLINE"
```

### Sync Services
```http
POST /api/v1/partner/services/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "serviceIds": ["uuid-1", "uuid-2"]
}
```

---

## 3. Jobs / Bookings

> **Prefix:** `/api/v1/bookings`  (also aliased as `/api/v1/jobs`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/bookings` | ✅ SP | List my assigned bookings (filter by status via `?status=`) |
| `GET` | `/bookings/:id` | ✅ SP | Get full details of one booking |
| `GET` | `/jobs` | ✅ SP | Alias for `/bookings` |
| `GET` | `/jobs/:id` | ✅ SP | Alias for `/bookings/:id` |

### Query Parameters for `GET /bookings`

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `status` | string | `PARTNER_ASSIGNED` | Filter by booking status |
| `page` | int | `1` | Pagination page |
| `limit` | int | `10` | Items per page |

### Booking Statuses
```
PENDING → SEARCHING_PARTNER → PARTNER_ASSIGNED → PARTNER_EN_ROUTE
→ PARTNER_ARRIVED → IN_PROGRESS → COMPLETED
                                → CANCELLED
```

### Sample Booking Object
```json
{
  "id": "uuid",
  "booking_number": "BK1234567890",
  "status": "PARTNER_ASSIGNED",
  "scheduled_date": "2026-05-10T10:00:00Z",
  "scheduled_time": "10:00 AM",
  "service_address": "55 Worker Colony, Marathahalli",
  "service_latitude": 12.9141,
  "service_longitude": 77.6411,
  "total_amount": 279,
  "advance_amount": 84,
  "remaining_amount": 195,
  "payment_method": "CASH",
  "customer": {
    "id": "uuid",
    "full_name": "Rajesh Kumar",
    "phone_number": "+919876543210"
  },
  "items": [
    {
      "service": { "name": "Fan Installation & Repair" },
      "quantity": 1,
      "unit_price": 279
    }
  ]
}
```

---

## 4. Job Lifecycle Actions

> **Prefix:** `/api/v1/bookings/:id`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/bookings/:id/accept` | ✅ SP | Accept an assigned booking |
| `POST` | `/bookings/:id/reject` | ✅ SP | Reject a booking (with reason) |
| `POST` | `/bookings/:id/arrive` | ✅ SP | Mark arrived at customer location |
| `POST` | `/bookings/:id/start` | ✅ SP | Start the job (requires Start OTP or auto) |
| `POST` | `/bookings/:id/complete` | ✅ SP | Request job completion (triggers Completion OTP) |
| `POST` | `/bookings/:id/cancel` | ✅ SP | Cancel with reason |
| `PATCH`| `/bookings/:id/status` | ✅ SP | Manually update status |

> Also available under `/jobs/:id/...` (same endpoints, aliased)

### Accept a Booking
```http
POST /api/v1/bookings/{bookingId}/accept
Authorization: Bearer <token>
```

### Reject a Booking
```http
POST /api/v1/bookings/{bookingId}/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Not available in that area today"
}
```

### Cancel a Booking
```http
POST /api/v1/bookings/{bookingId}/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer unreachable"
}
```

### Update Status Manually
```http
PATCH /api/v1/bookings/{bookingId}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "PARTNER_EN_ROUTE"
}
```

---

## 5. OTP Flow (Start & Complete)

### Start OTP (Optional Workflow)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/bookings/:id/generate-start-otp` | ✅ SP | Generate Start OTP |

### Completion OTP (6-digit — Required to Release Payment)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/bookings/:id/generate-otp` | ✅ SP | Request 6-digit completion OTP (sent to customer) |
| `POST` | `/bookings/:id/verify-otp` | ✅ SP | Submit OTP customer shared → releases payment |

```http
POST /api/v1/bookings/{bookingId}/verify-otp
Authorization: Bearer <token>
Content-Type: application/json

{
  "otp": "847291"
}
```

> On success: booking status → `COMPLETED`, earnings credited to partner wallet.

---

## 6. Before/After Photos & Materials

### Photo Upload (`multipart/form-data`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/bookings/:id/before-photos` | ✅ SP | Upload evidence photos before work starts |
| `POST` | `/bookings/:id/after-photos` | ✅ SP | Upload evidence photos of completed work |

```http
POST /api/v1/bookings/{bookingId}/before-photos
Authorization: Bearer <token>
Content-Type: multipart/form-data

[field: photos] → one or more image files (jpg, png, webp)
```

### Add Material Cost

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/bookings/:id/add-materials` | ✅ SP | Record extra material cost (not commission-deducted) |

```http
PATCH /api/v1/bookings/{bookingId}/add-materials
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 350,
  "billImageUrl": "https://res.cloudinary.com/..."
}
```

> ⚠️ Platform commission is **NOT** deducted from material costs — only from service amount.

---

## 7. KYC — Document Upload (Manual)

> **Prefix:** `/api/v1/kyc`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/kyc/submit` | ✅ SP | Upload Aadhaar front+back, PAN card, Bank passbook |
| `GET`  | `/kyc/:partnerId` | ✅ | Get current KYC status |
| `POST` | `/kyc/eko/verify-pan` | ✅ SP | Instant PAN verification via Eko API |
| `POST` | `/kyc/eko/verify-bank` | ✅ SP | Instant Bank Account verification via Eko API |

### Submit KYC Documents (`multipart/form-data`)
```http
POST /api/v1/kyc/submit
Authorization: Bearer <token>
Content-Type: multipart/form-data

aadhaar_front  → image file
aadhaar_back   → image file
pan_card       → image file
bank_passbook  → image file (optional)
```

### KYC Status Values
| Status | Meaning |
|--------|---------|
| `PENDING` | Not submitted yet |
| `PENDING_VERIFICATION` | Submitted, waiting for admin review |
| `ACTION_REQUIRED` | Admin requests re-upload |
| `APPROVED` | Verified — can accept jobs |
| `REJECTED` | Documents rejected |

---

## 8. KYC — Cashfree (Auto-Verify)

> **Prefix:** `/api/v1/kyc/cashfree`  
> Cashfree-powered instant verification via hosted link + webhook auto-approval.

### Partner Self-Service (Recommended Flow)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/kyc/cashfree/initiate` | ✅ SP | Generate a Cashfree KYC verification link |
| `GET`  | `/kyc/cashfree/status/me` | ✅ SP | Poll my current KYC status + verification ID |

### Initiate KYC
```http
POST /api/v1/kyc/cashfree/initiate
Authorization: Bearer <token>
```
```json
{
  "success": true,
  "data": {
    "kyc_link": "https://kyc.cashfree.com/link/abc123",
    "verification_id": "snearal_sp_uuid_timestamp",
    "expires_at": "2026-05-10T10:00:00Z",
    "status": "PENDING_VERIFICATION"
  }
}
```
> Open `kyc_link` in a **WebView** in the app. Cashfree handles Aadhaar + PAN + Liveness. On completion, the webhook auto-approves/rejects without any further action needed.

### Poll KYC Status
```http
GET /api/v1/kyc/cashfree/status/me
Authorization: Bearer <token>
```
```json
{
  "success": true,
  "data": {
    "kyc_status": "APPROVED",
    "verification_id": "snearal_sp_uuid_timestamp"
  }
}
```

---

### Individual Verification Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/kyc/cashfree/verify-pan` | ✅ SP | Instant PAN card verification |
| `POST` | `/kyc/cashfree/aadhaar/generate-otp` | ✅ SP | Aadhaar OTP — Step 1 |
| `POST` | `/kyc/cashfree/aadhaar/verify-otp` | ✅ SP | Aadhaar OTP — Step 2 (returns Aadhaar details) |
| `POST` | `/kyc/cashfree/verify-bank` | ✅ SP | Bank account verification (Penny Drop) |

### Verify PAN
```http
POST /api/v1/kyc/cashfree/verify-pan
Authorization: Bearer <token>
Content-Type: application/json

{
  "pan": "ABCDE1234F",
  "name": "Ramesh Kumar"
}
```

### Aadhaar Verification (2-step)
```http
// Step 1 — Send OTP to Aadhaar-linked mobile
POST /api/v1/kyc/cashfree/aadhaar/generate-otp
{ "aadhaar_number": "123456789012" }

// Step 2 — Verify OTP
POST /api/v1/kyc/cashfree/aadhaar/verify-otp
{ "ref_id": "ref_from_step1", "otp": "123456" }
```

### Verify Bank Account
```http
POST /api/v1/kyc/cashfree/verify-bank
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_number": "9876543210123456",
  "ifsc": "HDFC0001234",
  "name": "Ramesh Kumar"
}
```

### Webhook (Cashfree → Server, Public)
```
POST /api/v1/kyc/cashfree/webhook
```
> Configure this URL in **Cashfree Dashboard → Developers → Webhooks**.  
> When a partner completes KYC, Cashfree POSTs here and the server auto-sets `kyc_status = APPROVED` or `REJECTED` and sends a push notification.

---

## 9. Wallet & Earnings

> **Prefix:** `/api/v1/wallet`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/wallet` | ✅ | Current balance + withdrawal limits |
| `GET` | `/wallet/stats` | ✅ | Total earned, total paid out, current balance |
| `GET` | `/wallet/transactions` | ✅ | Full ledger — credits (job payments) and debits (commission) |
| `POST` | `/wallet/withdraw` | ✅ SP | Request withdrawal (minimum ₹100) |
| `POST` | `/wallet/add-money` | ✅ | Top up wallet |

### Get Wallet Balance
```http
GET /api/v1/wallet
Authorization: Bearer <token>
```
```json
{
  "success": true,
  "data": {
    "balance": 8500.00,
    "currency": "INR"
  }
}
```

### Transaction Ledger
```http
GET /api/v1/wallet/transactions?page=1&limit=20
Authorization: Bearer <token>
```

### Withdraw
```http
POST /api/v1/wallet/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 2000,
  "bankAccountId": "uuid-optional"
}
```

---

## 10. Payouts

> **Prefix:** `/api/v1/payouts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/payouts/request` | ✅ SP | Request bank transfer (minimum ₹500) |
| `GET`  | `/payouts/history` | ✅ SP | View all my payout requests + status |

### Request Payout
```http
POST /api/v1/payouts/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1500
}
```

### Payout Status Values
| Status | Meaning |
|--------|---------|
| `PENDING` | Request submitted |
| `APPROVED` | Admin approved, processing |
| `COMPLETED` | Money transferred to bank |
| `REJECTED` | Request denied |
| `FAILED` | Transfer failed |

---

## 11. Reviews

> **Prefix:** `/api/v1/reviews` or `/api/v1/bookings/:id/reviews`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/bookings/:id/reviews` | ✅ SP | Submit review for a customer after job completion |
| `GET`  | `/bookings/reviews/my-reviews` | ✅ SP | Get all reviews written about me |
| `GET`  | `/reviews/partners/:partnerId/reviews` | ✅ | See another partner's reviews |
| `GET`  | `/reviews/partners/:partnerId/rating-summary` | ✅ | Star breakdown + avg rating |
| `GET`  | `/reviews/bookings/:id/reviews/status` | ✅ | Check if review was already submitted |

### Submit a Review (Partner → Customer)
```http
POST /api/v1/bookings/{bookingId}/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 4,
  "comment": "Customer was cooperative and polite.",
  "type": "PARTNER_TO_CUSTOMER"
}
```

> Review `type` must be `PARTNER_TO_CUSTOMER` when submitted by a service partner.

---

## 12. Messages / Chat

> **Prefix:** `/api/v1/messages`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/messages/conversations` | ✅ | List all booking-based conversations |
| `GET`  | `/messages/conversations/:id` | ✅ | Get message history for a conversation |
| `POST` | `/messages/conversations/:id/messages` | ✅ | Send a text message |
| `POST` | `/messages/upload` | ✅ | Upload image/file attachment |

### Send a Message
```http
POST /api/v1/messages/conversations/{conversationId}/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "I am on my way, will arrive in 10 minutes",
  "bookingId": "uuid"
}
```

### Upload File Attachment
```http
POST /api/v1/messages/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

[field: file] → image, document, etc.
```
Returns a Cloudinary URL to include in next message.

> 💡 **Real-time messaging is done via Socket.IO** — see [Section 16](#16-socketio-events).

---

## 13. Location Tracking

> **Prefix:** `/api/v1/tracking`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/tracking/partner/location` | ✅ SP | Push GPS coordinates (call every 30–60s) |
| `GET`  | `/tracking/partner/location/history` | ✅ SP | My own recent location trail |

### Push Location
```http
POST /api/v1/tracking/partner/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "lat": 12.9141,
  "lng": 77.6411
}
```

> Also update location via booking endpoint:
```http
POST /api/v1/bookings/partner/update-location
{ "latitude": 12.9141, "longitude": 77.6411 }
```

---

## 14. Notifications & Push

> **Prefix:** `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/notifications` | ✅ | Get all notifications (paginated) |
| `PATCH`| `/notifications/:id/read` | ✅ | Mark a single notification as read |
| `POST` | `/notifications/mark-all-read` | ✅ | Mark all as read |
| `DELETE`| `/notifications/:id` | ✅ | Delete a notification |
| `POST` | `/notifications/register-device` | ✅ | **Register FCM token** (call after every login) |
| `DELETE`| `/notifications/unregister-device` | ✅ | Remove FCM token (call on logout) |

### Register FCM Device Token
```http
POST /api/v1/notifications/register-device
Authorization: Bearer <token>
Content-Type: application/json

{
  "fcmToken": "AAAAPw3...FCM_token_from_firebase"
}
```

> ⚠️ **Must be called after every login** to ensure push notifications work.

### Notification Object
```json
{
  "id": "uuid",
  "title": "New Job Assigned",
  "body": "You have a new Fan Installation booking at 10:00 AM",
  "type": "BOOKING_ASSIGNED",
  "read": false,
  "data": {
    "bookingId": "uuid",
    "screen": "JobDetails"
  },
  "created_at": "2026-05-09T10:00:00Z"
}
```

---

## 15. Services Catalog

> **Prefix:** `/api/v1/services`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/services` | ✅ | List all platform services (with categories) |
| `GET` | `/services/:id` | ✅ | Get details of a specific service |
| `GET` | `/public/categories` | ❌ | List all service categories (no auth needed) |
| `GET` | `/categories` | ❌ | Legacy alias for categories |

### Get All Services (for sync)
```http
GET /api/v1/services?categoryId=uuid&isActive=true&limit=50
Authorization: Bearer <token>
```

---

## 16. Socket.IO Events

> **Namespace:** `/partner`  
> **URL:** `ws://<your-domain>/partner`

### Connection
```js
const socket = io("http://localhost:4000/partner", {
  auth: { token: accessToken }
});

socket.on("connect", () => {
  socket.emit("partner:join", { partnerId: "uuid" });
});
```

### Events the App Should Listen To

| Event | Payload | Description |
|-------|---------|-------------|
| `booking:new` | `{ bookingId, customer, service, location }` | New job assigned |
| `booking:updated` | `{ bookingId, status }` | Booking status changed |
| `booking:cancelled` | `{ bookingId, reason }` | Customer cancelled |
| `message:received` | `{ conversationId, senderId, text, timestamp }` | In-chat message |
| `kyc:status_updated` | `{ status, message }` | KYC approved or rejected |
| `payment:received` | `{ bookingId, amount }` | Job payment credited |
| `notification:new` | `{ title, body, type, data }` | Push alert |

### Events the App Should Emit

| Event | Payload | Description |
|-------|---------|-------------|
| `partner:location` | `{ lat, lng, bookingId }` | Push live location |
| `partner:status` | `{ status: "ONLINE" \| "OFFLINE" }` | Toggle availability |
| `booking:accept` | `{ bookingId }` | Accept job via socket |
| `booking:reject` | `{ bookingId, reason }` | Reject job via socket |
| `message:send` | `{ conversationId, bookingId, text }` | Send chat message |

---

## Common Response Format

### Success
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### Common Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body failed validation |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Valid token, wrong role |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate (e.g. review already submitted) |
| 422 | `VALIDATION_ERROR` | Input format validation failed |
| 500 | `SERVER_ERROR` | Unexpected server error |

---

## Recommended App Startup Sequence

```
1. POST /auth/login                     → get accessToken + refreshToken
2. POST /notifications/register-device  → register FCM token for push
3. Connect Socket.IO /partner namespace → for real-time updates
4. GET  /auth/me                        → load profile
5. GET  /wallet                         → show balance
6. GET  /kyc/cashfree/status/me         → check KYC status (gate if PENDING)
7. GET  /bookings?status=PARTNER_ASSIGNED → load active jobs
8. PATCH /partner/availability          → set ONLINE
```

---

## Test Credentials (Sandbox)

| Role | Email | Password |
|------|-------|----------|
| Service Partner (Electrician) | `ramesh.electrician@service.com` | `password123` |
| Service Partner (Plumber) | `suresh.plumber@service.com` | `password123` |
| Service Partner (Carpenter) | `kumar.carpenter@service.com` | `password123` |
| Service Partner (Cleaner) | `deepak.cleaner@service.com` | `password123` |
| Admin | `admin@snearal.com` | `password123` |
| Customer | `rajesh.kumar@gmail.com` | `password123` |

---

*Generated: May 2026 | Snearal Backend v1.0*
