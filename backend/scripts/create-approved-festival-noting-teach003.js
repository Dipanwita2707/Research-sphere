require("dotenv").config();

const prisma = require("../src/shared/config/database");
const approvalFlowService = require("../src/modules/noting/services/approvalFlow.service");
const eventService = require("../src/modules/event-management/services/event.service");
const { generateNotingId } = require("../src/modules/noting/services/notingId.service");
const {
  NOTE_ACTIONS,
  NOTE_STATUS,
  APPROVAL_PERIODS,
} = require("../src/modules/noting/constants/noting.constants");
const {
  validateDescription,
  validateNoteForSubmission,
  sanitizePoints,
  parsePolicyCompliance,
  sanitizeEventResources,
} = require("../src/modules/noting/utils/validators");

const CREATOR_UID = "TEACH003";
const EVENT_APPROVAL_KEY = "event_approve";
const ALL_VISIBLE_ROLES = [
  "student",
  "faculty",
  "staff",
  "admin",
  "parent",
  "superadmin",
];

function isoAtDayOffset(dayOffset, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function buildSponsor({ name, contactPerson, amount, notes }) {
  return {
    name,
    sponsorType: "corporate",
    contactPerson,
    designation: "Partnership Lead",
    phone: "9876543210",
    email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.com`,
    notes,
    contributionType: "cash",
    cashAmount: amount,
    paymentStatus: "pending",
    paymentMethod: "upi",
    transactionId: `SPN-${Date.now()}`,
    sponsorLogo: {
      filePath: `https://dummy.sgtu.local/assets/${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.png`,
      fileName: `${name.replace(/\s+/g, "_")}.png`,
    },
    receipt: null,
    inKindItems: [],
    originSource: "noting",
  };
}

