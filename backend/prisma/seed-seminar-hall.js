#!/usr/bin/env node
/**
 * Seminar Hall Booking System - Database Seed Script
 * Initializes blocks, floors, rooms, facilities, and sample bookings
 * 
 * Run with: node backend/prisma/seed-seminar-hall.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Seminar Hall Booking System...\n");

  try {
    // ========================================
    // 1. Create Facilities (Features)
    // ========================================
    console.log("📝 Creating Facilities...");
    
    const facilitiesData = [
      { name: "Projector", category: "visual", description: "LCD/LED Projector" },
      { name: "Microphone", category: "audio", description: "Wireless/Wired Microphone" },
      { name: "Whiteboard", category: "visual", description: "Interactive Whiteboard" },
      { name: "Air Conditioning", category: "comfort", description: "Temperature Control" },
      { name: "WiFi", category: "tech", description: "High-speed Internet" },
      { name: "Speaker System", category: "audio", description: "Surround Sound" },
      { name: "Video Recording", category: "tech", description: "HD Video Setup" },
      { name: "Wheelchair Access", category: "accessibility", description: "ADA Compliant" },
      { name: "Parking", category: "facilities", description: "Dedicated Parking" },
      { name: "Catering Service", category: "facilities", description: "On-site Catering" },
    ];

    const facilities = await Promise.all(
      facilitiesData.map((fac) =>
        prisma.roomFacility.upsert({
          where: { name: fac.name },
          update: {},
          create: {
            name: fac.name,
            category: fac.category,
            description: fac.description,
            isActive: true,
          },
        })
      )
    );

    console.log(`✅ Created ${facilities.length} facilities\n`);

    // ========================================
    // 2. Create Blocks
    // ========================================
    console.log("🏢 Creating Blocks...");

    const blocksData = [
      {
        name: "Block A",
        blockNumber: "A1",
        location: "North Campus",
        description: "Academic Block - Computer Science & IT",
      },
      {
        name: "Block B",
        blockNumber: "B1",
        location: "Central Campus",
        description: "Engineering Block - Mechanical & Civil",
      },
      {
        name: "Block C",
        blockNumber: "C1",
        location: "South Campus",
        description: "Administrative Block - Management & Administration",
      },
      {
        name: "Block D",
        blockNumber: "D1",
        location: "East Campus",
        description: "Science Block - Physics & Chemistry",
      },
    ];

    const blocks = await Promise.all(
      blocksData.map((block) =>
        prisma.seminarHallBlock.upsert({
          where: { name: block.name },
          update: {},
          create: {
            name: block.name,
            blockNumber: block.blockNumber,
            location: block.location,
            description: block.description,
            isActive: true,
          },
        })
      )
    );

    console.log(`✅ Created ${blocks.length} blocks\n`);

    // ========================================
    // 3. Create Floors (under each block)
    // ========================================
    console.log("📍 Creating Floors...");

    const floorsData = [];
    blocks.forEach((block, blockIdx) => {
      for (let floor = 1; floor <= 3; floor++) {
        floorsData.push({
          blockId: block.id,
          floorNumber: floor,
          name: floor === 1 ? "Ground Floor" : `${floor === 2 ? "First" : "Second"} Floor`,
          description: `${block.name} - ${floor === 1 ? "Ground" : `Floor ${floor - 1}`} Level`,
        });
      }
    });

    const floors = await Promise.all(
      floorsData.map((floor) =>
        prisma.seminarHallFloor.create({
          data: {
            blockId: floor.blockId,
            floorNumber: floor.floorNumber,
            name: floor.name,
            description: floor.description,
            isActive: true,
          },
        })
      )
    );

    console.log(`✅ Created ${floors.length} floors\n`);

    // ========================================
    // 4. Create Rooms (under each floor)
    // ========================================
    console.log("🚪 Creating Rooms...");

    const roomTypes = ["seminar_hall", "auditorium", "classroom", "conference_room"];
    const roomsData = [];

    floors.forEach((floor) => {
      const roomsPerFloor = 3;
      for (let i = 1; i <= roomsPerFloor; i++) {
        const roomType = roomTypes[(i - 1) % roomTypes.length];
        const capacity = roomType === "auditorium" ? 150 : roomType === "seminar_hall" ? 60 : 30;

        roomsData.push({
          blockId: floor.blockId,
          floorId: floor.id,
          name: `${roomType.charAt(0).toUpperCase()}-${floor.floorNumber}0${i}`,
          roomNumber: `${floor.floorNumber}0${i}`,
          type: roomType,
          capacity: capacity,
          chairs: capacity,
          description: `${roomType.replace(/_/g, " ")} with capacity of ${capacity}`,
          facilities: [
            { facilityId: facilities[0].id, quantity: roomType === "auditorium" ? 2 : 1 }, // Projector
            { facilityId: facilities[1].id, quantity: roomType === "auditorium" ? 3 : 1 }, // Mic
            { facilityId: facilities[2].id, quantity: 1 }, // Whiteboard
            { facilityId: facilities[3].id, quantity: 1 }, // AC
            { facilityId: facilities[4].id, quantity: 1 }, // WiFi
          ],
        });
      }
    });

    const rooms = await Promise.all(
      roomsData.map(async (room) => {
        const { facilities: facilityMappings, ...roomData } = room;

        // Create room
        const newRoom = await prisma.seminarHallRoom.create({
          data: {
            ...roomData,
            isActive: true,
          },
        });

        // Create facility mappings for this room
        await Promise.all(
          facilityMappings.map((mapping) =>
            prisma.roomFacilityMapping.create({
              data: {
                roomId: newRoom.id,
                facilityId: mapping.facilityId,
                quantity: mapping.quantity,
              },
            })
          )
        );

        return newRoom;
      })
    );

    console.log(`✅ Created ${rooms.length} rooms with facilities\n`);

    // ========================================
    // 5. Create Sample Booking Requests
    // ========================================
    console.log("📅 Creating Sample Booking Requests...");

    const sampleBookings = [
      {
        roomId: rooms[0].id,
        requesterName: "Dr. John Smith",
        requesterEmail: "john.smith@university.edu",
        requesterPhone: "+91-9876543210",
        department: "Computer Science",
        bookingDate: new Date("2025-05-15"),
        startTime: "09:00",
        endTime: "11:00",
        timeSlot: "AM",
        purpose: "Python Workshop - Advanced OOP Concepts",
        additionalRequirements: "WiFi should be enabled",
        requestKind: "new_booking",
        status: "pending",
      },
      {
        roomId: rooms[1].id,
        requesterName: "Prof. Sarah Johnson",
        requesterEmail: "sarah.johnson@university.edu",
        requesterPhone: "+91-9876543211",
        department: "Mechanical Engineering",
        bookingDate: new Date("2025-05-20"),
        startTime: "14:00",
        endTime: "16:00",
        timeSlot: "PM",
        purpose: "Guest Lecture - Industry Trends",
        additionalRequirements: "Projector and speaker system required",
        requestKind: "new_booking",
        status: "pending",
      },
      {
        roomId: rooms[2].id,
        requesterName: "Dr. Rajesh Kumar",
        requesterEmail: "rajesh.kumar@university.edu",
        requesterPhone: "+91-9876543212",
        department: "Physics",
        bookingDate: new Date("2025-05-10"),
        startTime: "10:00",
        endTime: "12:30",
        timeSlot: "AM",
        purpose: "Seminar on Quantum Computing",
        additionalRequirements: "Video recording facility needed",
        requestKind: "new_booking",
        status: "approved",
        approvedAt: new Date(),
      },
      {
        roomId: rooms[3].id,
        requesterName: "Mrs. Emily Davis",
        requesterEmail: "emily.davis@university.edu",
        requesterPhone: "+91-9876543213",
        department: "Administration",
        bookingDate: new Date("2025-06-01"),
        startTime: "09:00",
        endTime: "17:00",
        timeSlot: "FULL_DAY",
        purpose: "Board Meeting",
        additionalRequirements: "Catering service required",
        requestKind: "new_booking",
        status: "approved",
        approvedAt: new Date(),
      },
    ];

    let requestCounter = 1;
    const bookings = await Promise.all(
      sampleBookings.map((booking) =>
        prisma.seminarHallBookingRequest.create({
          data: {
            ...booking,
            requestId: `REQ-2025-${String(requestCounter++).padStart(4, "0")}`,
          },
        })
      )
    );

    console.log(`✅ Created ${bookings.length} sample booking requests\n`);

    // ========================================
    // 6. Create Sample Booking History
    // ========================================
    console.log("📜 Creating Booking History...");

    const historyEntries = [];
    
    bookings.forEach((booking, idx) => {
      if (booking.status === "approved") {
        historyEntries.push(
          prisma.seminarHallBookingHistory.create({
            data: {
              bookingRequestId: booking.id,
              oldStatus: null,
              newStatus: "pending",
              action: "created",
              actionDetails: "Booking request submitted",
              changedAt: new Date(new Date().getTime() - 86400000), // 1 day ago
            },
          })
        );

        historyEntries.push(
          prisma.seminarHallBookingHistory.create({
            data: {
              bookingRequestId: booking.id,
              oldStatus: "pending",
              newStatus: "approved",
              action: "approved",
              actionDetails: "Request approved by admin",
              changedAt: new Date(),
            },
          })
        );
      } else {
        historyEntries.push(
          prisma.seminarHallBookingHistory.create({
            data: {
              bookingRequestId: booking.id,
              oldStatus: null,
              newStatus: "pending",
              action: "created",
              actionDetails: "Booking request submitted",
              changedAt: new Date(),
            },
          })
        );
      }
    });

    await Promise.all(historyEntries);
    console.log(`✅ Created booking history entries\n`);

    console.log("✨ Database seeding completed successfully!");
    console.log(`
Summary:
  ✓ Facilities: ${facilities.length}
  ✓ Blocks: ${blocks.length}
  ✓ Floors: ${floors.length}
  ✓ Rooms: ${rooms.length}
  ✓ Booking Requests: ${bookings.length}
  
Next steps:
  1. Review data in Prisma Studio: npm run prisma:studio
  2. Start building API endpoints
  3. Connect frontend to backend API
    `);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
