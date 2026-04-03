'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';

type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    'common.enterFullName': 'Enter full name',
    'common.tenDigitNumber': '10-digit number',
    'common.visitorExample': 'visitor@example.com',
    'common.relationExample': 'e.g., Friend, Family, Vendor',
    'common.selectPurpose': 'Select Purpose',
    'common.to': 'to',
    'common.am': 'AM',
    'common.pm': 'PM',
    'common.role.student': 'Student',
    'common.role.admin': 'Admin',
    'common.role.dsw': 'DSW',
    'common.role.guard': 'Guard',
    'common.role.staff': 'Staff',
    'common.role.faculty': 'Faculty',

    'createPass.title': 'Create Visitor Pass',
    'createPass.subtitle': 'Generate secure entry passes for campus visitors',
    'createPass.creatingAs': 'Creating as:',
    'createPass.parentGuardianOnly': 'Parent/Guardian Only',
    'createPass.visitorInfo': 'Visitor Information',
    'createPass.visitorInfoDesc': "Enter visitor's personal details",
    'createPass.visitorName': 'Visitor Name',
    'createPass.mobileNumber': 'Mobile Number',
    'createPass.emailAddress': 'Email Address',
    'createPass.relation': 'Relation',
    'createPass.numberOfPersons': 'Number of Persons',
    'createPass.totalVisitors': 'Total number of visitors (including you)',
    'createPass.visitDetails': 'Visit Details',
    'createPass.visitDetailsDesc': 'Schedule and purpose of visit',
    'createPass.purposeOfVisit': 'Purpose of Visit',
    'createPass.visitStartDate': 'Visit Start Date',
    'createPass.visitEndDate': 'Visit End Date',
    'createPass.entryTime': 'Entry Time',
    'createPass.vehicleInfo': 'Vehicle Information',
    'createPass.vehicleInfoDesc': 'Optional vehicle registration details',
    'createPass.accommodation': 'Accommodation',
    'createPass.accommodationDesc': 'Guest House booking for multi-day stay',
    'createPass.cancel': 'Cancel',
    'createPass.createPass': 'Create Pass',
    'createPass.creating': 'Creating Pass...',
    'createPass.whatsappNotification': 'Visitor will receive WhatsApp notification',
    'createPass.emailNotification': 'QR code & pass details will be sent via email',
    'createPass.selectGuardian': 'Select Guardian/Parent',
    'createPass.selectGuardianOption': '-- Select Guardian --',
    'createPass.selectFromGuardians': 'Select from your registered guardians or enter manually below',
    'createPass.loadingGuardians': 'Loading your guardians...',
    'createPass.noGuardiansFound': 'No guardians found in database. Please enter details manually below.',
    'createPass.autoFilled': 'Auto-filled from guardian selection',
    'createPass.parentGuardianBadge': 'Parent/Guardian Only',
    'createPass.howManyPeople': 'How many people',
    'createPass.specifyPurpose': 'Specify Purpose',
    'createPass.enterPurpose': 'Enter purpose',
    'createPass.selectRelation': 'Select Relation',
    'createPass.father': 'Father',
    'createPass.mother': 'Mother',
    'createPass.guardian': 'Guardian',
    'createPass.parentOther': 'Parent (Other)',
    'createPass.multiDayStayDetected': 'Multi-day stay detected - Guest House booking available below',
    'createPass.entry': 'Entry:',
    'createPass.qrActivates': 'QR activates 5 hours before',
    'createPass.visitorWillBringVehicle': 'Visitor will bring a vehicle',
    'createPass.vehicleNumberExample': 'e.g., DL01AB1234',
    'createPass.vehicleModelExample': 'e.g., Honda City, Yamaha R15',
    'createPass.noVehicleRequired': 'No vehicle information required',
    'createPass.multiDayVisitDetected': 'Multi-day visit detected',
    'createPass.visitPeriod': 'Visit Period:',
    'createPass.qrActivation': 'QR Activation:',
    'createPass.qrExpiry': 'QR Expiry:',
    'createPass.qrActivationTiming': '5 hours before entry time on',
    'createPass.qrExpiryAt': 'at',
    'createPass.bookHostelQuestion': 'Do you want to book Guest House?',
    'createPass.yesBooking': 'Yes, I want to book',
    'createPass.browseRooms': 'Browse & book from available rooms',
    'createPass.bookingFlowOpens': 'Booking flow opens after pass creation',
    'createPass.noSkipBooking': 'No, skip booking',
    'createPass.continueWithoutBooking': 'Continue without accommodation booking',
    'createPass.duplicateFound': 'Duplicate Found',
    'createPass.cancelExisting': 'Please cancel or complete the existing pass before creating a new one.',
    'createPass.viewExistingPasses': 'View & Manage Existing Passes',
    'createPass.checkingDuplicate': 'Checking for duplicate passes...',
    'createPass.error': 'Error',

    'createPass.studentPurpose.personal': 'Family Visit',
    'createPass.studentPurpose.meeting': 'Meeting with Student',
    'createPass.studentPurpose.event': 'University Event',
    'createPass.studentPurpose.emergency': 'Emergency',
    'createPass.studentPurpose.other': 'Other',
    'createPass.generalPurpose.meeting': 'Meeting',
    'createPass.generalPurpose.personal': 'Personal Visit',
    'createPass.generalPurpose.delivery': 'Delivery',
    'createPass.generalPurpose.event': 'Event',
    'createPass.generalPurpose.vendor': 'Vendor/Service',
    'createPass.generalPurpose.other': 'Other',
    'createPass.vehicleType.two_wheeler': 'Two Wheeler',
    'createPass.vehicleType.four_wheeler': 'Four Wheeler',
    'createPass.vehicleType.other': 'Other',
    'createPass.selectVehicleType': 'Select Vehicle Type',

    'createPass.err.visitorNameRequired': 'Visitor name is required',
    'createPass.err.invalidMobile': 'Valid 10-digit mobile number is required',
    'createPass.err.invalidEmail': 'Please enter a valid email address',
    'createPass.err.personsMin': 'Number of persons must be at least 1',
    'createPass.err.personsMax': 'Number of persons cannot exceed 50',
    'createPass.err.purposeRequired': 'Purpose of visit is required',
    'createPass.err.specifyOther': 'Please specify other purpose',
    'createPass.err.datesRequired': 'Visit dates are required',
    'createPass.err.endDateBeforeStart': 'End date cannot be before start date',
    'createPass.err.entryTimeRequired': 'Entry time is required',
    'createPass.err.vehicleNumberRequired': 'Vehicle number is required when bringing vehicle',
    'createPass.err.vehicleModelRequired': 'Vehicle model is required when bringing vehicle',
    'createPass.err.accommodationRequired': 'Please indicate if you want to book accommodation',
    'createPass.err.failedCreatePass': 'Failed to create pass. Please try again.',

    'createPass.successTitle': 'Pass Created Successfully!',
    'createPass.successMessage': 'Share this code with your visitor for entry verification.',
    'createPass.successMessageHostel': 'Now book accommodation for the visitor.',
    'createPass.successPassId': 'Pass ID',
    'createPass.successVerifCode': 'Verification Code',
    'createPass.successOk': 'OK, Got It!',
    'createPass.successShareNote': 'Share the verification code with your visitor for entry',
    'createPass.successWhatsappSent': 'WhatsApp sent to',
    'createPass.successEmailSent': 'Email sent to',

    'language.english': 'English',
    'language.hindi': 'Hindi'
  },
  hi: {
    'common.enterFullName': 'पूरा नाम दर्ज करें',
    'common.tenDigitNumber': '10 अंकों का नंबर',
    'common.visitorExample': 'visitor@example.com',
    'common.relationExample': 'जैसे: मित्र, परिवार, विक्रेता',
    'common.selectPurpose': 'उद्देश्य चुनें',
    'common.to': 'से',
    'common.am': 'AM',
    'common.pm': 'PM',
    'common.role.student': 'छात्र',
    'common.role.admin': 'एडमिन',
    'common.role.dsw': 'DSW',
    'common.role.guard': 'गार्ड',
    'common.role.staff': 'स्टाफ',
    'common.role.faculty': 'फैकल्टी',

    'createPass.title': 'विज़िटर पास बनाएं',
    'createPass.subtitle': 'कैंपस आगंतुकों के लिए सुरक्षित एंट्री पास बनाएं',
    'createPass.creatingAs': 'आप अभी:',
    'createPass.parentGuardianOnly': 'सिर्फ माता-पिता/अभिभावक',
    'createPass.visitorInfo': 'विज़िटर जानकारी',
    'createPass.visitorInfoDesc': 'विज़िटर की व्यक्तिगत जानकारी भरें',
    'createPass.visitorName': 'विज़िटर नाम',
    'createPass.mobileNumber': 'मोबाइल नंबर',
    'createPass.emailAddress': 'ईमेल पता',
    'createPass.relation': 'रिश्ता',
    'createPass.numberOfPersons': 'लोगों की संख्या',
    'createPass.totalVisitors': 'कुल आगंतुक (आप सहित)',
    'createPass.visitDetails': 'भ्रमण विवरण',
    'createPass.visitDetailsDesc': 'भ्रमण का समय और उद्देश्य',
    'createPass.purposeOfVisit': 'भ्रमण का उद्देश्य',
    'createPass.visitStartDate': 'आरंभ तिथि',
    'createPass.visitEndDate': 'समाप्ति तिथि',
    'createPass.entryTime': 'प्रवेश समय',
    'createPass.vehicleInfo': 'वाहन जानकारी',
    'createPass.vehicleInfoDesc': 'वैकल्पिक वाहन विवरण',
    'createPass.accommodation': 'आवास',
    'createPass.accommodationDesc': 'मल्टी-डे स्टे के लिए गेस्ट हाउस बुकिंग',
    'createPass.cancel': 'रद्द करें',
    'createPass.createPass': 'पास बनाएं',
    'createPass.creating': 'पास बन रहा है...',
    'createPass.whatsappNotification': 'विज़िटर को WhatsApp सूचना भेजी जाएगी',
    'createPass.emailNotification': 'QR और पास विवरण ईमेल से भेजे जाएंगे',
    'createPass.selectGuardian': 'अभिभावक/माता-पिता चुनें',
    'createPass.selectGuardianOption': '-- अभिभावक चुनें --',
    'createPass.selectFromGuardians': 'रजिस्टर्ड अभिभावकों से चुनें या नीचे मैन्युअली भरें',
    'createPass.loadingGuardians': 'अभिभावक लोड हो रहे हैं...',
    'createPass.noGuardiansFound': 'कोई अभिभावक नहीं मिला। कृपया नीचे विवरण भरें।',
    'createPass.autoFilled': 'चयनित अभिभावक से स्वतः भरा गया',
    'createPass.parentGuardianBadge': 'सिर्फ माता-पिता/अभिभावक',
    'createPass.howManyPeople': 'कितने लोग',
    'createPass.specifyPurpose': 'उद्देश्य लिखें',
    'createPass.enterPurpose': 'उद्देश्य दर्ज करें',
    'createPass.selectRelation': 'रिश्ता चुनें',
    'createPass.father': 'पिता',
    'createPass.mother': 'माता',
    'createPass.guardian': 'अभिभावक',
    'createPass.parentOther': 'माता-पिता (अन्य)',
    'createPass.multiDayStayDetected': 'मल्टी-डे स्टे डिटेक्ट हुआ - नीचे गेस्ट हाउस विकल्प उपलब्ध है',
    'createPass.entry': 'प्रवेश:',
    'createPass.qrActivates': 'QR 5 घंटे पहले एक्टिव होगा',
    'createPass.visitorWillBringVehicle': 'विज़िटर वाहन लेकर आएगा',
    'createPass.vehicleNumberExample': 'जैसे: DL01AB1234',
    'createPass.vehicleModelExample': 'जैसे: Honda City, Yamaha R15',
    'createPass.noVehicleRequired': 'वाहन जानकारी आवश्यक नहीं',
    'createPass.multiDayVisitDetected': 'मल्टी-डे विजिट डिटेक्ट हुआ',
    'createPass.visitPeriod': 'भ्रमण अवधि:',
    'createPass.qrActivation': 'QR सक्रियता:',
    'createPass.qrExpiry': 'QR समाप्ति:',
    'createPass.qrActivationTiming': 'प्रवेश समय से 5 घंटे पहले',
    'createPass.qrExpiryAt': 'पर',
    'createPass.bookHostelQuestion': 'क्या आप गेस्ट हाउस बुक करना चाहते हैं?',
    'createPass.yesBooking': 'हाँ, बुक करना है',
    'createPass.browseRooms': 'उपलब्ध कमरे देखें और बुक करें',
    'createPass.bookingFlowOpens': 'पास बनने के बाद बुकिंग फ्लो खुलेगा',
    'createPass.noSkipBooking': 'नहीं, बुकिंग छोड़ें',
    'createPass.continueWithoutBooking': 'आवास बुकिंग के बिना जारी रखें',
    'createPass.duplicateFound': 'डुप्लिकेट मिला',
    'createPass.cancelExisting': 'नया पास बनाने से पहले पुराना पास रद्द/पूर्ण करें।',
    'createPass.viewExistingPasses': 'मौजूदा पास देखें और प्रबंधित करें',
    'createPass.checkingDuplicate': 'डुप्लिकेट पास जांच रहे हैं...',
    'createPass.error': 'त्रुटि',

    'createPass.studentPurpose.personal': 'परिवारिक मुलाकात',
    'createPass.studentPurpose.meeting': 'छात्र से मुलाकात',
    'createPass.studentPurpose.event': 'विश्वविद्यालय कार्यक्रम',
    'createPass.studentPurpose.emergency': 'आपातकाल',
    'createPass.studentPurpose.other': 'अन्य',
    'createPass.generalPurpose.meeting': 'मीटिंग',
    'createPass.generalPurpose.personal': 'व्यक्तिगत मुलाकात',
    'createPass.generalPurpose.delivery': 'डिलीवरी',
    'createPass.generalPurpose.event': 'कार्यक्रम',
    'createPass.generalPurpose.vendor': 'वेंडर/सेवा',
    'createPass.generalPurpose.other': 'अन्य',
    'createPass.vehicleType.two_wheeler': 'दोपहिया',
    'createPass.vehicleType.four_wheeler': 'चारपहिया',
    'createPass.vehicleType.other': 'अन्य',
    'createPass.selectVehicleType': 'वाहन प्रकार चुनें',

    'createPass.err.visitorNameRequired': 'विज़िटर नाम आवश्यक है',
    'createPass.err.invalidMobile': 'सही 10-अंकीय मोबाइल नंबर आवश्यक है',
    'createPass.err.invalidEmail': 'कृपया मान्य ईमेल दर्ज करें',
    'createPass.err.personsMin': 'लोगों की संख्या कम से कम 1 होनी चाहिए',
    'createPass.err.personsMax': 'लोगों की संख्या 50 से अधिक नहीं हो सकती',
    'createPass.err.purposeRequired': 'उद्देश्य आवश्यक है',
    'createPass.err.specifyOther': 'कृपया अन्य उद्देश्य लिखें',
    'createPass.err.datesRequired': 'तिथियां आवश्यक हैं',
    'createPass.err.endDateBeforeStart': 'समाप्ति तिथि आरंभ तिथि से पहले नहीं हो सकती',
    'createPass.err.entryTimeRequired': 'प्रवेश समय आवश्यक है',
    'createPass.err.vehicleNumberRequired': 'वाहन नंबर आवश्यक है',
    'createPass.err.vehicleModelRequired': 'वाहन मॉडल आवश्यक है',
    'createPass.err.accommodationRequired': 'कृपया आवास विकल्प चुनें',
    'createPass.err.failedCreatePass': 'पास बनाने में विफल। कृपया पुनः प्रयास करें।',

    'createPass.successTitle': 'पास सफलतापूर्वक बना!',
    'createPass.successMessage': 'एंट्री सत्यापन के लिए यह कोड विज़िटर के साथ साझा करें।',
    'createPass.successMessageHostel': 'अब विज़िटर के लिए आवास बुक करें।',
    'createPass.successPassId': 'पास आईडी',
    'createPass.successVerifCode': 'सत्यापन कोड',
    'createPass.successOk': 'ठीक है',
    'createPass.successShareNote': 'एंट्री के लिए सत्यापन कोड साझा करें',
    'createPass.successWhatsappSent': 'WhatsApp भेजा गया',
    'createPass.successEmailSent': 'ईमेल भेजा गया',

    'language.english': 'English',
    'language.hindi': 'Hindi'
  }
};

export function CreatePassLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('gateEntryLanguage') as Language | null;
    if (saved === 'en' || saved === 'hi') setLanguage(saved);
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('gateEntryLanguage', lang);
  };

  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage: handleSetLanguage,
    t: (key: string) => translations[language]?.[key] || translations.en[key] || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useCreatePassLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useCreatePassLanguage must be used within CreatePassLanguageProvider');
  return context;
}

export function CreatePassLanguageSelector() {
  const { language, setLanguage, t } = useCreatePassLanguage();

  return (
    <div className="relative z-50">
      <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white border border-[#b3cde0] min-w-[120px] justify-center">
        <Languages className="w-4 h-4 md:w-5 md:h-5 text-[#005b96]" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="bg-transparent text-xs md:text-sm font-bold text-[#011f4b] outline-none"
          aria-label="Select Language"
        >
          <option value="en">{t('language.english')}</option>
          <option value="hi">{t('language.hindi')}</option>
        </select>
        <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-[#6497b1]" />
      </div>
    </div>
  );
}