function buildFestivalPayload(creatorUid) {
  const stamp = `${Date.now().toString().slice(-4)}`;
  const festivalName = `JP Fest ${new Date().getFullYear()} Horizon ${stamp}`;
  const festivalStart = isoAtDayOffset(12, 10, 0);
  const festivalEnd = isoAtDayOffset(14, 20, 0);

  const subEvents = [
    {
      eventType: "venue",
      venueFormData: {
        eventName: `Pixel Quest ${stamp}`,
        eventType: "competition",
        eventStartDate: isoAtDayOffset(12, 11, 0),
        eventEndDate: isoAtDayOffset(12, 14, 0),
        eventPaymentType: "paid",
        eventParticipationType: "individual",
        eventRegistrationFeeIndividual: 1,
        eventRegistrationFeeTeam: null,
        eventApproxCapacity: 120,
        eventCapacityFixed: 60,
        eventDutyLeaveAvailable: true,
        eventDutyLeaveEligibility: ["ug", "pg", "phd"],
        eventDutyLeaveRoleType: "participants",
        eventHasSponsorship: true,
        eventSponsors: [
          buildSponsor({
            name: `Nova Labs ${stamp}`,
            contactPerson: "Aman Suri",
            amount: 15000,
            notes: "Branding support for coding challenge arena.",
          }),
        ],
        eventHasResources: true,
        eventResources: sanitizeEventResources([
          {
            category: "internal",
            type: "LED display panel",
            description: "Main scoreboard screen for finalists.",
            pricePerPiece: 5000,
            quantity: 1,
          },
          {
            category: "internal",
            type: "Desktop systems",
            description: "Competition machines with stable internet.",
            pricePerPiece: 1200,
            quantity: 20,
          },
        ]),
        eventCertification: true,
        eventHasPrizes: true,
        eventPrizesAwards: [
          {
            position: 1,
            rank: "Winner",
            title: "Champion",
            prizeType: "cash",
            prizeAmount: 7000,
            additionalPerks: ["Trophy", "Certificate"],
            sortOrder: 1,
          },
          {
            position: 2,
            rank: "Runner Up",
            title: "Second Place",
            prizeType: "cash",
            prizeAmount: 4000,
            additionalPerks: ["Certificate"],
            sortOrder: 2,
          },
        ],
      },
      stallConfig: null,
    },
    {
      eventType: "venue",
      venueFormData: {
        eventName: `Code Caravan ${stamp}`,
        eventType: "hackathon",
        eventStartDate: isoAtDayOffset(13, 10, 30),
        eventEndDate: isoAtDayOffset(13, 17, 30),
        eventPaymentType: "paid",
        eventParticipationType: "team",
        eventRegistrationFeeIndividual: null,
        eventRegistrationFeeTeam: 2,
        eventApproxCapacity: 90,
        eventCapacityFixed: 45,
        eventDutyLeaveAvailable: true,
        eventDutyLeaveEligibility: ["ug", "pg"],
        eventDutyLeaveRoleType: "both",
        eventHasSponsorship: false,
        eventSponsors: [],
        eventHasResources: true,
        eventResources: sanitizeEventResources([
          {
            category: "internal",
            type: "Discussion tables",
            description: "Tables for 4-member team collaboration.",
            pricePerPiece: 600,
            quantity: 15,
          },
          {
            category: "external",
            type: "Mentor refreshments",
            description: "Tea and snacks for mentor desk.",
            estimatedCost: 3500,
          },
        ]),
        eventCertification: true,
        eventHasPrizes: true,
        eventPrizesAwards: [
          {
            position: 1,
            rank: "Winner",
            title: "Best Team",
            prizeType: "cash",
            prizeAmount: 10000,
            additionalPerks: ["Certificate", "Goodies"],
            sortOrder: 1,
          },
        ],
      },
      stallConfig: null,
    },
    {
      eventType: "venue",
      venueFormData: {
        eventName: `Insight Forum ${stamp}`,
        eventType: "seminar",
        eventStartDate: isoAtDayOffset(14, 11, 0),
        eventEndDate: isoAtDayOffset(14, 13, 0),
        eventPaymentType: "free",
        eventParticipationType: "individual",
        eventRegistrationFeeIndividual: null,
        eventRegistrationFeeTeam: null,
        eventApproxCapacity: 200,
        eventCapacityFixed: 150,
        eventDutyLeaveAvailable: true,
        eventDutyLeaveEligibility: ["ug", "pg", "phd"],
        eventDutyLeaveRoleType: "participants",
        eventHasSponsorship: false,
        eventSponsors: [],
        eventHasResources: true,
        eventResources: sanitizeEventResources([
          {
            category: "internal",
            type: "Wireless microphones",
            description: "For panel discussion and audience Q&A.",
            pricePerPiece: 800,
            quantity: 4,
          },
        ]),
        eventCertification: true,
        eventHasPrizes: false,
        eventPrizesAwards: [],
      },
      stallConfig: null,
    },
    {
      eventType: "stall",
      venueFormData: {
        eventName: `Maker Bazaar ${stamp}`,
        eventType: "cultural",
        eventStartDate: isoAtDayOffset(13, 12, 0),
        eventEndDate: isoAtDayOffset(14, 18, 0),
        eventPaymentType: "free",
        eventParticipationType: "individual",
        eventRegistrationFeeIndividual: null,
        eventRegistrationFeeTeam: null,
        eventApproxCapacity: 75,
        eventCapacityFixed: 40,
        eventDutyLeaveAvailable: false,
        eventDutyLeaveEligibility: null,
        eventDutyLeaveRoleType: null,
        eventHasSponsorship: true,
        eventSponsors: [
          buildSponsor({
            name: `Craft Cart ${stamp}`,
            contactPerson: "Nidhi Kapoor",
            amount: 9000,
            notes: "Support for stall branding and visitor welcome kits.",
          }),
        ],
        eventHasResources: true,
        eventResources: sanitizeEventResources([
          {
            category: "internal",
            type: "Stall partitions",
            description: "Portable partitions for maker stalls.",
            pricePerPiece: 1500,
            quantity: 8,
          },
          {
            category: "internal",
            type: "Power extension boards",
            description: "Electrical points for demonstration stalls.",
            pricePerPiece: 350,
            quantity: 10,
          },
        ]),
        eventCertification: false,
        eventHasPrizes: true,
        eventPrizesAwards: [
          {
            position: 1,
            rank: "Best Stall",
            title: "Top Showcase",
            prizeType: "voucher",
            prizeAmount: 3000,
            additionalPerks: ["Certificate"],
            sortOrder: 1,
          },
        ],
      },
      stallConfig: {
        enableStudentApplied: true,
        maxStudentStalls: 18,
        stallFee: 0,
        applicationDeadline: isoAtDayOffset(10, 18, 0),
        enableCreatorMade: true,
        creatorStalls: [
          {
            name: `Innovation Alley ${stamp}`,
            description: "Reserved showcase for prototype displays.",
            capacity: 12,
          },
          {
            name: `Food Corner ${stamp}`,
            description: "Refreshment and beverage counters.",
            capacity: 8,
          },
        ],
      },
    },
  ];

  return {
    category: "academic",
    subcategory: "events",
    description:
      "JP Fest multi-event noting created through automation for TEACH003. The festival includes a paid individual competition, a paid team hackathon, a free seminar, and a stall-based showcase with complete visibility and operational settings.",
    approvalPeriod: APPROVAL_PERIODS.ONE_TIME,
    recurringFrequency: null,
    policyCompliance: "yes",
    amountRequired: true,
    amount: 25000,
    notingEventType: "festival",
    festivalMeta: {
      name: festivalName,
      startDate: festivalStart,
      endDate: festivalEnd,
      description:
        "A curated JP Fest lineup designed to blend competition, collaboration, open learning, and experiential stalls under one approval note.",
      coordinator: creatorUid,
    },
    eventVisibilitySettings: {
      visibleToRoles: ALL_VISIBLE_ROLES,
      studentFilterType: "all",
      allowedSchoolIds: [],
      allowedDepartmentIds: [],
      allowedProgramIds: [],
      allowedBatchYears: [],
      allowedSectionIds: [],
      allowExtraPasses: true,
      maxExtraPassesPerUser: 2,
    },
    points: [
      "Approve the JP Fest umbrella noting with all four configured sub-events.",
      "Allow event visibility to all major user roles, including students, faculty, staff, admin, parent, and superadmin.",
      "Enable event creation immediately after approval so the TEACH003 account can continue event operations.",
    ],
    subEvents,
  };
}

