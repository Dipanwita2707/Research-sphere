# Verify Pass Page - Complete Translation Changelist

## Overview
This document contains ALL translation keys and code changes needed for complete i18n of the verify pass page (`verify/page.tsx` - 1949 lines).

---

## Translation Keys to Add to LanguageContext.tsx

### 1. Search & Input Labels (Lines 819-843)
```typescript
// English
'verifyPass.searchOptions.passId': 'Pass ID',
'verifyPass.searchOptions.visitorName': 'Visitor Name',
'verifyPass.searchOptions.mobile': 'Mobile Number',
'verifyPass.searchOptions.vehicle': 'Vehicle Number',
'verifyPass.enterVisitorName': 'Enter Visitor Name',
'verifyPass.enterMobile': 'Enter Mobile Number',
'verifyPass.enterVehicle': 'Enter Vehicle Number',
'verifyPass.placeholderName': 'Name',
'verifyPass.placeholderMobile': 'Mobile',
'verifyPass.placeholderVehicle': 'Vehicle No.',

// Hindi
'verifyPass.searchOptions.passId': 'पास आईडी',
'verifyPass.searchOptions.visitorName': 'मिलने वाले का नाम',
'verifyPass.searchOptions.mobile': 'मोबाइल नंबर',
'verifyPass.searchOptions.vehicle': 'गाड़ी नंबर',
'verifyPass.enterVisitorName': 'मिलने वाले का नाम दर्ज करें',
'verifyPass.enterMobile': 'मोबाइल नंबर दर्ज करें',
'verifyPass.enterVehicle': 'गाड़ी नंबर दर्ज करें',
'verifyPass.placeholderName': 'नाम',
'verifyPass.placeholderMobile': 'मोबाइल',
'verifyPass.placeholderVehicle': 'गाड़ी नं.',

// Haryanvi
'verifyPass.searchOptions.passId': 'पास आईडी',
'verifyPass.searchOptions.visitorName': 'मिलण आळे का नाम',
'verifyPass.searchOptions.mobile': 'मोबाइल नंबर',
'verifyPass.searchOptions.vehicle': 'गाड्डी नंबर',
'verifyPass.enterVisitorName': 'मिलण आळे का नाम भरो',
'verifyPass.enterMobile': 'मोबाइल नंबर भरो',
'verifyPass.enterVehicle': 'गाड्डी नंबर भरो',
'verifyPass.placeholderName': 'नाम',
'verifyPass.placeholderMobile': 'मोबाइल',
'verifyPass.placeholderVehicle': 'गाड्डी नं.',
```

### 2. Error Messages (Lines 171, 208, 282, 292, 308, 382)
```typescript
// English
'verifyPass.err.checkoutQrNotFound': 'Pass not found for checkout QR',
'verifyPass.err.passNotFound': 'Pass not found',
'verifyPass.err.invalidQR': 'Invalid QR Code or Pass not found',
'verifyPass.err.searchTermRequired': 'Please enter a search term',
'verifyPass.err.noPassFound': 'No pass found matching your search criteria',
'verifyPass.err.verificationFailed': 'Verification Failed',

// Hindi
'verifyPass.err.checkoutQrNotFound': 'चेकआउट QR के लिए पास नहीं मिला',
'verifyPass.err.passNotFound': 'पास नहीं मिला',
'verifyPass.err.invalidQR': 'अमान्य QR कोड या पास नहीं मिला',
'verifyPass.err.searchTermRequired': 'कृपया खोज शब्द दर्ज करें',
'verifyPass.err.noPassFound': 'आपके खोज मानदंड से मेल खाने वाला कोई पास नहीं मिला',
'verifyPass.err.verificationFailed': 'सत्यापन विफल',

// Haryanvi
'verifyPass.err.checkoutQrNotFound': 'चेकआउट QR खातर पास न्ही मिल्या',
'verifyPass.err.passNotFound': 'पास न्ही मिल्या',
'verifyPass.err.invalidQR': 'गलत QR कोड या पास न्ही मिल्या',
'verifyPass.err.searchTermRequired': 'खोज शब्द भरो',
'verifyPass.err.noPassFound': 'थारी खोज तै मेल खावै पास न्ही मिल्या',
'verifyPass.err.verificationFailed': 'जाँच होण म्हु गलती',
```

### 3. Status Labels (Lines 707-715) - Translation Function Needed
```typescript
// English
'status.created': 'Created',
'status.pending': 'Pending',
'status.active': 'Active',
'status.checkedIn': 'Checked In',
'status.completed': 'Completed',
'status.checkedOut': 'Checked Out',
'status.cancelled': 'Cancelled',
'status.expired': 'Expired',
'status.denied': 'Denied',

// Hindi
'status.created': 'बनाया गया',
'status.pending': 'लंबित',
'status.active': 'सक्रिय',
'status.checkedIn': 'प्रवेश किया',
'status.completed': 'पूर्ण',
'status.checkedOut': 'निकास किया',
'status.cancelled': 'रद्द',
'status.expired': 'समाप्त',
'status.denied': 'अस्वीकृत',

// Haryanvi
'status.created': 'बणाया',
'status.pending': 'बाकी',
'status.active': 'सक्रिय',
'status.checkedIn': 'अंदर आण दिया',
'status.completed': 'पूरा',
'status.checkedOut': 'बाहर निकाळ दिया',
'status.cancelled': 'रद्द',
'status.expired': 'खत्म',
'status.denied': 'मना',
```

