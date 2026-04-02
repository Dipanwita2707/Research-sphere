# Pass Cancellation with Hostel Refund System - Implementation Summary

## Overview
Implemented a comprehensive pass cancellation system that handles two different flows:
1. **Before Check-in Cancellation** - With hostel refund logic (if hostel was booked)
2. **After Check-in Cancellation** - Generates checkout QR code (existing flow enhanced)

## Database Schema Changes

### 1. New Models Added

#### SystemConfig Model
```prisma
model SystemConfig {
  id            String   @id @default(uuid)
  config_key    String   @unique
  config_value  String
  config_type   config_type_enum  @default(STRING)
  description   String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
}
```

**Purpose**: Stores system-wide configuration values (like refund percentage)  
**Key Config**: `hostel_cancellation_refund_percent` = `90` (default)

#### RefundTransaction Model
```prisma
model RefundTransaction {
  id                      String  @id @default(uuid)
  booking_id              String
  pass_id                 String
  original_amount         Float
  cancellation_fee_percent Float
  cancellation_fee_amount Float
  refund_amount           Float
  refund_status           refund_status_enum @default(pending)
  processed_by_id         String?
  processed_at            DateTime?
  remarks                 String?
  created_at              DateTime @default(now())
}
```

**Purpose**: Complete audit trail of all hostel booking refunds

#### New Enums
```prisma
enum config_type_enum {
  STRING
  NUMBER
  PERCENTAGE
  BOOLEAN
}

enum refund_status_enum {
  pending
  processed
  failed
}
```

### 2. Schema Updates

#### gate_pass Model
- **Added Field**: `cancellation_reason` (Text) - Stores why pass was cancelled

#### HostelBooking Model
- **Added Relation**: `refund_transactions RefundTransaction[]`

#### payment_status_enum
- **Already has**: `refunded` value ✅ (no changes needed)

## Backend Implementation

### Service Layer (`gatePass.service.js`)

#### 1. Modified `cancelPass()` Function
**Location**: Lines 1180-1220

**Logic Flow**:
```javascript
async cancelPass(pass_id, userId, reason) {
  // 1. Fetch pass with creator info
  // 2. Validate permissions (creator/guard/admin)
  // 3. Validate reason is provided (mandatory)
  // 4. Check pass status not already cancelled/checked_out
  
  // Route to appropriate flow:
  if (pass.pass_status === 'created') {
    return await this.cancelBeforeCheckIn(pass, userId, reason);
  } else if (pass.pass_status === 'checked_in') {
    return await this.cancelAfterCheckIn(pass, userId, reason);
  }
}
```

#### 2. New `cancelBeforeCheckIn()` Function
**Location**: Lines 1064-1180

**Logic Flow**:
```javascript
async cancelBeforeCheckIn(pass, userId, reason) {
  // 1. Check if pass has hostel booking (stay_required flag)
  // 2. If hostel booking exists:
  //    a. Fetch refund % from SystemConfig
  //    b. Calculate cancellation fee and refund amount
  //    c. Create RefundTransaction record
  //    d. Update HostelBooking: booking_status='cancelled', payment_status='refunded'
  // 3. Update gate_pass:
  //    - pass_status = 'cancelled'
  //    - qr_status = 'cancelled'
  //    - cancellation_time = NOW()
  //    - cancellation_reason = reason
  // 4. Return pass with hostel_refund data (NO checkout QR)
}
```

**Refund Calculation**:
```javascript
const originalAmount = hostelBooking.total_price;  // e.g., ₹2000
const refundPercent = 90;  // From SystemConfig
const cancellationFeePercent = 100 - 90 = 10;
const cancellationFeeAmount = 2000 * 10 / 100 = ₹200;
const refundAmount = 2000 - 200 = ₹1800;
```

#### 3. New `cancelAfterCheckIn()` Function
**Location**: Lines 1220-1280

**Logic Flow**:
```javascript
async cancelAfterCheckIn(pass, userId, reason) {
  // 1. Generate checkout QR with 1-hour validity
  // 2. Update gate_pass:
  //    - pass_status = 'cancelled'
  //    - qr_status = 'cancelled'
  //    - cancellation_time = NOW()
  //    - cancellation_reason = reason
  //    - checkout_unique_id, checkout_verification_code, checkout_qr_code
  // 3. Queue notification to visitor (email/WhatsApp)
  // 4. Return pass with checkout_qr data
}
```