async function createPendingFestivalNote(creator, approverId, payload) {
  const description = validateDescription(payload.description, true);
  const validPoints = sanitizePoints(payload.points);
  const policyCompliant = parsePolicyCompliance(payload.policyCompliance);

  const noteForValidation = {
    subcategory: payload.subcategory,
    description,
    approvalPeriod: payload.approvalPeriod,
    recurringFrequency: payload.recurringFrequency,
    policyCompliant,
    amountRequired: payload.amountRequired,
    amount: payload.amount,
    notingEventType: payload.notingEventType,
    festivalMeta: payload.festivalMeta,
    subEvents: payload.subEvents,
    points: validPoints,
  };

  validateNoteForSubmission(noteForValidation);

  const notingId = generateNotingId(payload.category, payload.subcategory);

  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        notingId,
        category: payload.category,
        subcategory: payload.subcategory,
        description,
        approvalPeriod: payload.approvalPeriod,
        recurringFrequency: payload.recurringFrequency,
        policyCompliant,
        amountRequired: payload.amountRequired,
        amount: payload.amount,
        notingEventType: payload.notingEventType,
        festivalMeta: payload.festivalMeta,
        subEvents: payload.subEvents,
        eventVisibilitySettings: payload.eventVisibilitySettings,
        status: NOTE_STATUS.PENDING,
        createdById: creator.id,
        currentHolderId: approverId,
        autoForwardedToManager: true,
        reportingChainHistory: [
          {
            timestamp: new Date().toISOString(),
            fromUserId: creator.id,
            toUserId: approverId,
            reason: "Automation script forwarded event noting to direct manager",
          },
        ],
        points: {
          create: validPoints,
        },
      },
      select: {
        id: true,
        notingId: true,
        currentHolderId: true,
      },
    });

    await tx.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: creator.id,
        remarks: "Submitted by automation script and forwarded to manager for final event approval.",
        nextHolderId: approverId,
      },
    });

    return note;
  });
}