### 4. Toast Notifications
```typescript
// Check-in (Lines 454, 456)
'verifyPass.toast.checkinSuccess': 'Visitor has been checked in successfully!',
'verifyPass.toast.checkinSuccessTitle': 'Entry Allowed',
'verifyPass.toast.checkinFailed': 'Failed to allow entry',

// Verification (Lines 464, 469)
'verifyPass.toast.codeRequired': 'Please enter the verification code',
'verifyPass.toast.codeRequiredTitle': 'Verification Required',
'verifyPass.toast.invalidCode': 'Invalid verification code. Please try again.',
'verifyPass.toast.invalidCodeTitle': 'Verification Failed',

// Deny Entry (Lines 489, 491)
'verifyPass.toast.entryDenied': 'Pass has been marked as denied',
'verifyPass.toast.entryDeniedTitle': 'Entry Denied',
'verifyPass.toast.denyFailed': 'Failed to deny entry',

// Checkout/Exit (Lines 525, 527, 593, 595, 627, 629)
'verifyPass.toast.exitSuccess': 'Visitor has been checked out successfully!',
'verifyPass.toast.exitSuccessTitle': 'Exit Recorded',
'verifyPass.toast.exitFailed': 'Failed to record exit',
'verifyPass.toast.checkoutSuccessTitle': 'Checkout Recorded',
'verifyPass.toast.checkoutFailed': 'Failed to record checkout',

// Checkout Verification (Lines 637, 643)
'verifyPass.toast.checkoutCodeInvalid': 'Invalid checkout verification code. Please use the NEW code sent after cancellation.',

// Cancel Pass (Lines 654, 681, 684)
'verifyPass.toast.reasonRequired': 'Please enter cancellation reason',
'verifyPass.toast.reasonRequiredTitle': 'Reason Required',
'verifyPass.toast.cancelSuccess': 'Pass cancelled successfully. Checkout credentials generated!',
'verifyPass.toast.cancelSuccessTitle': 'Pass Cancelled',
'verifyPass.toast.cancelFailed': 'Failed to cancel pass',

// Copy Actions (Lines 1855, 1876)
'verifyPass.toast.idCopied': 'Checkout ID copied!',
'verifyPass.toast.codeCopied': 'Checkout code copied!',
'verifyPass.toast.copied': 'Copied',

// Cancelled Pass Warning (Line 183, 319)
'verifyPass.toast.cancelledPassWarning': '⚠️ CANCELLED PASS - Checkout Required',

// Hindi translations
'verifyPass.toast.checkinSuccess': 'आगंतुक को सफलतापूर्वक प्रवेश दिया गया!',
'verifyPass.toast.checkinSuccessTitle': 'प्रवेश अनुमत',
'verifyPass.toast.checkinFailed': 'प्रवेश की अनुमति देने में विफल',
'verifyPass.toast.codeRequired': 'कृपया सत्यापन कोड दर्ज करें',
'verifyPass.toast.codeRequiredTitle': 'सत्यापन आवश्यक',
'verifyPass.toast.invalidCode': 'अमान्य सत्यापन कोड। कृपया पुनः प्रयास करें।',
'verifyPass.toast.invalidCodeTitle': 'सत्यापन विफल',
'verifyPass.toast.entryDenied': 'पास को अस्वीकृत के रूप में चिह्नित किया गया',
'verifyPass.toast.entryDeniedTitle': 'प्रवेश अस्वीकृत',
'verifyPass.toast.denyFailed': 'प्रवेश अस्वीकार करने में विफल',
'verifyPass.toast.exitSuccess': 'आगंतुक का निकास सफलतापूर्वक दर्ज किया गया!',
'verifyPass.toast.exitSuccessTitle': 'निकास दर्ज',
'verifyPass.toast.exitFailed': 'निकास दर्ज करने में विफल',
'verifyPass.toast.checkoutSuccessTitle': 'चेकआउट दर्ज',
'verifyPass.toast.checkoutFailed': 'चेकआउट दर्ज करने में विफल',
'verifyPass.toast.checkoutCodeInvalid': 'अमान्य चेकआउट कोड। रद्द करने के बाद भेजा गया नया कोड उपयोग करें।',
'verifyPass.toast.reasonRequired': 'कृपया रद्द करने का कारण दर्ज करें',
'verifyPass.toast.reasonRequiredTitle': 'कारण आवश्यक',
'verifyPass.toast.cancelSuccess': 'पास सफलतापूर्वक रद्द किया! चेकआउट क्रेडेंशियल बनाए गए!',
'verifyPass.toast.cancelSuccessTitle': 'पास रद्द',
'verifyPass.toast.cancelFailed': 'पास रद्द करने में विफल',
'verifyPass.toast.idCopied': 'चेकआउट आईडी कॉपी की गई!',
'verifyPass.toast.codeCopied': 'चेकआउट कोड कॉपी किया गया!',
'verifyPass.toast.copied': 'कॉपी किया',
'verifyPass.toast.cancelledPassWarning': '⚠️ रद्द पास - चेकआउट आवश्यक',

// Haryanvi translations
'verifyPass.toast.checkinSuccess': 'मिलण आळे नै अंदर आणा दिया!',
'verifyPass.toast.checkinSuccessTitle': 'अंदर आण दिया',
'verifyPass.toast.checkinFailed': 'अंदर आणा देण म्हु गलती',
'verifyPass.toast.codeRequired': 'कोड भरो',
'verifyPass.toast.codeRequiredTitle': 'जाँच चाहिए',
'verifyPass.toast.invalidCode': 'गलत कोड सै। दुबारा भरो।',
'verifyPass.toast.invalidCodeTitle': 'जाँच म्हु गलती',
'verifyPass.toast.entryDenied': 'पास नै मना कर दिया',
'verifyPass.toast.entryDeniedTitle': 'अंदर आणा मना',
'verifyPass.toast.denyFailed': 'मना करण म्हु गलती',
'verifyPass.toast.exitSuccess': 'मिलण आळे नै बाहर निकाळ दिया!',
'verifyPass.toast.exitSuccessTitle': 'बाहर निकाळ दिया',
'verifyPass.toast.exitFailed': 'बाहर निकाळण म्हु गलती',
'verifyPass.toast.checkoutSuccessTitle': 'चेकआउट दर्ज',
'verifyPass.toast.checkoutFailed': 'चेकआउट दर्ज करण म्हु गलती',
'verifyPass.toast.checkoutCodeInvalid': 'गलत चेकआउट कोड। रद्द करण के बाद मिला नया कोड लगाओ।',
'verifyPass.toast.reasonRequired': 'रद्द करण की वजह भरो',
'verifyPass.toast.reasonRequiredTitle': 'वजह चाहिए',
'verifyPass.toast.cancelSuccess': 'पास रद्द कर दिया! चेकआउट की चीज बणा दी!',
'verifyPass.toast.cancelSuccessTitle': 'पास रद्द',
'verifyPass.toast.cancelFailed': 'पास रद्द करण म्हु गलती',
'verifyPass.toast.idCopied': 'चेकआउट आईडी कॉपी होगी!',
'verifyPass.toast.codeCopied': 'चेकआउट कोड कॉपी होग्या!',
'verifyPass.toast.copied': 'कॉपी होग्या',
'verifyPass.toast.cancelledPassWarning': '⚠️ रद्द पास - चेकआउट चाहिए',
```