#### 4. System Config Management Functions

##### `getSystemConfig(configKey)`
**Location**: Lines 2268-2285

Returns specific configuration value by key.

##### `updateSystemConfig(configKey, configValue, userId)`
**Location**: Lines 2287-2345

Updates configuration (admin only). Validates value based on config_type:
- **PERCENTAGE**: Must be 0-100
- **NUMBER**: Must be valid number
- **BOOLEAN**: Must be true/false or 1/0

##### `getAllSystemConfigs(userId)`
**Location**: Lines 2347-2365

Returns all configurations (admin only).

### Controller Layer (`gatePass.controller.js`)

#### New Controller Methods

1. **`getSystemConfig(req, res)`** - Line 650
2. **`updateSystemConfig(req, res)`** - Line 670
3. **`getAllSystemConfigs(req, res)`** - Line 692
4. **`getAllRefunds(req, res)`** - Line 714
5. **`getRefundByBooking(req, res)`** - Line 786

### Routes Layer (`gatePass.routes.js`)

#### New API Endpoints

```javascript
// System Configuration
GET    /api/v1/gate-entry/config           - Get all configs (admin only)
GET    /api/v1/gate-entry/config/:key      - Get specific config
PUT    /api/v1/gate-entry/config/:key      - Update config (admin only)

// Refund Transactions
GET    /api/v1/gate-entry/refunds          - Get all refunds (admin only)
GET    /api/v1/gate-entry/refunds/:bookingId - Get refund for booking
```

#### Modified Endpoint

```javascript
POST   /api/v1/gate-entry/cancel/:passId   - Now handles both before/after check-in
```

**Request Body**:
```json
{
  "reason": "Visitor cannot come due to emergency" // REQUIRED
}
```

**Response Structure**:

**Before Check-in (with hostel)**:
```json
{
  "success": true,
  "message": "Pass cancelled successfully",
  "data": {
    "pass_id": "UNI-PASS-20260226-001",
    "pass_status": "cancelled",
    "cancellation_time": "2026-02-26T10:30:00Z",
    "cancellation_reason": "Emergency",
    "cancellation_type": "before_check_in",
    "hostel_refund": {
      "booking_id": "uuid",
      "room_number": "101",
      "hostel_name": "Block A Hostel",
      "original_amount": 2000,
      "cancellation_fee_percent": 10,
      "cancellation_fee_amount": 200,
      "refund_amount": 1800,
      "refund_transaction_id": "uuid"
    }
  }
}
```

**Before Check-in (without hostel)**:
```json
{
  "success": true,
  "data": {
    "pass_status": "cancelled",
    "cancellation_type": "before_check_in",
    "hostel_refund": null
  }
}
```

**After Check-in**:
```json
{
  "success": true,
  "data": {
    "pass_status": "cancelled",
    "cancellation_type": "after_check_in",
    "checkout_qr": {
      "checkout_unique_id": "CHECKOUT-20260226-001",
      "checkout_verification_code": "123456",
      "qr_code": "data:image/png;base64,...",
      "expires_at": "2026-02-26T11:30:00Z",
      "expires_in_minutes": 60
    }
  }
}
```

## Frontend Implementation

### Translation Keys Added

#### English (`en`)
```typescript
'allPasses.cancel.beforeCheckIn': 'Cancel Before Check-in',
'allPasses.cancel.afterCheckIn': 'Cancel After Check-in (Checkout QR)',
'allPasses.cancel.refundDetails': 'Refund Details',
'allPasses.cancel.originalAmount': 'Original Amount',
'allPasses.cancel.cancellationFee': 'Cancellation Fee ({percent}%)',
'allPasses.cancel.refundAmount': 'Refund Amount',
'allPasses.cancel.hostelBookingInfo': 'Hostel Booking Information',
'allPasses.cancel.roomNumber': 'Room Number',
'allPasses.cancel.hostelName': 'Hostel Name',
'allPasses.cancel.noRefund': 'No hostel booking - no refund applicable',
'allPasses.cancel.warningBeforeCheckIn': 'Note: This pass has not been checked in yet.',
'allPasses.cancel.warningAfterCheckIn': 'Warning: Checkout QR (1 hour validity) will be sent.',
'allPasses.cancel.successBeforeCheckIn': 'Pass cancelled successfully',
'allPasses.cancel.successWithRefund': 'Pass cancelled. Refund amount: ₹{amount}',
'allPasses.cancel.reasonRequiredError': 'Cancellation reason is required',
```

