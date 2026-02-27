# Gate Entry Frontend Implementation Guide

## ✅ Completed
- ✓ Backend database schema updated
- ✓ Backend services enhanced
- ✓ Backend API routes added
- ✓ Backend controllers updated
- ✓ QR activation cron job created
- ✓ Hostel booking service created
- ✓ Frontend service layer updated
- ✓ Frontend components created (ExtendPassModal, HostelBookingFlow, PaymentQRModal)

## 📝 Remaining Frontend Updates

### 1. Create Pass Form (`frontend/src/app/admin/gate-entry/create-pass/page.tsx`)

#### Changes Needed:

**A. Update State Interface (Line ~20)**
```typescript
interface SimplePassFormData {
  // ... existing fields ...
  visitDate: string;
  visitEndDate: string;
  entryTime: string;  // CHANGE: Rename from expectedEntryTime
  // REMOVE: expectedExitTime field
  hasVehicle: boolean;
  vehicleType: string;
  vehicleNumber: string;
  vehicleModel: string;  // ADD: New field
  hostelBookingId: string;  // ADD: New field
  // ... existing fields ...
}
```

**B. Update Initial State (Line ~59)**
```typescript
const [formData, setFormData] = useState<SimplePassFormData>({
  // ... existing ...
  entryTime: '',  // CHANGE
  // REMOVE: expectedExitTime: '',
  vehicleModel: '',  // ADD
  hostelBookingId: '',  // ADD
});
```

**C. Add Student Role Check (After state declarations)**
```typescript
const [userRole, setUserRole] = useState<string | null>(null);
const [isStudentLocked, setIsStudentLocked] = useState(false);

useEffect(() => {
  // Get user role from auth context or local storage
  const role = localStorage.getItem('userRole'); // Adjust based on your auth implementation
  setUserRole(role);
  if (role?.toLowerCase() === 'student') {
    setIsStudentLocked(true);
    setFormData(prev => ({ ...prev, visitorRelation: 'Parent' }));
  }
}, []);
```

**D. Update Validation (Line ~130)**
```typescript
if (!formData.entryTime) {  // CHANGE
  setError('Entry time is required');
  return false;
}
// REMOVE: expectedExitTime validation

// ADD: Vehicle model validation
if (formData.hasVehicle && !formData.vehicleModel?.trim()) {
  setError('Vehicle model is required when vehicle is selected');
  return false;
}
```

**E. Update Submit Data (Line ~169)**
```typescript
const passData = {
  fullName: formData.visitorName,
  mobileNumber: formData.mobileNumber,
  // ... existing fields ...
  entryTime: formData.entryTime,  // CHANGE
  // REMOVE: expectedExitTime
  bringingVehicle: formData.hasVehicle,
  vehicleType: formData.hasVehicle ? formData.vehicleType : undefined,
  vehicleNumber: formData.hasVehicle ? formData.vehicleNumber : undefined,
  vehicleModel: formData.hasVehicle ? formData.vehicleModel : undefined,  // ADD
  hostelBookingId: formData.hostelBookingId || undefined,  // ADD
};
```

**F. Add Hostel Booking Flow Integration (Before form submit)**
```typescript
import HostelBookingFlow from '../components/HostelBookingFlow';

const [showHostelBooking, setShowHostelBooking] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;
  
  // Check if multi-day visit
  if (isMultiDay) {
    setShowHostelBooking(true);
    return;
  }
  
  // Otherwise submit directly
  await submitPass();
};

const submitPass = async () => {
  setLoading(true);
  // ... existing submit logic ...
};
```

**G. Update Form JSX - Entry Time Field (Line ~420)**
```typescript
{/* Entry Time - Single Field */}
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    Entry Time <span className="text-red-500">*</span>
  </label>
  <div className="relative">
    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
    <input
      type="time"
      name="entryTime"  // CHANGE
      value={formData.entryTime}  // CHANGE
      onChange={handleChange}
      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg..."
      required
    />
  </div>
  <p className="text-xs text-gray-500 mt-1">
    QR code will activate 3 hours before this time
  </p>
</div>

{/* REMOVE: Exit Time field entirely */}
{/* REMOVE: Duration calculation */}
```

**H. Update Vehicle Section - Add Model Field (Line ~500)**
```typescript
{formData.hasVehicle && (
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Vehicle Type <span className="text-red-500">*</span>
      </label>
      <select name="vehicleType" value={formData.vehicleType} ...>
        {/* ... existing options ... */}
      </select>
    </div>
    
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Vehicle Number <span className="text-red-500">*</span>
      </label>
      <input type="text" name="vehicleNumber" ... />
    </div>
    
    {/* ADD: Vehicle Model Field */}
    <div className="md:col-span-2">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Vehicle Model <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        name="vehicleModel"
        value={formData.vehicleModel}
        onChange={handleChange}
        placeholder="e.g., Honda City, Yamaha R15"
        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg..."
        required
      />
    </div>
  </div>
)}
```

