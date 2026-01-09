# Socket.IO Real-time Events Documentation

## Overview

The backend now supports real-time bidirectional communication using Socket.IO with three namespaces for different user roles.

## Namespaces

### 1. `/customer` - Customer Events
For customers to track bookings and communicate

### 2. `/partner` - Partner Events  
For service partners to manage bookings and location

### 3. `/admin` - Admin Events
For admin dashboard real-time updates

---

## Authentication

All Socket.IO connections require JWT authentication.

**Connection Example**:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/customer', {
  auth: {
    token: 'your_jwt_access_token'
  }
});
```

---

## Customer Namespace (`/customer`)

### Events to Emit (Client → Server)

#### `booking:track`
Start tracking a booking for real-time updates
```javascript
socket.emit('booking:track', bookingId);
```

#### `booking:untrack`
Stop tracking a booking
```javascript
socket.emit('booking:untrack', bookingId);
```

#### `message:send`
Send a message to partner
```javascript
socket.emit('message:send', {
  recipientId: 'partner_user_id',
  message: 'Hello, when will you arrive?',
  bookingId: 'booking_id' // optional
});
```

#### `booking:cancel`
Cancel a booking
```javascript
socket.emit('booking:cancel', {
  bookingId: 'booking_id',
  reason: 'Changed my mind'
});
```

### Events to Listen (Server → Client)

#### `booking:status_updated`
Booking status changed
```javascript
socket.on('booking:status_updated', (data) => {
  console.log(data);
  // {
  //   bookingId: 'uuid',
  //   status: 'PARTNER_ACCEPTED',
  //   message: 'Partner has accepted your booking'
  // }
});
```

#### `partner:assigned`
Partner assigned to booking
```javascript
socket.on('partner:assigned', (data) => {
  // Partner details
});
```

#### `partner:location_update`
Real-time partner location
```javascript
socket.on('partner:location_update', (data) => {
  // {
  //   bookingId: 'uuid',
  //   location: { latitude: 28.6139, longitude: 77.2090 },
  //   timestamp: '2025-12-13T...'
  // }
});
```

#### `message:received`
New message from partner
```javascript
socket.on('message:received', (data) => {
  // Message details
});
```

#### `notification:new`
New notification
```javascript
socket.on('notification:new', (data) => {
  // Notification details
});
```

---

## Partner Namespace (`/partner`)

### Events to Emit (Client → Server)

#### `booking:accept`
Accept a booking
```javascript
socket.emit('booking:accept', bookingId);
```

#### `booking:reject`
Reject a booking
```javascript
socket.emit('booking:reject', {
  bookingId: 'booking_id',
  reason: 'Not available'
});
```

#### `booking:status_update`
Update booking status
```javascript
socket.emit('booking:status_update', {
  bookingId: 'booking_id',
  status: 'IN_PROGRESS'
});
```

#### `location:update`
Update current location
```javascript
socket.emit('location:update', {
  latitude: 28.6139,
  longitude: 77.2090
});
```

#### `message:send`
Send message to customer
```javascript
socket.emit('message:send', {
  recipientId: 'customer_user_id',
  message: 'On my way!',
  bookingId: 'booking_id'
});
```

### Events to Listen (Server → Client)

#### `booking:new_request`
New booking assigned
```javascript
socket.on('booking:new_request', (data) => {
  // {
  //   bookingId: 'uuid',
  //   bookingNumber: 'BK123456',
  //   service: 'House Cleaning',
  //   scheduledAt: '2025-12-15T...',
  //   address: '123 Main St',
  //   amount: 999
  // }
});
```

#### `booking:cancelled`
Customer cancelled booking
```javascript
socket.on('booking:cancelled', (data) => {
  // Cancellation details
});
```

#### `message:received`
New message from customer
```javascript
socket.on('message:received', (data) => {
  // Message details
});
```

#### `earnings:updated`
Earnings updated
```javascript
socket.on('earnings:updated', (data) => {
  // Earnings details
});
```

#### `notification:new`
New notification
```javascript
socket.on('notification:new', (data) => {
  // Notification details
});
```

---

## Admin Namespace (`/admin`)

### Events to Emit (Client → Server)

#### `request:stats`
Request dashboard statistics
```javascript
socket.emit('request:stats');
```

#### `monitor:bookings`
Start monitoring all bookings
```javascript
socket.emit('monitor:bookings');
```

### Events to Listen (Server → Client)

#### `dashboard:stats_update`
Real-time dashboard statistics
```javascript
socket.on('dashboard:stats_update', (stats) => {
  // Dashboard statistics
});
```

#### `booking:created`
New booking created
```javascript
socket.on('booking:created', (data) => {
  // New booking details
});
```

#### `booking:updated`
Booking updated
```javascript
socket.on('booking:updated', (data) => {
  // Updated booking details
});
```

#### `partner:registered`
New partner registered
```javascript
socket.on('partner:registered', (data) => {
  // New partner details
});
```

#### `kyc:submitted`
New KYC submission
```javascript
socket.on('kyc:submitted', (data) => {
  // KYC submission details
});
```

---

## Shared Events (All Namespaces)

### Typing Indicators

#### `typing:start`
Show typing indicator
```javascript
socket.emit('typing:start', recipientId);
```

#### `typing:stop`
Hide typing indicator
```javascript
socket.emit('typing:stop', recipientId);
```

#### `typing:indicator`
Listen for typing status
```javascript
socket.on('typing:indicator', (data) => {
  // { userId: 'uuid', typing: true/false }
});
```

### Message Events

#### `message:mark_read`
Mark message as read
```javascript
socket.emit('message:mark_read', messageId);
```

#### `message:sent`
Confirmation of sent message
```javascript
socket.on('message:sent', (data) => {
  // { id: 'message_id', createdAt: '...' }
});
```

---

## Error Handling

All namespaces emit error events:

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error.message);
});
```

---

## Connection Status

Monitor connection status:

```javascript
socket.on('connect', () => {
  console.log('Connected to socket server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

## Example: Customer Tracking Booking

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/customer', {
  auth: { token: accessToken }
});

socket.on('connect', () => {
  // Start tracking booking
  socket.emit('booking:track', bookingId);
});

socket.on('booking:status_updated', (data) => {
  console.log('Status:', data.status);
});

socket.on('partner:location_update', (data) => {
  // Update map with partner location
  updateMap(data.location);
});

socket.on('message:received', (data) => {
  // Show new message
  displayMessage(data);
});
```

---

## Example: Partner Updating Location

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/partner', {
  auth: { token: accessToken }
});

// Update location every 10 seconds
setInterval(() => {
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit('location:update', {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    });
  });
}, 10000);

socket.on('booking:new_request', (booking) => {
  // Show new booking notification
  showNotification(booking);
});
```

---

## Production Considerations

1. **Reconnection Logic**: Implement automatic reconnection with exponential backoff
2. **Token Refresh**: Refresh JWT tokens before expiry
3. **Room Management**: Properly join/leave rooms to avoid memory leaks
4. **Error Handling**: Handle all error events
5. **Load Balancing**: Use Redis adapter for multiple server instances

---

## Next Steps

For production deployment with multiple servers, configure Redis adapter:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```