### 5. QR Scanner Instructions (Lines 900-925)
```typescript
// English
'verifyPass.qr.initializing': 'Initializing camera scanner...',
'verifyPass.qr.instructions': 'Scanning Instructions:',
'verifyPass.qr.step1': 'Camera selection dropdown will appear above - select your camera',
'verifyPass.qr.step2': 'Click the "Start Scanning" button to open camera',
'verifyPass.qr.step3': 'Hold visitor\'s gate pass QR code in front of camera',
'verifyPass.qr.tip1': 'Ensure good lighting and steady hand for faster detection',
'verifyPass.qr.tip2': 'Scanner will automatically verify pass after successful scan',
'verifyPass.qr.tip3': 'Allow camera permission when browser prompts',
'verifyPass.qr.tip4': 'Switch to Manual Search tab if QR code is not readable',

// Hindi
'verifyPass.qr.initializing': 'कैमरा स्कैनर शुरू हो रहा है...',
'verifyPass.qr.instructions': 'स्कैनिंग निर्देश:',
'verifyPass.qr.step1': 'ऊपर कैमरा चयन ड्रॉपडाउन दिखाई देगा - अपना कैमरा चुनें',
'verifyPass.qr.step2': 'कैमरा खोलने के लिए "स्कैनिंग शुरू करें" बटन पर क्लिक करें',
'verifyPass.qr.step3': 'आगंतुक का गेट पास QR कोड कैमरे के सामने रखें',
'verifyPass.qr.tip1': 'तेज़ पहचान के लिए अच्छी रोशनी और स्थिर हाथ सुनिश्चित करें',
'verifyPass.qr.tip2': 'सफल स्कैन के बाद स्कैनर स्वचालित रूप से पास सत्यापित करेगा',
'verifyPass.qr.tip3': 'ब्राउज़र द्वारा संकेत दिए जाने पर कैमरा अनुमति दें',
'verifyPass.qr.tip4': 'यदि QR कोड पठनीय नहीं है तो मैन्युअल खोज टैब पर स्विच करें',

// Haryanvi
'verifyPass.qr.initializing': 'कैमरा स्कैनर चालू होरा सै...',
'verifyPass.qr.instructions': 'स्कैनिंग के तरीके:',
'verifyPass.qr.step1': 'ऊपर कैमरा चुनण का ड्रॉपडाउन आवैगा - अपणा कैमरा चुनो',
'verifyPass.qr.step2': 'कैमरा खोलण खातर "स्कैनिंग शुरू करो" बटन दबाओ',
'verifyPass.qr.step3': 'मिलण आळे का गेट पास QR कोड कैमरे के सामणै लाओ',
'verifyPass.qr.tip1': 'जल्दी पहचानण खातर बढ़िया लाइट अर हाथ ठीक राखो',
'verifyPass.qr.tip2': 'स्कैन होण के बाद पास अपणै आप जाँच होग्या',
'verifyPass.qr.tip3': 'ब्राउज़र पूछै त्यु कैमरा की permission दे देओ',
'verifyPass.qr.tip4': 'QR कोड साफ न्ही दिखै त्यु मैन्युअल खोज tab खोलो',
```

### 6. Pass Details Section Headers (Lines 1063-1200)
```typescript
// English
'verifyPass.details.visitorInfo': 'Visitor Information',
'verifyPass.details.visitInfo': 'Visit Information',
'verifyPass.details.vehicleInfo': 'Vehicle Information',
'verifyPass.details.additionalInfo': 'Additional Information',
'verifyPass.details.entryExitRecords': 'Entry/Exit Records',
'verifyPass.details.guardActions': 'Guard Actions',

'verifyPass.fields.name': 'Name',
'verifyPass.fields.mobile': 'Mobile',
'verifyPass.fields.email': 'Email',
'verifyPass.fields.idProof': 'ID Proof',
'verifyPass.fields.genderAge': 'Gender / Age',
'verifyPass.fields.years': 'years',
'verifyPass.fields.persons': 'Number of Persons',
'verifyPass.fields.purpose': 'Purpose',
'verifyPass.fields.department': 'Department',
'verifyPass.fields.personToMeet': 'Person to Meet',
'verifyPass.fields.visitDate': 'Visit Date',
'verifyPass.fields.entryTime': 'Entry Time',
'verifyPass.fields.qrActivatesAt': 'QR Activates At',
'verifyPass.fields.vehicleNumber': 'Vehicle Number',
'verifyPass.fields.vehicleType': 'Vehicle Type',
'verifyPass.fields.vehicleModel': 'Vehicle Model',
'verifyPass.fields.itemsCarrying': 'Items Carrying',
'verifyPass.fields.specialInstructions': 'Special Instructions',
'verifyPass.fields.actualEntryTime': 'Actual Entry Time',
'verifyPass.fields.actualExitTime': 'Actual Exit Time',

// Hindi
'verifyPass.details.visitorInfo': 'आगंतुक जानकारी',
'verifyPass.details.visitInfo': 'मुलाकात जानकारी',
'verifyPass.details.vehicleInfo': 'वाहन जानकारी',
'verifyPass.details.additionalInfo': 'अतिरिक्त जानकारी',
'verifyPass.details.entryExitRecords': 'प्रवेश/निकास रिकॉर्ड',
'verifyPass.details.guardActions': 'गार्ड कार्रवाई',

'verifyPass.fields.name': 'नाम',
'verifyPass.fields.mobile': 'मोबाइल',
'verifyPass.fields.email': 'ईमेल',
'verifyPass.fields.idProof': 'आईडी प्रमाण',
'verifyPass.fields.genderAge': 'लिंग / आयु',
'verifyPass.fields.years': 'वर्ष',
'verifyPass.fields.persons': 'व्यक्तियों की संख्या',
'verifyPass.fields.purpose': 'उद्देश्य',
'verifyPass.fields.department': 'विभाग',
'verifyPass.fields.personToMeet': 'मिलने वाला व्यक्ति',
'verifyPass.fields.visitDate': 'मुलाकात तिथि',
'verifyPass.fields.entryTime': 'प्रवेश समय',
'verifyPass.fields.qrActivatesAt': 'QR सक्रिय होगा',
'verifyPass.fields.vehicleNumber': 'वाहन नंबर',
'verifyPass.fields.vehicleType': 'वाहन प्रकार',
'verifyPass.fields.vehicleModel': 'वाहन मॉडल',
'verifyPass.fields.itemsCarrying': 'सामान ले जा रहे हैं',
'verifyPass.fields.specialInstructions': 'विशेष निर्देश',
'verifyPass.fields.actualEntryTime': 'वास्तविक प्रवेश समय',
'verifyPass.fields.actualExitTime': 'वास्तविक निकास समय',

// Haryanvi
'verifyPass.details.visitorInfo': 'मिलण आळे की जानकारी',
'verifyPass.details.visitInfo': 'मिलण की जानकारी',
'verifyPass.details.vehicleInfo': 'गाड्डी की जानकारी',
'verifyPass.details.additionalInfo': 'और जानकारी',
'verifyPass.details.entryExitRecords': 'अंदर/बाहर के रिकॉर्ड',
'verifyPass.details.guardActions': 'गार्ड के काम',

'verifyPass.fields.name': 'नाम',
'verifyPass.fields.mobile': 'मोबाइल',
'verifyPass.fields.email': 'ईमेल',
'verifyPass.fields.idProof': 'आईडी प्रमाण',
'verifyPass.fields.genderAge': 'लिंग / उम्र',
'verifyPass.fields.years': 'साल',
'verifyPass.fields.persons': 'आदमियाँ की गिणती',
'verifyPass.fields.purpose': 'कारण',
'verifyPass.fields.department': 'विभाग',
'verifyPass.fields.personToMeet': 'किसतै मिलणा सै',
'verifyPass.fields.visitDate': 'मिलण की तारीख',
'verifyPass.fields.entryTime': 'अंदर आणा समय',
'verifyPass.fields.qrActivatesAt': 'QR चालू होगा',
'verifyPass.fields.vehicleNumber': 'गाड्डी नंबर',
'verifyPass.fields.vehicleType': 'गाड्डी किसम',
'verifyPass.fields.vehicleModel': 'गाड्डी मॉडल',
'verifyPass.fields.itemsCarrying': 'सामान',
'verifyPass.fields.specialInstructions': 'खास बात',
'verifyPass.fields.actualEntryTime': 'असल अंदर आणा समय',
'verifyPass.fields.actualExitTime': 'असल बाहर निकाळण समय',
```

