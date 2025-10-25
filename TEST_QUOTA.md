# WhatsApp Quota Testing Guide

## How to Test Database Updates

### 1. Check Current Quota
```sql
-- Run this in Supabase SQL Editor
SELECT id, name, monthly_quota, used_messages 
FROM stores 
WHERE id = 'YOUR_STORE_ID';
```

### 2. Send a Test Message
- Go to Customer Management
- Select a customer
- Send a single WhatsApp message
- Check backend console for log: `[Bulk Send] Updated quota: X -> Y`

### 3. Verify Database Update
```sql
-- Run again to see the updated value
SELECT id, name, monthly_quota, used_messages 
FROM stores 
WHERE id = 'YOUR_STORE_ID';
```

Expected: `used_messages` should increase by the number of successful sends

### 4. Test Bulk Send
- Select multiple customers (e.g., 5 customers)
- Send bulk WhatsApp message
- Check backend console for: `[Bulk Send] Updated quota: X -> X+5`

### 5. Reset Quota (for testing)
```sql
-- Reset to 0
UPDATE stores 
SET used_messages = 0 
WHERE id = 'YOUR_STORE_ID';

-- Or set to specific value
UPDATE stores 
SET used_messages = 150 
WHERE id = 'YOUR_STORE_ID';
```

### 6. Test Quota Limit
```sql
-- Set near limit
UPDATE stores 
SET used_messages = 198, monthly_quota = 200 
WHERE id = 'YOUR_STORE_ID';
```

Now try to send 5 messages - should get error: "Insufficient quota. You have 2 messages remaining but trying to send 5."

## Backend Console Logs to Look For

✅ **Success Logs:**
```
[Bulk Send] Starting bulk send to 3 recipients (Store: xxx, Quota: 10/200)
[Bulk Send] Success for 9876543210
[Bulk Send] Success for 9876543211
[Bulk Send] Success for 9876543212
[Bulk Send] Completed: 3 success, 0 failed out of 3 total
[Bulk Send] Updated quota: 10 -> 13
```

❌ **Quota Exceeded:**
```
[Bulk Send] Quota exceeded for store xxx: 200/200
```

❌ **Insufficient Quota:**
```
[Bulk Send] Insufficient quota for store xxx: Need 10, have 5
```

## Frontend Toast Messages

- Success: "Bulk WhatsApp: 3 sent, 0 failed (1 sec delay between each)"
- Quota Error: "Monthly WhatsApp quota exceeded. Please recharge to continue. (0/200 messages remaining)"
- Insufficient: "Insufficient quota. You have 5 messages remaining but trying to send 10. (5/200 messages remaining)"
