import type { ResourceBlock } from '../types/roomBooking.types';

const buildCurrentMonthDateKey = (day: number): string => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dateOfMonth = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${dateOfMonth}`;
};

export const mockResourceBlocks: ResourceBlock[] = [
  {
    id: 'block_a',
    name: 'Block A',
    floors: [
      {
        id: 'a_gf',
        name: 'Ground floor',
        rooms: [
          {
            id: 'a_gf_seminar_1',
            name: 'Seminar Hall A1',
            type: 'seminar_hall',
            capacity: 80,
            chairs: 60,
            facilities: ['Projector', 'Mic x 2', 'AC'],
            status: 'free',
            calendarAvailability: {
              [buildCurrentMonthDateKey(9)]: {
                status: 'booked',
                slotLabel: '10:00 AM - 12:00 PM',
                purpose: 'Faculty workshop',
                bookedByName: 'Aditi Sharma',
                bookedByDepartment: 'Computer Science Department',
                bookedByMobile: '+91 98999 22331',
                bookedByEmail: 'aditi.sharma@uni.ac.in',
              },
              [buildCurrentMonthDateKey(15)]: {
                status: 'booked',
                slotLabel: '02:00 PM - 04:00 PM',
                purpose: 'Startup mentoring session',
                bookedByName: 'Vikram Singh',
                bookedByDepartment: 'Innovation and Entrepreneurship Cell',
                bookedByMobile: '+91 98111 11444',
                bookedByEmail: 'vikram.singh@uni.ac.in',
              },
            },
          },
          {
            id: 'a_gf_auditorium_1',
            name: 'Auditorium',
            type: 'auditorium',
            capacity: 300,
            chairs: 260,
            facilities: ['Stage', 'PA system', 'AC'],
            status: 'occupied',
            booking: {
              name: 'Rahul Sharma',
              mobile: '+91 98765 43210',
              email: 'rahul@uni.ac.in',
              slotLabel: 'Today, 10:00 AM - 1:00 PM',
            },
            calendarAvailability: {
              [buildCurrentMonthDateKey(7)]: {
                status: 'booked',
                slotLabel: '09:30 AM - 01:00 PM',
                purpose: 'Annual orientation event',
                bookedByName: 'Rahul Sharma',
                bookedByDepartment: 'Student Affairs Office',
                bookedByMobile: '+91 98765 43210',
                bookedByEmail: 'rahul@uni.ac.in',
              },
              [buildCurrentMonthDateKey(21)]: {
                status: 'booked',
                slotLabel: '11:00 AM - 03:00 PM',
                purpose: 'Inter-department presentation',
                bookedByName: 'Megha Arora',
                bookedByDepartment: 'Mechanical Engineering Department',
                bookedByMobile: '+91 98888 77881',
                bookedByEmail: 'megha.arora@uni.ac.in',
              },
              [buildCurrentMonthDateKey(28)]: {
                status: 'booked',
                slotLabel: '12:00 PM - 02:00 PM',
                purpose: 'Cultural rehearsals',
                bookedByName: 'Student Council',
                bookedByDepartment: 'Student Cultural Committee',
                bookedByMobile: '+91 98000 55000',
                bookedByEmail: 'council@uni.ac.in',
              },
            },
          },
          {
            id: 'a_gf_classroom_3',
            name: 'Classroom GF-03',
            type: 'classroom',
            capacity: 40,
            chairs: 40,
            facilities: ['Whiteboard', 'Projector'],
            status: 'free',
          },
          {
            id: 'a_gf_conference_1',
            name: 'Conference Room 1',
            type: 'conference_room',
            capacity: 20,
            chairs: 18,
            facilities: ['TV screen', 'Video conf.', 'AC'],
            status: 'private',
          },
        ],
      },
      {
        id: 'a_1f',
        name: '1st floor',
        rooms: [
          {
            id: 'a_1f_seminar_2',
            name: 'Seminar Hall A2',
            type: 'seminar_hall',
            capacity: 120,
            chairs: 100,
            facilities: ['Projector', 'Dual Mic', 'Recording setup'],
            status: 'free',
            calendarAvailability: {
              [buildCurrentMonthDateKey(5)]: {
                status: 'booked',
                slotLabel: '03:00 PM - 05:00 PM',
                purpose: 'Admissions briefing',
                bookedByName: 'Admissions Cell',
                bookedByDepartment: 'Admissions Office',
                bookedByMobile: '+91 97777 66330',
                bookedByEmail: 'admissions@uni.ac.in',
              },
              [buildCurrentMonthDateKey(17)]: {
                status: 'booked',
                slotLabel: '11:30 AM - 01:30 PM',
                purpose: 'Research panel discussion',
                bookedByName: 'Dr. Anil Verma',
                bookedByDepartment: 'Research and Development Cell',
                bookedByMobile: '+91 99888 77661',
                bookedByEmail: 'anil.verma@uni.ac.in',
              },
            },
          },
        ],
      },
      {
        id: 'a_2f',
        name: '2nd floor',
        rooms: [],
      },
      {
        id: 'a_3f',
        name: '3rd floor',
        rooms: [],
      },
    ],
  },
  {
    id: 'block_b',
    name: 'Block B',
    floors: [
      { id: 'b_gf', name: 'Ground floor', rooms: [] },
      { id: 'b_1f', name: '1st floor', rooms: [] },
      { id: 'b_2f', name: '2nd floor', rooms: [] },
      { id: 'b_3f', name: '3rd floor', rooms: [] },
    ],
  },
  {
    id: 'block_c',
    name: 'Block C',
    floors: [
      { id: 'c_gf', name: 'Ground floor', rooms: [] },
      { id: 'c_1f', name: '1st floor', rooms: [] },
      { id: 'c_2f', name: '2nd floor', rooms: [] },
      { id: 'c_3f', name: '3rd floor', rooms: [] },
    ],
  },
  {
    id: 'block_d',
    name: 'Block D',
    floors: [
      { id: 'd_gf', name: 'Ground floor', rooms: [] },
      { id: 'd_1f', name: '1st floor', rooms: [] },
      { id: 'd_2f', name: '2nd floor', rooms: [] },
      { id: 'd_3f', name: '3rd floor', rooms: [] },
    ],
  },
];