### 7. Warnings & Notices (Lines 1000-1100)
```typescript
// English
'verifyPass.warnings.expiringSoon': '⏰ EXPIRING SOON!',
'verifyPass.warnings.lessThan15': '⚠️ Less than 15 min',
'verifyPass.warnings.valid': '✅ Valid',
'verifyPass.warnings.expired': 'EXPIRED',
'verifyPass.warnings.remaining': 'Remaining',
'verifyPass.warnings.cancelledAt': 'Cancelled At:',
'verifyPass.warnings.qrNotActive': '⏰ QR Code Not Yet Active',
'verifyPass.warnings.qrNotActiveMsg': 'This QR code will activate 5 hours before entry time',
'verifyPass.warnings.activationTime': 'Activation Time:',
'verifyPass.warnings.qrActive': '✅ Pass Verified - QR Active',
'verifyPass.warnings.qrActiveMsg': 'QR code is active. Please verify visitor ID proof and details below before allowing entry.',
'verifyPass.warnings.checkoutRequired': '⚠️ CHECKOUT - CANCELLED PASS',
'verifyPass.warnings.checkoutMsg': 'This pass has been cancelled. A 1-hour checkout QR code was issued to the visitor.',
'verifyPass.warnings.checkoutNote': 'Verify visitor identity and allow exit using the "Record Checkout" button below.',
'verifyPass.warnings.qrValidity': 'Checkout QR Validity',

// Hindi
'verifyPass.warnings.expiringSoon': '⏰ जल्द समाप्त होगा!',
'verifyPass.warnings.lessThan15': '⚠️ 15 मिनट से कम',
'verifyPass.warnings.valid': '✅ मान्य',
'verifyPass.warnings.expired': 'समाप्त',
'verifyPass.warnings.remaining': 'शेष',
'verifyPass.warnings.cancelledAt': 'रद्द किया:',
'verifyPass.warnings.qrNotActive': '⏰ QR कोड अभी सक्रिय नहीं',
'verifyPass.warnings.qrNotActiveMsg': 'यह QR कोड प्रवेश समय से 5 घंटे पहले सक्रिय होगा',
'verifyPass.warnings.activationTime': 'सक्रियण समय:',
'verifyPass.warnings.qrActive': '✅ पास सत्यापित - QR सक्रिय',
'verifyPass.warnings.qrActiveMsg': 'QR कोड सक्रिय है। प्रवेश की अनुमति देने से पहले आगंतुक का आईडी प्रमाण और विवरण सत्यापित करें।',
'verifyPass.warnings.checkoutRequired': '⚠️ चेकआउट - रद्द पास',
'verifyPass.warnings.checkoutMsg': 'यह पास रद्द कर दिया गया है। आगंतुक को 1 घंटे का चेकआउट QR कोड जारी किया गया था।',
'verifyPass.warnings.checkoutNote': 'आगंतुक की पहचान सत्यापित करें और नीचे "चेकआउट रिकॉर्ड करें" बटन का उपयोग करके निकास की अनुमति दें।',
'verifyPass.warnings.qrValidity': 'चेकआउट QR मान्यता',

// Haryanvi
'verifyPass.warnings.expiringSoon': '⏰ जल्दी खत्म होवैगा!',
'verifyPass.warnings.lessThan15': '⚠️ 15 मिनट तै कम',
'verifyPass.warnings.valid': '✅ सही',
'verifyPass.warnings.expired': 'खत्म',
'verifyPass.warnings.remaining': 'बाकी',
'verifyPass.warnings.cancelledAt': 'रद्द करया:',
'verifyPass.warnings.qrNotActive': '⏰ QR कोड अभी चालू न्ही',
'verifyPass.warnings.qrNotActiveMsg': 'यो QR कोड अंदर आणा समय तै 5 घंटे पैहल्या चालू होगा',
'verifyPass.warnings.activationTime': 'चालू होण का समय:',
'verifyPass.warnings.qrActive': '✅ पास जाँच होग्या - QR चालू सै',
'verifyPass.warnings.qrActiveMsg': 'QR कोड चालू सै। अंदर आणा देण तै पहल्या मिलण आळे की आईडी अर चीजां जाँच लो।',
'verifyPass.warnings.checkoutRequired': '⚠️ चेकआउट - रद्द पास',
'verifyPass.warnings.checkoutMsg': 'यो पास रद्द होग्या सै। मिलण आळे नै 1 घंटे का चेकआउट QR कोड दिया गया था।',
'verifyPass.warnings.checkoutNote': 'मिलण आळे की पहचान जाँचो अर नीच्या "चेकआउट रिकॉर्ड करो" बटन तै बाहर निकाळण दो।',
'verifyPass.warnings.qrValidity': 'चेकआउट QR मान्यता',
```

### 8. Button Labels & Action Text (Lines 1218-1275)
```typescript
// English
'verifyPass.actions.processing': 'Processing...',
'verifyPass.actions.recordCheckout': '🚨 Record Checkout',
'verifyPass.actions.qrExpired': '❌ Checkout QR Expired - Contact Admin to Regenerate',
'verifyPass.actions.allowEntry': 'Allow Entry',
'verifyPass.actions.qrWillActivate': '⏰ QR will activate 5 hours before entry time',
'verifyPass.actions.recordExit': 'Record Exit',
'verifyPass.actions.denyEntry': 'Deny Entry',
'verifyPass.actions.alreadyCompleted': '✅ Pass Already Completed',
'verifyPass.actions.passExpired': '⏰ Pass Expired',
'verifyPass.actions.passRejected': '❌ Pass Rejected',
'verifyPass.actions.noActions': 'ℹ️ No Actions Available',

// Hindi
'verifyPass.actions.processing': 'प्रक्रिया में...',
'verifyPass.actions.recordCheckout': '🚨 चेकआउट रिकॉर्ड करें',
'verifyPass.actions.qrExpired': '❌ चेकआउट QR समाप्त - पुनः उत्पन्न के लिए व्यवस्थापक से संपर्क करें',
'verifyPass.actions.allowEntry': 'प्रवेश की अनुमति दें',
'verifyPass.actions.qrWillActivate': '⏰ QR प्रवेश समय से 5 घंटे पहले सक्रिय होगा',
'verifyPass.actions.recordExit': 'निकास रिकॉर्ड करें',
'verifyPass.actions.denyEntry': 'प्रवेश अस्वीकार करें',
'verifyPass.actions.alreadyCompleted': '✅ पास पहले ही पूर्ण हो चुका',
'verifyPass.actions.passExpired': '⏰ पास समाप्त',
'verifyPass.actions.passRejected': '❌ पास अस्वीकृत',
'verifyPass.actions.noActions': 'ℹ️ कोई कार्रवाई उपलब्ध नहीं',

// Haryanvi
'verifyPass.actions.processing': 'प्रोसेस होरा सै...',
'verifyPass.actions.recordCheckout': '🚨 चेकआउट दर्ज करो',
'verifyPass.actions.qrExpired': '❌ चेकआउट QR खत्म - दुबारा बणाण खातर एडमिन तै बात करो',
'verifyPass.actions.allowEntry': 'अंदर आणा दो',
'verifyPass.actions.qrWillActivate': '⏰ QR अंदर आणा समय तै 5 घंटे पहल्या चालू होगा',
'verifyPass.actions.recordExit': 'बाहर निकाळण दर्ज करो',
'verifyPass.actions.denyEntry': 'अंदर आणा मना करो',
'verifyPass.actions.alreadyCompleted': '✅ पास पैहल्या ए पूरा होग्या',
'verifyPass.actions.passExpired': '⏰ पास खत्म',
'verifyPass.actions.passRejected': '❌ पास मना',
'verifyPass.actions.noActions': 'ℹ️ कोए काम न्ही सै',
```

