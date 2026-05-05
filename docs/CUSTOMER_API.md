# Snearal API Documentation: Customer Mobile App

This document provides the technical specifications for integrating the Snearal Backend into the Customer Mobile Application.

## 1. Authentication Flow (OTP-via-Email)

All authentication verifications now utilize **Email-based OTP** delivery to ensure reliable delivery.

### A. Registration
1.  **Endpoint**: `POST /api/v1/auth/register`
2.  **Request**:
    ```json
    {
      "email": "customer@example.com",
      "password": "SecurePassword123",
      "fullName": "John Doe",
      "phoneNumber": "9876543210",
      "role": "CUSTOMER"
    }
    ```
3.  **Action**: Backend sends a 6-digit OTP to the registered email.
4.  **Verification**: Call `POST /api/v1/auth/verify-otp` with the received code.

### B. Login (Two Modes)
**Mode 1: Password Login**
- `POST /api/v1/auth/login` with `identifier` (email/phone) and `password`.

**Mode 2: OTP Login (Passwordless)**
- `POST /api/v1/auth/login` with only `identifier`.
- Backend triggers `sendLoginOTPEmail`.
- Verify with `POST /api/v1/auth/verify-otp`.

---

## 2. Booking Lifecycle & Verifications

### A. Create a Booking
- **Endpoint**: `POST /api/v1/bookings`
- **Request**: `serviceId`, `scheduledAt`, `addressId`.

### B. Payment (Cashfree Integration)
1.  **Create Session**: `POST /api/v1/payments/`
    - Request: `bookingId`, `amount`, `method: "CASHFREE"`.
    - Response: `paymentSessionId`.
2.  **Verify**: `POST /api/v1/payments/verify-cashfree`
    - Request: `orderId`.

### C. Service Start Verification
- When the partner arrives, they will trigger a "Start Request".
- The customer receives a **4-digit Start PIN** via email.
- The customer must give this PIN to the partner to start the job.

### D. Service Completion Verification
- When the partner finish, the customer receives a **4-digit Completion OTP** via email.
- The customer must give this OTP to the partner to finalize the booking.

---

## 3. Key Endpoints Reference

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Public** | `GET` | `/api/v1/public/categories` | List all service categories |
| **Public** | `GET` | `/api/v1/public/services` | List services in a category |
| **Auth** | `POST` | `/api/v1/auth/resend-otp` | Resend verification email |
| **Booking** | `GET` | `/api/v1/bookings` | List customer's booking history |
| **Profile** | `GET` | `/api/v1/auth/profile` | Get current user details & wallet balance |

---

## 4. Socket.IO (Real-time)
- **Namespace**: `/customer`
- **Events**:
  - `booking:status_update`: Received when a partner accepts or arrives.
  - `chat:message`: Real-time messaging with the assigned partner.