async function approveNote(noteId, approverId) {
  return prisma.$transaction(async (tx) => {
    await tx.noteHistory.create({
      data: {
        noteId,
        action: NOTE_ACTIONS.APPROVED,
        performedById: approverId,
        remarks: "Approved by automation script to create festival sub-events.",
        nextHolderId: null,
      },
    });

    return tx.note.update({
      where: { id: noteId },
      data: {
        currentHolderId: null,
        status: NOTE_STATUS.APPROVED,
      },
      select: {
        id: true,
        notingId: true,
        status: true,
      },
    });
  });
}

async function main() {
  console.log("========================================================");
  console.log("  CREATE + APPROVE FESTIVAL NOTING FOR TEACH003");
  console.log("========================================================");

  const creator = await prisma.userLogin.findUnique({
    where: { uid: CREATOR_UID },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      employeeDetails: {
        select: {
          displayName: true,
          empId: true,
        },
      },
    },
  });

  if (!creator) {
    throw new Error(`Creator account ${CREATOR_UID} not found.`);
  }

  const approvalStep = await approvalFlowService.determineNextApproverByReporting(
    {
      createdById: creator.id,
      subcategory: "events",
    },
    EVENT_APPROVAL_KEY,
  );

  if (!approvalStep?.canAutoForward || !approvalStep?.nextApproverId) {
    throw new Error(
      `No valid approver found for ${CREATOR_UID}. Reason: ${approvalStep?.reason || "Unknown error"}`,
    );
  }

  const approver = await prisma.userLogin.findUnique({
    where: { id: approvalStep.nextApproverId },
    select: {
      id: true,
      uid: true,
      email: true,
      employeeDetails: {
        select: {
          displayName: true,
          empId: true,
        },
      },
    },
  });

  if (!approver) {
    throw new Error(`Approver ${approvalStep.nextApproverId} not found.`);
  }

  const payload = buildFestivalPayload(creator.uid);

  const pendingNote = await createPendingFestivalNote(
    creator,
    approver.id,
    payload,
  );

  console.log(`Created pending noting: ${pendingNote.notingId} (${pendingNote.id})`);
  console.log(
    `Assigned to approver: ${approver.employeeDetails?.displayName || approver.uid} (${approver.uid})`,
  );

  const approvedNote = await approveNote(pendingNote.id, approver.id);
  console.log(`Approved noting: ${approvedNote.notingId}`);

  const result = await eventService.createEventFromNoting(
    approvedNote.id,
    approver.id,
  );

  if (!result.isFestival) {
    throw new Error("Expected festival result but received single-event creation.");
  }

  console.log("");
  console.log("Festival created successfully.");
  console.log(`Festival Name: ${payload.festivalMeta.name}`);
  console.log(`Creator: ${creator.employeeDetails?.displayName || creator.uid} (${creator.uid})`);
  console.log(`Approver: ${approver.employeeDetails?.displayName || approver.uid} (${approver.uid})`);
  console.log("Created sub-events:");
  result.events.forEach((event, index) => {
    console.log(
      `  ${index + 1}. ${event.eventId} | ${event.name} | ${event.notingEventType} | ${event.paymentType} | ${event.participationType}`,
    );
  });
}

main()
  .catch((error) => {
    console.error("");
    console.error("[FATAL] Festival noting automation failed.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