### 9. Modal Content - Verification Modal (Lines 1321-1500)
```typescript
// English
'verifyPass.modal.verifyIdentity': '🔐 Verify Visitor Identity',
'verifyPass.modal.chooseMethod': 'Choose verification method',
'verifyPass.modal.identityRequired': 'Visitor Identity Verification Required',
'verifyPass.modal.identityMsg': 'Before allowing entry, verify the visitor\'s identity using one of the methods below.',
'verifyPass.modal.scanQR': 'Scan QR Code',
'verifyPass.modal.scanQRMsg': 'Ask visitor to show QR code from their gate pass',
'verifyPass.modal.openCamera': 'Open Camera',
'verifyPass.modal.enterCode': 'Enter Code',
'verifyPass.modal.enterCodeMsg': 'Ask visitor for their 6-digit verification code',
'verifyPass.modal.backToOptions': '← Back to options',
'verifyPass.modal.scanVisitorQR': 'Scan Visitor\'s QR Code',
'verifyPass.modal.positionQR': 'Ask the visitor to show their gate pass QR code. Position it within the camera frame.',
'verifyPass.modal.verifyingEntry': 'Verifying and allowing entry...',
'verifyPass.modal.enter6Digit': 'Enter 6-Digit Verification Code',
'verifyPass.modal.ask6Digit': 'Ask the visitor to provide the 6-digit code they received with their gate pass.',
'verifyPass.modal.verificationCode': 'Verification Code',
'verifyPass.modal.enter6DigitPlaceholder': 'Enter 6-digit code',
'verifyPass.modal.codeHelp': 'Code should be 6 digits (numbers only)',
'verifyPass.modal.verifying': 'Verifying...',
'verifyPass.modal.verifyAndAllow': 'Verify & Allow Entry',

// Hindi
'verifyPass.modal.verifyIdentity': '🔐 आगंतुक पहचान सत्यापित करें',
'verifyPass.modal.chooseMethod': 'सत्यापन विधि चुन',
'verifyPass.modal.identityRequired': 'आगंतुक पहचान सत्यापन आवश्यक',
'verifyPass.modal.identityMsg': 'प्रवेश की अनुमति देने से पहले, नीचे दी गई विधियों में से एक का उपयोग करके आगंतुक की पहचान सत्यापित करें।',
'verifyPass.modal.scanQR': 'QR कोड स्कैन करें',
'verifyPass.modal.scanQRMsg': 'आगंतुक से अपने गेट पास से QR कोड दिखाने के लिए कहें',
'verifyPass.modal.openCamera': 'कैमरा खोलें',
'verifyPass.modal.enterCode': 'कोड दर्ज करें',
'verifyPass.modal.enterCodeMsg': 'आगंतुक से उनका 6-अंकीय सत्यापन कोड पूछें',
'verifyPass.modal.backToOptions': '← विकल्पों पर वापस',
'verifyPass.modal.scanVisitorQR': 'आगंतुक का QR कोड स्कैन करें',
'verifyPass.modal.positionQR': 'आगंतुक को अपना गेट पास QR कोड दिखाने के लिए कहें। इसे कैमरा फ्रेम के भीतर रखें।',
'verifyPass.modal.verifyingEntry': 'सत्यापन और प्रवेश की अनुमति दे रहा है...',
'verifyPass.modal.enter6Digit': '6-अंकीय सत्यापन कोड दर्ज करें',
'verifyPass.modal.ask6Digit': 'आगंतुक को अपने गेट पास के साथ प्राप्त 6-अंकीय कोड प्रदान करने के लिए कहें।',
'verifyPass.modal.verificationCode': 'सत्यापन कोड',
'verifyPass.modal.enter6DigitPlaceholder': '6-अंकीय कोड दर्ज करें',
'verifyPass.modal.codeHelp': 'कोड 6 अंक (केवल संख्या) होना चाहिए',
'verifyPass.modal.verifying': 'सत्यापित कर रहा है...',
'verifyPass.modal.verifyAndAllow': 'सत्यापित करें और प्रवेश की अनुमति दें',

// Haryanvi
'verifyPass.modal.verifyIdentity': '🔐 मिलण आळे की पहचान जाँचो',
'verifyPass.modal.chooseMethod': 'जाँच का तरीका चुनो',
'verifyPass.modal.identityRequired': 'मिलण आळे की पहचान जाँच जरूरी सै',
'verifyPass.modal.identityMsg': 'अंदर आणा देण तै पहल्या, नीच्या दिए तरीक्यां म्हु तै कोए एक तै मिलण आळे की पहचान जाँचो।',
'verifyPass.modal.scanQR': 'QR कोड स्कैन करो',
'verifyPass.modal.scanQRMsg': 'मिलण आळे तै अपणै गेट पास का QR कोड दिखाण खातर बोलो',
'verifyPass.modal.openCamera': 'कैमरा खोलो',
'verifyPass.modal.enterCode': 'कोड भरो',
'verifyPass.modal.enterCodeMsg': 'मिलण आळे तै 6-अंक का कोड पूछो',
'verifyPass.modal.backToOptions': '← विकल्प प वापस',
'verifyPass.modal.scanVisitorQR': 'मिलण आळे का QR कोड स्कैन करो',
'verifyPass.modal.positionQR': 'मिलण आळे नै अपणा गेट पास QR कोड दिखाण खातर बोलो। इसनै कैमरा फ्रेम के भीतर राखो।',
'verifyPass.modal.verifyingEntry': 'जाँच करकै अंदर आणा दे रहे सां...',
'verifyPass.modal.enter6Digit': '6-अंक का जाँच कोड भरो',
'verifyPass.modal.ask6Digit': 'मिलण आळे तै अपणै गेट पास के साथ मिला 6-अंक का कोड देण खातर बोलो।',
'verifyPass.modal.verificationCode': 'जाँच कोड',
'verifyPass.modal.enter6DigitPlaceholder': '6-अंक का कोड भरो',
'verifyPass.modal.codeHelp': 'कोड 6 अंक (सिर्फ नंबर) होणा चाहिए',
'verifyPass.modal.verifying': 'जाँच होरी सै...',
'verifyPass.modal.verifyAndAllow': 'जाँच करकै अंदर आणा दो',
```