#### Hindi (`hi`)
```typescript
'allPasses.cancel.beforeCheckIn': 'चेक-इन से पहले रद्द करें',
'allPasses.cancel.refundDetails': 'धनवापसी विवरण',
'allPasses.cancel.originalAmount': 'मूल राशि',
'allPasses.cancel.cancellationFee': 'रद्दीकरण शुल्क ({percent}%)',
'allPasses.cancel.refundAmount': 'धनवापसी राशि',
// ... etc (17 new keys total)
```

### UI Changes Required (TODO - Task #8)

**File**: `frontend/src/app/admin/gate-entry/page.tsx`

#### Cancel Dialog Enhancement Needed

1. **Detect Pass Status**: Check if `selectedPass.passStatus === 'created'` (before check-in)
2. **Show Refund Preview**: If pass has hostel booking, fetch and display refund calculation
3. **Dynamic Warning Message**: 
   - Before check-in: "No checkout QR will be generated"
   - After check-in: "1-hour checkout QR will be sent"
4. **Success Message**: 
   - Show refund amount if applicable
   - Show checkout QR if after check-in

**Recommended Implementation**:
```typescript
// Add state for refund preview
const [refundPreview, setRefundPreview] = useState<RefundData | null>(null);

// Fetch refund preview when modal opens (if before check-in + hostel)
useEffect(() => {
  if (showCancelModal && selectedPass?.passStatus === 'created' && selectedPass?.stayRequired) {
    fetchRefundPreview(selectedPass.passId);
  }
}, [showCancelModal, selectedPass]);

// Update handleCancelPassConfirm to handle different responses
const handleCancelPassConfirm = async () => {
  const response = await gateEntryService.cancelPass(selectedPass.passId, cancelReason);
  
  if (response.data.cancellation_type === 'before_check_in') {
    if (response.data.hostel_refund) {
      toast.success(
        t('allPasses.cancel.successWithRefund', { 
          amount: response.data.hostel_refund.refund_amount 
        })
      );
    } else {
      toast.success(t('allPasses.cancel.successBeforeCheckIn'));
    }
  } else {
    // Show checkout QR modal (existing flow)
    toast.showSuccessModal({ ...checkoutQRData });
  }
};
```

## Database Migration

### Migration Steps

1. **Stop Backend Server** (if running)