**I. Update Visitor Relation Field (Line ~250)**
```typescript
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
    Visitor Relation
    {isStudentLocked && (
      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        🔒 Student - Parent Only
      </span>
    )}
  </label>
  <input
    type="text"
    name="visitorRelation"
    value={formData.visitorRelation}
    onChange={handleChange}
    placeholder={isStudentLocked ? "Parent (Auto-filled)" : "e.g., Friend, Relative"}
    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg..."
    readOnly={isStudentLocked}
  />
</div>
```

**J. Add Hostel Booking Modal (At end of component)**
```typescript
return (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    {/* ... existing form ... */}
    
    {/* Hostel Booking Modal */}
    {showHostelBooking && (
      <HostelBookingFlow
        passId="" // Will be set after pass creation
        checkInDate={formData.visitDate}
        checkOutDate={formData.visitEndDate}
        guestCount={formData.numberOfPersons}
        onClose={() => setShowHostelBooking(false)}
        onSuccess={(bookingId) => {
          setFormData(prev => ({ ...prev, hostelBookingId: bookingId || '' }));
          setShowHostelBooking(false);
          submitPass();
        }}
      />
    )}
  </div>
);
```

---

### 2. All Passes Page (`frontend/src/app/admin/gate-entry/page.tsx`)

#### Changes Needed:

**A. Import Components**
```typescript
import ExtendPassModal from './components/ExtendPassModal';
```

**B. Add Color-Coded Status Badges (Line ~400)**
```typescript
const getStatusBadge = (pass: any) => {
  const statusColors = {
    created: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Created' },
    checked_in: { bg: 'bg-green-100', text: 'text-green-800', label: 'Checked In' },
    cancelled: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Cancelled' },
    checked_out: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Checked Out' },
    expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired' },
  };
  
  const status = pass.passStatus || pass.status;
  const config = statusColors[status] || statusColors.created;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

// Replace all existing status badges with:
{getStatusBadge(pass)}
```