### 10. Modal Content - Checkout Verification Modal (Lines 1501-1700)
```typescript
// English
'verifyPass.checkoutModal.title': '🚨 Verify Checkout',
'verifyPass.checkoutModal.subtitle': 'Cancelled pass - verify using QR or code',
'verifyPass.checkoutModal.verificationTitle': 'Checkout Verification',
'verifyPass.checkoutModal.verificationMsg': 'This pass was cancelled. Visitor must show checkout QR code or provide verification code.',
'verifyPass.checkoutModal.scanCheckoutQR': 'Scan Checkout QR',
'verifyPass.checkoutModal.scanCheckoutMsg': 'Scan the checkout QR code sent to visitor',
'verifyPass.checkoutModal.enterCheckoutCode': 'Enter Code',
'verifyPass.checkoutModal.enterCheckoutCodeMsg': 'Ask visitor for their NEW 6-digit checkout code',
'verifyPass.checkoutModal.scanCheckoutQRTitle': 'Scan Checkout QR Code',
'verifyPass.checkoutModal.scanCheckoutQRMsg': 'Ask the visitor to show their checkout QR code. Position it within the camera frame.',
'verifyPass.checkoutModal.verifyingExit': 'Verifying and recording exit...',
'verifyPass.checkoutModal.enterNewCode': 'Enter NEW Checkout Verification Code',
'verifyPass.checkoutModal.newCodeMsg': 'Ask the visitor for their NEW 6-digit verification code sent AFTER cancellation (not the original check-in code).',
'verifyPass.checkoutModal.checkoutCode': 'Checkout Verification Code',
'verifyPass.checkoutModal.verifyAndExit': 'Verify & Record Exit',

// Hindi
'verifyPass.checkoutModal.title': '🚨 चेकआउट सत्यापित करें',
'verifyPass.checkoutModal.subtitle': 'रद्द पास - QR या कोड का उपयोग करके सत्यापित करें',
'verifyPass.checkoutModal.verificationTitle': 'चेकआउट सत्यापन',
'verifyPass.checkoutModal.verificationMsg': 'यह पास रद्द कर दिया गया था। आगंतुक को चेकआउट QR कोड दिखाना होगा या सत्यापन कोड प्रदान करना होगा।',
'verifyPass.checkoutModal.scanCheckoutQR': 'चेकआउट QR स्कैन करें',
'verifyPass.checkoutModal.scanCheckoutMsg': 'आगंतुक को भेजा गया चेकआउट QR कोड स्कैन करें',
'verifyPass.checkoutModal.enterCheckoutCode': 'कोड दर्ज करें',
'verifyPass.checkoutModal.enterCheckoutCodeMsg': 'आगंतुक से उनका नया 6-अंकीय चेकआउट कोड पूछें',
'verifyPass.checkoutModal.scanCheckoutQRTitle': 'चेकआउट QR कोड स्कैन करें',
'verifyPass.checkoutModal.scanCheckoutQRMsg': 'आगंतुक को अपना चेकआउट QR कोड दिखाने के लिए कहें। इसे कैमरा फ्रेम के भीतर रखें।',
'verifyPass.checkoutModal.verifyingExit': 'सत्यापन और निकास रिकॉर्ड कर रहा है...',
'verifyPass.checkoutModal.enterNewCode': 'नया चेकआउट सत्यापन कोड दर्ज करें',
'verifyPass.checkoutModal.newCodeMsg': 'आगंतुक से रद्द करने के बाद भेजा गया नया 6-अंकीय सत्यापन कोड पूछें (मूल चेक-इन कोड नहीं)।',
'verifyPass.checkoutModal.checkoutCode': 'चेकआउट सत्यापन कोड',
'verifyPass.checkoutModal.verifyAndExit': 'सत्यापित करें और निकास रिकॉर्ड करें',

// Haryanvi
'verifyPass.checkoutModal.title': '🚨 चेकआउट जाँचो',
'verifyPass.checkoutModal.subtitle': 'रद्द पास - QR या कोड तै जाँच करो',
'verifyPass.checkoutModal.verificationTitle': 'चेकआउट जाँच',
'verifyPass.checkoutModal.verificationMsg': 'यो पास रद्द होग्या था। मिलण आळे नै चेकआउट QR कोड दिखाणा सै या जाँच कोड देणा सै।',
'verifyPass.checkoutModal.scanCheckoutQR': 'चेकआउट QR स्कैन करो',
'verifyPass.checkoutModal.scanCheckoutMsg': 'मिलण आळे नै भेज्या चेकआउट QR कोड स्कैन करो',
'verifyPass.checkoutModal.enterCheckoutCode': 'कोड भरो',
'verifyPass.checkoutModal.enterCheckoutCodeMsg': 'मिलण आळे तै नया 6-अंक का चेकआउट कोड पूछो',
'verifyPass.checkoutModal.scanCheckoutQRTitle': 'चेकआउट QR कोड स्कैन करो',
'verifyPass.checkoutModal.scanCheckoutQRMsg': 'मिलण आळे नै अपणा चेकआउट QR कोड दिखाण खातर बोलो। कैमरा फ्रेम के भीतर राखो।',
'verifyPass.checkoutModal.verifyingExit': 'जाँच करकै बाहर निकाळण दर्ज कररे सां...',
'verifyPass.checkoutModal.enterNewCode': 'नया चेकआउट जाँच कोड भरो',
'verifyPass.checkoutModal.newCodeMsg': 'मिलण आळे तै रद्द होण के बाद भेज्या नया 6-अंक का कोड पूछो (पुराणा चेक-इन कोड न्ही)।',
'verifyPass.checkoutModal.checkoutCode': 'चेकआउट जाँच कोड',
'verifyPass.checkoutModal.verifyAndExit': 'जाँच करकै बाहर निकाळ्ण दर्ज करो',
```