2. **Run Migration**:
   ```bash
   cd backend
   npx prisma db push --accept-data-loss
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

4. **Seed Default Configuration**:
   ```bash
   node scripts/seed-system-config.js
   ```

5. **Restart Backend Server**

### Seed Script
**Location**: `backend/scripts/seed-system-config.js`

Inserts default config:
```sql
INSERT INTO system_config (
  config_key, 
  config_value, 
  config_type, 
  description
) VALUES (
  'hostel_cancellation_refund_percent',
  '90',
  'PERCENTAGE',
  'Refund percentage for before check-in hostel booking cancellation'
);
```

## Testing Checklist

### Test Case 1: Before Check-in Cancellation (with Hostel)
1. Create pass with hostel booking
2. **DO NOT** check-in
3. Cancel pass with reason
4. **Expected**:
   - ✅ Pass status = 'cancelled'
   - ✅ NO checkout QR generated
   - ✅ RefundTransaction record created
   - ✅ HostelBooking.payment_status = 'refunded'
   - ✅ Refund amount calculated correctly

### Test Case 2: Before Check-in Cancellation (without Hostel)
1. Create pass **without** hostel booking
2. Cancel pass with reason
3. **Expected**:
   - ✅ Pass status = 'cancelled'
   - ✅ NO checkout QR
   - ✅ NO refund transaction
   - ✅ Simple cancellation

### Test Case 3: After Check-in Cancellation
1. Create pass and allow entry (check-in)
2. Cancel pass with reason
3. **Expected**:
   - ✅ Pass status = 'cancelled'
   - ✅ Checkout QR generated (1-hour validity)
   - ✅ checkout_unique_id, checkout_verification_code set
   - ✅ Notification queued

### Test Case 4: Validation Errors
1. Try to cancel without reason → **Error**: "Cancellation reason is required"
2. Try to cancel already cancelled pass → **Error**: "Pass is already cancelled"
3. Try to cancel checked-out pass → **Error**: "Cannot cancel"

### Test Case 5: Permission Checks
1. Student tries to cancel someone else's pass → **Error**: "Permission denied"
2. Guard cancels checked-in pass → **Success**
3. Admin cancels any pass → **Success**

### Test Case 6: Refund Configuration
1. Admin updates refund % via API:
   ```bash
   PUT /api/v1/gate-entry/config/hostel_cancellation_refund_percent
   Body: { "value": "80" }
   ```
2. Cancel pass with hostel
3. **Expected**: Refund calculated with 80% (20% fee)

### Test Case 7: Refund Transaction Query
1. Admin fetches all refunds:
   ```bash
   GET /api/v1/gate-entry/refunds
   ```
2. Creator fetches specific refund:
   ```bash
   GET /api/v1/gate-entry/refunds/:bookingId
   ```
3. **Expected**: Formatted refund data with visitor, hostel, and amounts

## API Documentation

### Update Refund Percentage (Admin Only)

**Endpoint**: `PUT /api/v1/gate-entry/config/hostel_cancellation_refund_percent`

**Request**:
```json
{
  "value": "85"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "data": {
    "key": "hostel_cancellation_refund_percent",
    "value": "85",
    "type": "PERCENTAGE",
    "description": "Refund percentage for before check-in...",
    "updated_at": "2026-02-26T10:00:00Z"
  }
}
```

### Get All Refunds (Admin Only)

**Endpoint**: `GET /api/v1/gate-entry/refunds`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "pass_id": "UNI-PASS-20260226-001",
      "visitor_name": "John Doe",
      "mobile_number": "9876543210",
      "hostel_name": "Block A Hostel",
      "room_number": "101",
      "original_amount": 2000,
      "cancellation_fee_percent": 10,
      "cancellation_fee_amount": 200,
      "refund_amount": 1800,
      "refund_status": "pending",
      "processed_by": "Admin Name",
      "processed_at": "2026-02-26T10:30:00Z",
      "remarks": "Before check-in cancellation. Reason: Emergency",
      "created_at": "2026-02-26T10:30:00Z"
    }
  ]
}
```

## Key Benefits

1. **✅ Automated Refund Calculation**: No manual calculation needed
2. **✅ Configurable Refund %**: Admin can adjust without code changes
3. **✅ Complete Audit Trail**: Every refund is tracked with full details
4. **✅ Fair Cancellation Fee**: Discourages last-minute cancellations
5. **✅ Two-Flow Support**: Handles both before/after check-in scenarios seamlessly
6. **✅ Mandatory Reason**: Ensures accountability for all cancellations
7. **✅ Bilingual Support**: Hindi + English for better accessibility

## Future Enhancements

1. **Automated Refund Processing**: Integration with payment gateway
2. **Tiered Refund %**: Based on time before visit (e.g., >24hrs = 90%, <24hrs = 50%)
3. **Email Notifications**: Send refund confirmation to visitor
4. **Refund Dashboard**: Finance team view for refund management
5. **Bulk Refund Processing**: Process multiple refunds at once

## Implementation Status

| Task | Status |
|------|--------|
| SystemConfig Model | ✅ Completed |
| RefundTransaction Model | ✅ Completed |
| payment_status_enum Verification | ✅ Completed |
| cancelBeforeCheckIn() Function | ✅ Completed |
| cancelAfterCheckIn() Function | ✅ Completed |
| Modified cancelPass() Logic | ✅ Completed |
| System Config Management APIs | ✅ Completed |
| Refund Query APIs | ✅ Completed |
| Translation Keys (EN + HI) | ✅ Completed |
| Database Migration Script | ✅ Completed |
| Seed Script | ✅ Completed |
| Frontend Cancel Dialog UI | ⏳ Pending |

## Next Steps

1. **Run Database Migration** (when backend is stopped)
2. **Seed Default Config** (`node scripts/seed-system-config.js`)
3. **Update Frontend Cancel Dialog** (Task #8) - See UI section above
4. **Test All Scenarios** - Use testing checklist
5. **Update User Documentation**

---

**Last Updated**: February 26, 2026  
**Implemented By**: GitHub Copilot  
**Status**: Backend Complete, Frontend UI Pending
