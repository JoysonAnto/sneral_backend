# Snearal API Documentation: Service Partner App

This document provides the technical specifications for integrating the Snearal Backend into the Service Partner Mobile Application.

## 1. Authentication & Onboarding

### A. Registration (KYC Flow)
- **Endpoint**: `POST /api/v1/auth/register`
- **Role**: `SERVICE_PARTNER`.
- **Note**: After registration, the partner is in `PENDING` KYC status.
- **Upload Documents**: Use `POST /api/v1/partners/kyc/upload` to submit ID proofs.

### B. Login
- Standard email/password login via `POST /api/v1/auth/login`.

---

## 2. Job Management Lifecycle

### A. Job Discovery
- Partners receive "New Job" notifications via Socket.IO.
- **Endpoint**: `GET /api/v1/partners/available-jobs` (to see nearby requests).

### B. Arriving & Starting
1.  **Arrive**: `PATCH /api/v1/bookings/:id/arrive`
    - Informs the customer you are on-site.
2.  **Request Start**: `POST /api/v1/bookings/:id/generate-start-otp`
    - This triggers the email to the customer with a **4-digit PIN**.
3.  **Verify Start**: `PATCH /api/v1/bookings/:id/start`
    - Body: `{ otp: "1234" }` (PIN provided by customer).

### C. Completing the Service
1.  **Request Completion**: `POST /api/v1/bookings/:id/generate-completion-otp`
    - This triggers the email to the customer with the **4-digit Completion OTP**.
2.  **Finalize**: `PATCH /api/v1/bookings/:id/complete`
    - Body: `{ otp: "5678", serviceNotes: "..." }`.

---

## 3. Earnings & Wallet

### A. Balance Tracking
- **Endpoint**: `GET /api/v1/auth/profile`
- **Fields**: Check `wallet.balance` and `service_partner.total_earnings`.

### B. Transactions
- **Endpoint**: `GET /api/v1/wallets/transactions`
- View credit for completed jobs and platform fee deductions.

---

## 4. Socket.IO (Real-time)
- **Namespace**: `/partner`
- **Events**:
  - `booking:new_request`: Notification for a new job in the area.
  - `booking:cancelled`: If a customer cancels before you start.
  - `partner:status_update`: Emit this to toggle between `AVAILABLE` and `OFFLINE`.

---

## 5. Key Endpoints Reference

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Partner** | `PATCH` | `/api/v1/partners/availability` | Toggle online/offline status |
| **Booking** | `GET` | `/api/v1/bookings/active` | Current active job details |
| **Support** | `POST` | `/api/v1/chat/message` | Send message to customer |
| **Profile** | `PUT` | `/api/v1/auth/profile` | Update profile details / avatar |