### 11. Modal Content - Cancel Modal (Lines 1701-1800)
```typescript
// English
'verifyPass.cancelModal.title': '🚨 Cancel Pass & Record Checkout',
'verifyPass.cancelModal.subtitle': 'Cancel checked-in pass and proceed with checkout',
'verifyPass.cancelModal.mustCancel': 'Pass Must Be Cancelled Before Checkout',
'verifyPass.cancelModal.currentlyCheckedIn': 'This pass is currently checked-in. You can cancel it now and proceed with checkout:',
'verifyPass.cancelModal.step1': 'Enter cancellation reason below',
'verifyPass.cancelModal.step2': 'System will generate 1-hour checkout QR',
'verifyPass.cancelModal.step3': 'Visitor will receive QR via email/WhatsApp',
'verifyPass.cancelModal.step4': 'Then verify using QR code or verification code to checkout',
'verifyPass.cancelModal.reasonLabel': 'Cancellation Reason',
'verifyPass.cancelModal.reasonRequired': '*',
'verifyPass.cancelModal.reasonPlaceholder': 'Enter reason for cancelling the pass...',
'verifyPass.cancelModal.reasonNote': 'This reason will be recorded in the system',
'verifyPass.cancelModal.cancelBtn': 'Cancel',
'verifyPass.cancelModal.cancelling': 'Cancelling...',
'verifyPass.cancelModal.confirmBtn': 'Cancel Pass & Proceed to Checkout',

// Hindi
'verifyPass.cancelModal.title': '🚨 पास रद्द करें और चेकआउट रिकॉर्ड करें',
'verifyPass.cancelModal.subtitle': 'चेक-इन पास रद्द करें और चेकआउट के साथ आगे बढ़ें',
'verifyPass.cancelModal.mustCancel': 'चेकआउट से पहले पास रद्द किया जाना चाहिए',
'verifyPass.cancelModal.currentlyCheckedIn': 'यह पास वर्तमान में चेक-इन है। आप इसे अभी रद्द कर सकते हैं और चेकआउट के साथ आगे बढ़ सकते हैं:',
'verifyPass.cancelModal.step1': 'नीचे रद्द करने का कारण दर्ज करें',
'verifyPass.cancelModal.step2': 'सिस्टम 1 घंटे का चेकआउट QR उत्पन्न करेगा',
'verifyPass.cancelModal.step3': 'आगंतुक को ईमेल/व्हाट्सएप के माध्यम से QR प्राप्त होगा',
'verifyPass.cancelModal.step4': 'फिर चेकआउट के लिए QR कोड या सत्यापन कोड का उपयोग करके सत्यापित करें',
'verifyPass.cancelModal.reasonLabel': 'रद्द करने का कारण',
'verifyPass.cancelModal.reasonRequired': '*',
'verifyPass.cancelModal.reasonPlaceholder': 'पास रद्द करने का कारण दर्ज करें...',
'verifyPass.cancelModal.reasonNote': 'यह कारण सिस्टम में दर्ज किया जाएगा',
'verifyPass.cancelModal.cancelBtn': 'रद्द करें',
'verifyPass.cancelModal.cancelling': 'रद्द हो रहा है...',
'verifyPass.cancelModal.confirmBtn': 'पास रद्द करें और चेकआउट के लिए आगे बढ़ें',

// Haryanvi
'verifyPass.cancelModal.title': '🚨 पास रद्द करो अर चेकआउट दर्ज करो',
'verifyPass.cancelModal.subtitle': 'चेक-इन पास रद्द करो अर चेकआउट खातर जाओ',
'verifyPass.cancelModal.mustCancel': 'चेकआउट तै पहल्या पास रद्द करणा होगा',
'verifyPass.cancelModal.currentlyCheckedIn': 'यो पास इब चेक-इन सै। तमनै इसनै इब रद्द करकै चेकआउट खातर जा सको सो:',
'verifyPass.cancelModal.step1': 'नीच्या रद्द करण की वजह भरो',
'verifyPass.cancelModal.step2': 'सिस्टम 1 घंटे का चेकआउट QR बणावैगा',
'verifyPass.cancelModal.step3': 'मिलण आळे नै ईमेल/व्हाट्सएप प QR मिलैगा',
'verifyPass.cancelModal.step4': 'फेर चेकआउट खातर QR कोड या जाँच कोड तै जाँच करो',
'verifyPass.cancelModal.reasonLabel': 'रद्द करण की वजह',
'verifyPass.cancelModal.reasonRequired': '*',
'verifyPass.cancelModal.reasonPlaceholder': 'पास रद्द करण की वजह भरो...',
'verifyPass.cancelModal.reasonNote': 'यो वजह सिस्टम म्हु दर्ज होगी',
'verifyPass.cancelModal.cancelBtn': 'रद्द करो',
'verifyPass.cancelModal.cancelling': 'रद्द होरा सै...',
'verifyPass.cancelModal.confirmBtn': 'पास रद्द करो अर चेकआउट खातर जाओ',
```

### 12. Modal Content - Checkout Credentials Modal (Lines 1801-1900)
```typescript
// English
'verifyPass.credModal.title': '✅ Pass Cancelled - Checkout Credentials Generated',
'verifyPass.credModal.successTitle': 'Pass Successfully Cancelled',
'verifyPass.credModal.successMsg': '1-hour checkout QR code has been generated and sent to visitor\'s WhatsApp/Email.',
'verifyPass.credModal.checkoutId': 'Checkout ID',
'verifyPass.credModal.copy': '📋 Copy',
'verifyPass.credModal.checkoutCodeTitle': '🔐 Checkout Verification Code',
'verifyPass.credModal.copyCode': '📋 Copy Code',
'verifyPass.credModal.newCodeWarning': '⚠️ Use this code for checkout verification (NOT the original check-in code)',
'verifyPass.credModal.validUntil': '⏰ Valid Until',
'verifyPass.credModal.validFor1Hour': 'Valid for 1 hour only',
'verifyPass.credModal.closeBtn': 'Close',
'verifyPass.credModal.proceedBtn': 'Proceed to Checkout',

// Hindi
'verifyPass.credModal.title': '✅ पास रद्द - चेकआउट क्रेडेंशियल उत्पन्न',
'verifyPass.credModal.successTitle': 'पास सफलतापूर्वक रद्द किया गया',
'verifyPass.credModal.successMsg': '1 घंटे का चेकआउट QR कोड उत्पन्न किया गया है और आगंतुक के व्हाट्सएप/ईमेल पर भेजा गया है।',
'verifyPass.credModal.checkoutId': 'चेकआउट आईडी',
'verifyPass.credModal.copy': '📋 कॉपी करें',
'verifyPass.credModal.checkoutCodeTitle': '🔐 चेकआउट सत्यापन कोड',
'verifyPass.credModal.copyCode': '📋 कोड कॉपी करें',
'verifyPass.credModal.newCodeWarning': '⚠️ चेकआउट सत्यापन के लिए इस कोड का उपयोग करें (मूल चेक-इन कोड नहीं)',
'verifyPass.credModal.validUntil': '⏰ तक मान्य',
'verifyPass.credModal.validFor1Hour': 'केवल 1 घंटे के लिए मान्य',
'verifyPass.credModal.closeBtn': 'बंद करें',
'verifyPass.credModal.proceedBtn': 'चेकआउट के लिए आगे बढ़ें',

// Haryanvi
'verifyPass.credModal.title': '✅ पास रद्द - चेकआउट की चीजां बणी',
'verifyPass.credModal.successTitle': 'पास सही तरीके तै रद्द होग्या',
'verifyPass.credModal.successMsg': '1 घंटे का चेकआउट QR कोड बणाकै मिलण आळे के व्हाट्सएप/ईमेल प भेज दिया सै।',
'verifyPass.credModal.checkoutId': 'चेकआउट आईडी',
'verifyPass.credModal.copy': '📋 कॉपी करो',
'verifyPass.credModal.checkoutCodeTitle': '🔐 चेकआउट जाँच कोड',
'verifyPass.credModal.copyCode': '📋 कोड कॉपी करो',
'verifyPass.credModal.newCodeWarning': '⚠️ चेकआउट जाँच खातर इस कोड का इस्तेमाल करो (पुराणा चेक-इन कोड न्ही)',
'verifyPass.credModal.validUntil': '⏰ तक सही',
'verifyPass.credModal.validFor1Hour': 'सिर्फ 1 घंटे खातर सही',
'verifyPass.credModal.closeBtn': 'बंद करो',
'verifyPass.credModal.proceedBtn': 'चेकआउट खातर जाओ',
```

