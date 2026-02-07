-- Sample Bookings for Snearal Platform
-- This script adds 15 sample bookings with various statuses for testing

-- First, let's get some IDs (you'll need to replace these with actual UUIDs from your database)
-- Run this query first to get customer IDs: SELECT id, full_name, role FROM users WHERE role = 'CUSTOMER' LIMIT 5;
-- Run this query to get partner IDs: SELECT id FROM service_partners LIMIT 4;
-- Run this query to get service IDs: SELECT id, name FROM services LIMIT 10;

-- Sample Booking 1 - Completed
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status, 
    scheduled_date, scheduled_time, service_address, 
    service_latitude, service_longitude, total_amount, 
    advance_amount, remaining_amount, payment_status, 
    completed_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' LIMIT 1),
    (SELECT id FROM service_partners LIMIT 1),
    'COMPLETED',
    '2026-01-20 10:00:00',
    '10:00 AM',
    '101 Green Park, Koramangala, Bangalore',
    12.9352,
    77.6245,
    549.00,
    200.00,
    0.00,
    'PAID',
    '2026-01-20 12:30:00',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
);

-- Sample Booking 2 - In Progress
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status,
    scheduled_date, scheduled_time, service_address,
    service_latitude, service_longitude, total_amount,
    advance_amount, remaining_amount, payment_status,
    started_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' OFFSET 1 LIMIT 1),
    (SELECT id FROM service_partners OFFSET 1 LIMIT 1),
    'IN_PROGRESS',
    '2026-01-25 14:00:00',
    '2:00 PM',
    '202 Prestige Heights, Indiranagar, Bangalore',
    12.9784,
    77.6408,
    1899.00,
    500.00,
    1399.00,
    'PARTIAL',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '2 days',
    NOW()
);

-- Sample Booking 3 - Partner Assigned
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status,
    scheduled_date, scheduled_time, service_address,
    service_latitude, service_longitude, total_amount,
    advance_amount, remaining_amount, payment_status,
    partner_assigned_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' OFFSET 2 LIMIT 1),
    (SELECT id FROM service_partners OFFSET 2 LIMIT 1),
    'PARTNER_ASSIGNED',
    '2026-01-26 09:00:00',
    '9:00 AM',
    '303 Brigade Gateway, Rajajinagar, Bangalore',
    12.9916,
    77.5712,
    279.00,
    100.00,
    179.00,
    'PARTIAL',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '4 hours'
);

-- Sample Booking 4 - Pending
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status,
    scheduled_date, scheduled_time, service_address,
    service_latitude, service_longitude, total_amount,
    advance_amount, remaining_amount, payment_status,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' OFFSET 3 LIMIT 1),
    NULL,
    'PENDING',
    '2026-01-27 16:00:00',
    '4:00 PM',
    '404 Sobha Dream Acres, Whitefield, Bangalore',
    12.9698,
    77.7500,
    799.00,
    0.00,
    799.00,
    'PENDING',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
);

-- Sample Booking 5 - Completed
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status,
    scheduled_date, scheduled_time, service_address,
    service_latitude, service_longitude, total_amount,
    advance_amount, remaining_amount, payment_status,
    completed_at, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' OFFSET 4 LIMIT 1),
    (SELECT id FROM service_partners OFFSET 3 LIMIT 1),
    'COMPLETED',
    '2026-01-18 11:00:00',
    '11:00 AM',
    '505 Embassy Pristine, Bellandur, Bangalore',
    12.9141,
    77.6411,
    2799.00,
    1000.00,
    0.00,
    'PAID',
    '2026-01-18 16:00:00',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
);

-- Sample Booking 6 - Searching Partner
INSERT INTO bookings (
    id, booking_number, customer_id, partner_id, status,
    scheduled_date, scheduled_time, service_address,
    service_latitude, service_longitude, total_amount,
    advance_amount, remaining_amount, payment_status,
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'BK-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0'),
    (SELECT id FROM users WHERE role = 'CUSTOMER' LIMIT 1),
    NULL,
    'SEARCHING_PARTNER',
    '2026-01-28 13:00:00',
    '1:00 PM',
    '101 Green Park, Koramangala, Bangalore',
    12.9352,
    77.6245,
    599.00,
    200.00,
    399.00,
    'PARTIAL',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
);

-- Add booking items for each booking
-- You'll need to get service IDs and add corresponding booking items
