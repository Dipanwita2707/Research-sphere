export type AdminBookingStatus = 'pending' | 'approved' | 'rejected';

export interface AdminBookingRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  blockName: string;
  roomName: string;
  roomType: 'seminar_hall' | 'auditorium';
  bookingDate: string;
  timeSlot: string;
  purpose: string;
  additionalRequirements?: string;
  status: AdminBookingStatus;
  createdAtLabel: string;
  adminRemark?: string;
}

export const mockAdminBookingRequests: AdminBookingRequest[] = [
  {
    id: 'REQ-2026-0201',
    requesterName: 'Aditi Sharma',
    requesterEmail: 'aditi.sharma@uni.ac.in',
    requesterPhone: '+91 98999 22331',
    blockName: 'Block A',
    roomName: 'Seminar Hall A1',
    roomType: 'seminar_hall',
    bookingDate: '26 Apr 2026',
    timeSlot: '11:00 AM - 01:00 PM',
    purpose: 'Faculty workshop on curriculum update',
    additionalRequirements: '20 extra chairs and 2 wireless mics',
    status: 'pending',
    createdAtLabel: 'Requested on 22 Apr, 10:25 AM',
  },
  {
    id: 'REQ-2026-0202',
    requesterName: 'Rohan Verma',
    requesterEmail: 'rohan.verma@uni.ac.in',
    requesterPhone: '+91 98765 11337',
    blockName: 'Block A',
    roomName: 'Auditorium',
    roomType: 'auditorium',
    bookingDate: '27 Apr 2026',
    timeSlot: '02:00 PM - 04:00 PM',
    purpose: 'Inter-department orientation session',
    additionalRequirements: 'PA testing support and registration desk',
    status: 'pending',
    createdAtLabel: 'Requested on 22 Apr, 11:10 AM',
  },
  {
    id: 'REQ-2026-0195',
    requesterName: 'Neha Bansal',
    requesterEmail: 'neha.bansal@uni.ac.in',
    requesterPhone: '+91 98333 66771',
    blockName: 'Block A',
    roomName: 'Seminar Hall A2',
    roomType: 'seminar_hall',
    bookingDate: '24 Apr 2026',
    timeSlot: '10:00 AM - 12:00 PM',
    purpose: 'Industry mentorship discussion',
    status: 'approved',
    adminRemark: 'Approved. AV team notified.',
    createdAtLabel: 'Requested on 20 Apr, 03:40 PM',
  },
  {
    id: 'REQ-2026-0192',
    requesterName: 'Prakash Meena',
    requesterEmail: 'prakash.meena@uni.ac.in',
    requesterPhone: '+91 98000 44556',
    blockName: 'Block A',
    roomName: 'Auditorium',
    roomType: 'auditorium',
    bookingDate: '23 Apr 2026',
    timeSlot: '04:00 PM - 06:00 PM',
    purpose: 'Event rehearsal',
    status: 'rejected',
    adminRemark: 'Clashes with existing approved booking.',
    createdAtLabel: 'Requested on 20 Apr, 12:15 PM',
  },
];