### 13. Guard Action Messages (Lines 1222-1240)
```typescript
// English
'verifyPass.guard.checkoutMsg': '🚨 CHECKOUT - Record visitor exit',
'verifyPass.guard.allowEntryMsg': '✅ Verify visitor ID proof before allowing entry',
'verifyPass.guard.recordExitMsg': '✅ Confirm visitor is leaving premises',
'verifyPass.guard.denyEntryMsg': '⚠️ Deny entry if verification fails',
'verifyPass.guard.noActionsMsg': 'ℹ️ No actions available - pass already processed',

// Hindi
'verifyPass.guard.checkoutMsg': '🚨 चेकआउट - आगंतुक का निकास रिकॉर्ड करें',
'verifyPass.guard.allowEntryMsg': '✅ प्रवेश की अनुमति देने से पहले आगंतुक का आईडी प्रमाण सत्यापित करें',
'verifyPass.guard.recordExitMsg': '✅ पुष्टि करें कि आगंतुक परिसर छोड़ रहा है',
'verifyPass.guard.denyEntryMsg': '⚠️ यदि सत्यापन विफल होता है तो प्रवेश अस्वीकार करें',
'verifyPass.guard.noActionsMsg': 'ℹ️ कोई कार्रवाई उपलब्ध नहीं - पास पहले ही संसाधित',

// Haryanvi
'verifyPass.guard.checkoutMsg': '🚨 चेकआउट - मिलण आळे का बाहर निकाळण दर्ज करो',
'verifyPass.guard.allowEntryMsg': '✅ अंदर आणा देण तै पहल्या मिलण आळे की आईडी जाँचो',
'verifyPass.guard.recordExitMsg': '✅ पक्का करो कै मिलण आळा बाहर जारा सै',
'verifyPass.guard.denyEntryMsg': '⚠️ जाँच फेल होवै त्यु अंदर आणा मना करो',
'verifyPass.guard.noActionsMsg': 'ℹ️ कोए काम न्ही - पास पैहल्या ए हो लिया',
```

### 14. Prompt Messages (Line 479)
```typescript
// English (using browser prompt - not ideal for i18n)
'verifyPass.prompt.denyReason': 'Enter reason for denial:',

// Hindi
'verifyPass.prompt.denyReason': 'अस्वीकार करने का कारण दर्ज करें:',

// Haryanvi
'verifyPass.prompt.denyReason': 'मना करण की वजह भरो:',
```

---

## File Updates Required

### File: `frontend/src/app/admin/gate-entry/context/LanguageContext.tsx`

**Action**: Add ALL the translation keys listed above to each language section (en, hi, hr).

**Location**: 
- English section: After `'verifyPass.passIdPlaceholder': 'UNI-PASS-XXX',` (line 323)
- Hindi section: After `'verifyPass.passIdPlaceholder': 'UNI-PASS-XXX',` (line ~643)
- Haryanvi section: After `'verifyPass.passIdPlaceholder': 'UNI-PASS-XXX',` (line ~960)

**Estimated Lines to Add**: ~150 keys × 3 languages = ~450 lines total

---

### File: `frontend/src/app/admin/gate-entry/verify/page.tsx`

This file requires **extensive changes** (150+ replacements). Instead of listing every line number, here are the systematic find-replace patterns:

#### Pattern 1: Toast Notifications
Find all: `toast.success(...)`, `toast.error(...)`, `toast.warning(...)`, `toast.info(...)`
Replace literal English strings with `t('verifyPass.toast...')` keys

#### Pattern 2: Error Messages
Find all: `setError('...')` 
Replace literal strings with `t('verifyPass.err...')` keys

#### Pattern 3: Button Labels & Status Labels
Replace `'Created'` → `t('status.created')`  (and all status labels)
Replace button text like `'Allow Entry'` → `t('verifyPass.actions.allowEntry')`

#### Pattern 4: Field Labels
Replace `'Name'`, `'Mobile'`, `'Email'`, etc. → `t('verifyPass.fields...')`

#### Pattern 5: Modal Content
Replace all modal text strings with appropriate `t('verifyPass.modal...')` or `t('verifyPass.checkoutModal...')` or `t('verifyPass.cancelModal...')` keys

#### Pattern 6: Search Options
Replace dropdown options:
```tsx
<option value="passId">Pass ID</option>
```
becomes:
```tsx
<option value="passId">{t('verifyPass.searchOptions.passId')}</option>
```

#### Pattern 7: Create Status Label Translation Function
Add after `getStatusLabel` function (~line 705):
```tsx
const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    created: 'status.created',
    pending: 'status.pending',
    active: 'status.active',
    checked_in: 'status.checkedIn',
    completed: 'status.completed',
    checked_out: 'status.checkedOut',
    cancelled: 'status.cancelled',
    expired: 'status.expired',
    denied: 'status.denied',
  };
  return t(statusMap[status] || status);
};
```

---

## Implementation Strategy

Given the size (1949 lines, 150+ strings), I recommend:

1. **Add all translation keys to LanguageContext first** (en, hi, hr)
2. **Test the keys are accessible** by importing and using `t()` function
3. **Systematically go through verify/page.tsx**:
   - Section by section (search inputs, modals, buttons, etc.)
   - Use Find & Replace with regex where possible
   - Test after each major section
4. **Test all user flows**:
   - Search passes
   - QR scan
   - Allow entry
   - Deny entry
   - Record exit
   - Cancel and checkout
   - Check all toasts and error messages

---

## Testing Checklist

- [ ] Search by Pass ID works in all languages
- [ ] Search by Mobile/Name/Vehicle works in all languages
- [ ] QR scanner instructions show in selected language
- [ ] All error messages translate correctly
- [ ] Check-in success toast shows in correct language
- [ ] Checkout success toast shows in correct language
- [ ] Cancel pass modal fully translated
- [ ] Verification modals fully translated
- [ ] All button labels translated
- [ ] All field labels translated
- [ ] Status badges show correct language
- [ ] Guard action messages show correct language
- [ ] Modal placeholders and help text translated

---

## Estimated Effort

- Translation keys addition: **30-45 minutes**
- Code replacements in verify/page.tsx: **2-3 hours** (systematic section-by-section)
- Testing all flows: **1-2 hours**
- Total: **4-6 hours**

---

## Notes

- The file is too large to do all at once - take a systematic approach
- Some dynamic error messages from backend will remain in English (those come from `err.response?.data?.message`)
- Browser `prompt()` is used for deny reason - this cannot be easily translated without replacing with custom modal
- Consider breaking this large file into smaller components in future refactoring

---

## Priority Order

1. **High Priority**: Toast notifications (user sees these immediately)
2. **High Priority**: Error messages & warnings  
3. **Medium Priority**: Field labels & headers
4. **Medium Priority**: Modal content
5. **Low Priority**: Help text & instructions (nice to have)

---

**Document Created**: February 26, 2026
**Page**: frontend/src/app/admin/gate-entry/verify/page.tsx (1949 lines)
**Translation Keys**: ~150 keys × 3 languages = ~450 total additions
**Estimated Code Changes**: 150+ replacements in page.tsx