**C. Add QR Status Badge (Next to pass status)**
```typescript
const getQRStatusBadge = (qrStatus: string) => {
  const colors = {
    inactive: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    expired: 'bg-orange-100 text-orange-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${colors[qrStatus] || colors.inactive}`}>
      QR: {qrStatus}
    </span>
  );
};
```

**D. Add Extend Pass Modal State**
```typescript
const [showExtendModal, setShowExtendModal] = useState(false);
const [selectedPassForExtend, setSelectedPassForExtend] = useState<any>(null);
```

**E. Add Extend Button in Pass Detail Modal**
```typescript
{/* In pass detail modal */}
{(selectedPass.passStatus === 'created' || selectedPass.passStatus === 'checked_in') && (
  <button
    onClick={() => {
      setSelectedPassForExtend(selectedPass);
      setShowExtendModal(true);
    }}
    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
  >
    Extend Pass
  </button>
)}
```

**F. Show Checkout QR After Cancellation**
```typescript
{selectedPass.checkoutQrCode && (
  <div className="mt-4 border-2 border-orange-300 rounded-lg p-4">
    <h4 className="font-semibold text-orange-800 mb-2">Checkout QR Code</h4>
    <img src={selectedPass.checkoutQrCode} alt="Checkout QR" className="w-48 h-48 mx-auto" />
    <p className="text-sm text-center text-gray-600 mt-2">
      Expires: {new Date(selectedPass.checkoutQrExpiresAt).toLocaleString()}
    </p>
    <p className="text-xs text-center text-orange-600 mt-1">
      Valid for 1 hour only
    </p>
  </div>
)}
```

**G. Add Modal at End**
```typescript
{showExtendModal && selectedPassForExtend && (
  <ExtendPassModal
    passId={selectedPassForExtend.passId}
    currentEntryTime={selectedPassForExtend.entryTime ||  selectedPassForExtend.expectedEntryTime}
    currentVisitDate={selectedPassForExtend.visitDate}
    onClose={() => {
      setShowExtendModal(false);
      setSelectedPassForExtend(null);
    }}
    onSuccess={() => {
      fetchPasses();
      setShowExtendModal(false);
    }}
  />
)}
```

---

### 3. Verify Pass Page (`frontend/src/app/admin/gate-entry/verify/page.tsx`)

#### Changes Needed:

**A. Show QR Status in Search Results (Line ~600)**
```typescript
{verifiedPass && (
  <div className="pass-details">
    {/* ... existing fields ... */}
    
    {/* Add QR Status */}
    <div className="flex items-center justify-between py-2 border-b">
      <span className="text-gray-600">QR Status:</span>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        verifiedPass.qrStatus === 'active' ? 'bg-green-100 text-green-800' :
        verifiedPass.qrStatus === 'inactive' ? 'bg-gray-100 text-gray-700' :
        'bgred-100 text-red-800'
      }`}>
        {verifiedPass.qrStatus}
      </span>
    </div>
    
    {/* Show activation message if inactive */}
    {verifiedPass.qrStatus === 'inactive' && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
        <p className="text-sm text-yellow-800">
          ⏰ QR code will activate 3 hours before entry time ({verifiedPass.entryTime})
        </p>
      </div>
    )}
  </div>
)}
```

**B. Update Allow Entry Validation (Line ~700)**
```typescript
const handleAllowEntry = async () => {
  // Check QR status first
  if (verifiedPass.qrStatus !== 'active') {
    showToast('QR code is not active yet. It activates 3 hours before entry time.', 'error');
    return;
  }
  
  // ... rest of existing logic ...
};
```

**C. Add Checkout Flow for Cancelled Passes (Line ~800)**
```typescript
{verifiedPass.passStatus === 'cancelled' && verifiedPass.checkoutQrCode && (
  <div className="mt-6 border-2 border-orange-300 rounded-lg p-4">
    <h3 className="font-semibold text-orange-800 mb-3">Checkout Process</h3>
    <p className="text-sm text-gray-600 mb-3">
      This pass has been cancelled. Scan the checkout QR code to complete exit.
    </p>
    
    <img 
      src={verifiedPass.checkoutQrCode} 
      alt="Checkout QR" 
      className="w-40 h-40 mx-auto border-2 border-orange-300 rounded"
    />
    
    <div className="mt-3 text-center">
      <p className="text-xs text-gray-600">
        Expires: {new Date(verifiedPass.checkoutQrExpiresAt).toLocaleString()}
      </p>
    </div>
    
    <button
      onClick={handleCheckout}
      className="w-full mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
    >
      Complete Checkout
    </button>
  </div>
)}
```

**D. Add Checkout Handler**
```typescript
const handleCheckout = async () => {
  try {
    setLoading(true);
    const response = await gateEntryService.recordCheckout(
      verifiedPass.passId,
      { gate: selectedGate, remarks: exitRemarks }
    );
    
    if (response.success) {
      showToast('Checkout recorded successfully', 'success');
      setVerifiedPass(null);
      setSearchTerm('');
    }
  } catch (error: any) {
    showToast(error.response?.data?.message || 'Failed to record checkout', 'error');
  } finally {
    setLoading(false);
  }
};
```

---

## 🏃 Quick Start After Frontend Updates

1. **Run migrations** (if not done already):
   ```bash
   cd backend
   npx prisma migrate dev --name gate_entry_enhancements
   ```

2. **Seed hostels** (optional):
   ```bash
   node prisma/seeds/seed-hostels.js
   ```

3. **Start backend**:
   ```bash
   npm run dev
   ```

4. **Start frontend**:
   ```bash
   cd ../frontend
   npm run dev
   ```

5. **Test the flow**:
   - Create a pass as student (should lock to Parent)
   - Create a multi-day pass (should show hostel booking)
   - Extend a pass (QR regenerates)
   - Cancel a pass (generates checkout QR with 1-hour expiry)
   - Verify QR status (inactive until 3 hours before)

---

## 📋 Testing Checklist

- [ ] Student can only create passes for parents
- [ ] Entry time field works (no exit time)
- [ ] Vehicle model is required when vehicle selected
- [ ] Multi-day pass shows hostel booking flow
- [ ] Hostel selection shows available rooms
- [ ] Payment QR displays correctly
- [ ] Pass status colors: Blue→Green→Orange→Grey→Red
- [ ] QR status shows: inactive→active→cancelled/expired
- [ ] QR activates 3 hours before entry time
- [ ] Extend pass regenerates QR
- [ ] Cancel generates 1-hour checkout QR
- [ ] Guard cannot check-in if QR inactive
- [ ] Checkout QR expires after 1 hour

---

**Implementation Priority:**
1. Update create-pass form (critical for basic functionality)
2. Update all-passes page (for status visualization)
3. Update verify page (for guard operations)
