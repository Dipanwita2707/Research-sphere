const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');

const STATS_CACHE_VERSION = 'v4';
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const toLower = (value) => String(value || '').trim().toLowerCase();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getRoleName = (user) => toLower(user?.role?.name || user?.role || user?.userType);

const assertStatisticsAdminAccess = (user) => {
  const roleName = getRoleName(user);
  if (!ADMIN_ROLES.has(roleName)) {
    throw new ForbiddenError('Only admins can view event statistics');
  }
};

const mapUserName = (user) => {
  if (!user) return 'Unknown User';

  const employeeName = user.employeeDetails?.displayName
    || `${user.employeeDetails?.firstName || ''} ${user.employeeDetails?.lastName || ''}`.trim();
  const studentName = user.studentLogin?.displayName
    || `${user.studentLogin?.firstName || ''} ${user.studentLogin?.lastName || ''}`.trim();

  return employeeName || studentName || user.uid || 'Unknown User';
};

const mapRegistrationUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    name: mapUserName(user),
  };
};

const getFestivalSubEvent = (note, event) => {
  const subEvents = toArray(note?.subEvents);
  if (subEvents.length === 0) return null;

  return (
    subEvents.find((subEvent) => {
      const venue = subEvent?.venueFormData || subEvent;
      if (!venue) return false;

      if (venue.eventName && venue.eventName === event.name) return true;
      if (venue.eventStartDate && event.startDate) {
        return new Date(venue.eventStartDate).getTime() === new Date(event.startDate).getTime();
      }
      return false;
    })?.venueFormData || null
  );
};

const getSponsorName = (sponsor) =>
  String(sponsor?.name || sponsor?.company || sponsor?.sponsorName || '').trim();

const getInKindEstimatedValue = (sponsor) => {
  return toArray(sponsor?.inKindItems).reduce((sum, item) => {
    const estimatedValue = toNumber(item?.estimatedValue);
    const quantity = Math.max(1, toNumber(item?.quantity || 1));
    return sum + (estimatedValue * quantity);
  }, 0);
};

const normalizeSponsor = (rawSponsor, fallbackSource = 'manual') => {
  if (!rawSponsor || typeof rawSponsor !== 'object') return null;

  const name = getSponsorName(rawSponsor);
  if (!name) return null;

  const contributionType = toLower(rawSponsor.contributionType || rawSponsor.type || 'cash') || 'cash';
  const cashAmount = toNumber(rawSponsor.cashAmount ?? rawSponsor.amount);
  const inKindEstimatedValue = getInKindEstimatedValue(rawSponsor);
  const contributionAmount = Math.max(0, cashAmount + inKindEstimatedValue);

  const paymentStatusRaw = toLower(rawSponsor.paymentStatus);
  const statusBucket = paymentStatusRaw === 'received' ? 'confirmed' : 'pending';

  const originSource = toLower(rawSponsor.originSource);
  const source = originSource === 'noting'
    ? 'noting'
    : originSource === 'event'
      ? 'manual'
      : fallbackSource;

  return {
    id: rawSponsor.id || null,
    name,
    contributionAmount,
    cashAmount,
    inKindEstimatedValue,
    contributionType,
    paymentStatus: paymentStatusRaw || null,
    statusBucket,
    source,
  };
};

const buildSponsorList = (event, note) => {
  const notingSponsors = toArray(note?.eventSponsors);
  const eventSponsors = toArray(event?.sponsors);
  const festivalSponsors = toArray(getFestivalSubEvent(note, event)?.eventSponsors);

  const sponsorMap = new Map();

  const upsert = (rawSponsor, fallbackSource) => {
    const normalized = normalizeSponsor(rawSponsor, fallbackSource);
    if (!normalized) return;

    const mapKey = normalized.id || `${normalized.name.toLowerCase()}::${normalized.source}`;
    sponsorMap.set(mapKey, normalized);
  };

  notingSponsors.forEach((sponsor) => upsert(sponsor, 'noting'));
  festivalSponsors.forEach((sponsor) => upsert(sponsor, 'noting'));
  eventSponsors.forEach((sponsor) => upsert(sponsor, 'manual'));

  return [...sponsorMap.values()].sort((a, b) => b.contributionAmount - a.contributionAmount);
};

const buildRegistrationWindow = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return {
      startDate: startDate || null,
      endDate: endDate || null,
      progressPercent: null,
      daysLeft: null,
      isOpen: false,
    };
  }

  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const total = end - start;
  const elapsed = now - start;
  const progressPercent = total > 0 ? Number(clamp((elapsed / total) * 100, 0, 100).toFixed(1)) : null;

  return {
    startDate,
    endDate,
    progressPercent,
    daysLeft: Math.ceil((end - now) / MS_PER_DAY),
    isOpen: now >= start && now <= end,
  };
};

const buildStatisticsPayload = async (event) => {
  const participantRolePromise = prisma.$queryRaw`
    SELECT
      COALESCE(ul.role::text, 'unknown') AS role,
      COUNT(*)::int AS count
    FROM "EventRegistration" er
    LEFT JOIN "user_login" ul ON ul.id = er."userId"
    WHERE er."eventId" = ${event.id}
    GROUP BY COALESCE(ul.role::text, 'unknown')
    ORDER BY count DESC
  `.catch(() => []);

  const [
    registrationStatsRows,
    entryStatsRows,
    couponUsageCount,
    discountAggregate,
    volunteerCount,
    scannersEnabledCount,
    dateGroups,
    recentRegistrations,
    paymentStatusRows,
    participantRoleRows,
    entryFlowByHourRows,
    volunteerScanRows,
    teamStatusRows,
    pendingTeamInvitations,
    pendingTeamRequests,
    confirmedTeamMembers,
    teamsLookingForMembers,
    activeTeamCount,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'waitlisted')::int AS waitlisted,
        COUNT(*) FILTER (WHERE "hasEntered" = true)::int AS attended,
        COUNT(*) FILTER (WHERE "paymentStatus" = 'completed')::int AS "completedPayments",
        COUNT(*) FILTER (WHERE "paymentStatus" = 'pending')::int AS "pendingPayments",
        COUNT(*) FILTER (WHERE "paymentStatus" = 'failed')::int AS "failedPayments",
        COUNT(*) FILTER (WHERE "paymentStatus" = 'refunded')::int AS "refundedPayments",
        COUNT(*) FILTER (WHERE "formSubmittedAt" IS NOT NULL)::int AS "formSubmittedCount",
        COUNT(*) FILTER (WHERE "teamId" IS NOT NULL)::int AS "teamAssignedCount",
        COUNT(*) FILTER (WHERE "lookingForTeammates" = true)::int AS "lookingForTeammatesCount",
        COALESCE(SUM(CASE WHEN "paymentStatus" = 'completed' THEN COALESCE("amountPaid", 0) ELSE 0 END), 0)::float AS revenue
      FROM "EventRegistration"
      WHERE "eventId" = ${event.id}
    `,
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN "entryType" = 'entry' THEN "entryCount" ELSE 0 END), 0)::int AS "totalEntries",
        COALESCE(SUM(CASE WHEN "entryType" = 'exit' THEN "entryCount" ELSE 0 END), 0)::int AS "totalExits"
      FROM "EventEntry"
      WHERE "eventId" = ${event.id}
    `,
    prisma.eventRegistration.count({
      where: {
        eventId: event.id,
        couponId: { not: null },
      },
    }),
    prisma.eventRegistration.aggregate({
      where: { eventId: event.id },
      _sum: { discountAmount: true },
    }),
    prisma.eventVolunteer.count({ where: { eventId: event.id } }),
    prisma.eventVolunteer.count({ where: { eventId: event.id, canScanQr: true } }),
    prisma.$queryRaw`
      SELECT DATE("registeredAt")::text AS date, COUNT(*)::int AS count
      FROM "EventRegistration"
      WHERE "eventId" = ${event.id}
      GROUP BY DATE("registeredAt")
      ORDER BY date ASC
    `,
    prisma.eventRegistration.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        registrationId: true,
        status: true,
        paymentStatus: true,
        amountPaid: true,
        hasEntered: true,
        registeredAt: true,
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 40,
    }),
    prisma.$queryRaw`
      SELECT
        COALESCE("paymentStatus"::text, 'unknown') AS status,
        COUNT(*)::int AS count,
        COALESCE(SUM(COALESCE("amountPaid", 0)), 0)::float AS amount
      FROM "EventRegistration"
      WHERE "eventId" = ${event.id}
      GROUP BY COALESCE("paymentStatus"::text, 'unknown')
      ORDER BY count DESC
    `,
    participantRolePromise,
    prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM "scannedAt")::int AS hour,
        COALESCE(SUM(CASE WHEN "entryType" = 'entry' THEN "entryCount" ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN "entryType" = 'exit' THEN "entryCount" ELSE 0 END), 0)::int AS exits
      FROM "EventEntry"
      WHERE "eventId" = ${event.id}
      GROUP BY EXTRACT(HOUR FROM "scannedAt")
      ORDER BY hour ASC
    `,
    prisma.$queryRaw`
      SELECT
        ee."volunteerId" AS "volunteerId",
        COUNT(*)::int AS scans,
        COALESCE(SUM(CASE WHEN ee."entryType" = 'entry' THEN ee."entryCount" ELSE 0 END), 0)::int AS entries,
        COALESCE(SUM(CASE WHEN ee."entryType" = 'exit' THEN ee."entryCount" ELSE 0 END), 0)::int AS exits
      FROM "EventEntry" ee
      WHERE ee."eventId" = ${event.id}
      GROUP BY ee."volunteerId"
      ORDER BY scans DESC
      LIMIT 20
    `,
    prisma.eventTeam.groupBy({
      where: { eventId: event.id },
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.eventTeamInvitation.count({
      where: {
        status: 'pending',
        EventTeam: { eventId: event.id },
      },
    }),
    prisma.eventTeamRequest.count({
      where: {
        status: 'pending',
        EventTeam: { eventId: event.id },
      },
    }),
    prisma.eventTeamMember.count({
      where: {
        status: 'confirmed',
        EventTeam: { eventId: event.id },
      },
    }),
    prisma.eventTeam.count({
      where: {
        eventId: event.id,
        lookingForMembers: true,
        isLocked: false,
        status: { in: ['forming', 'complete'] },
      },
    }),
    prisma.eventTeam.count({
      where: {
        eventId: event.id,
        status: { in: ['forming', 'complete', 'confirmed'] },
      },
    }),
  ]);

  let fieldResponseRows = [];
  let registrationsWithResponses = 0;
  try {
    const [fieldResponseResult, fieldCoverageRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT efr."fieldId" AS "fieldId", COUNT(*)::int AS "responseCount"
        FROM "event_field_response" efr
        JOIN "EventRegistration" er ON er.id = efr."registrationId"
        WHERE er."eventId" = ${event.id}
        GROUP BY efr."fieldId"
      `,
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT efr."registrationId")::int AS "registrationsWithResponses"
        FROM "event_field_response" efr
        JOIN "EventRegistration" er ON er.id = efr."registrationId"
        WHERE er."eventId" = ${event.id}
      `,
    ]);

    fieldResponseRows = Array.isArray(fieldResponseResult) ? fieldResponseResult : [];
    registrationsWithResponses = toNumber(fieldCoverageRows?.[0]?.registrationsWithResponses);
  } catch (error) {
    const errorMessage = String(error?.message || '');
    const isMissingRelation = error?.meta?.code === '42P01'
      || errorMessage.includes('42P01')
      || errorMessage.toLowerCase().includes('does not exist');
    if (!isMissingRelation) {
      throw error;
    }
  }

  const registrationStats = registrationStatsRows?.[0] || {};
  const entryStats = entryStatsRows?.[0] || {};

  const totalRegistrations = toNumber(registrationStats.total);
  const confirmedRegistrations = toNumber(registrationStats.confirmed);
  const pendingRegistrations = toNumber(registrationStats.pending);
  const cancelledRegistrations = toNumber(registrationStats.cancelled);
  const waitlistedRegistrations = toNumber(registrationStats.waitlisted);
  const totalAttended = toNumber(registrationStats.attended);
  const completedPayments = toNumber(registrationStats.completedPayments);
  const pendingPayments = toNumber(registrationStats.pendingPayments);
  const failedPayments = toNumber(registrationStats.failedPayments);
  const refundedPayments = toNumber(registrationStats.refundedPayments);
  const formSubmittedCount = toNumber(registrationStats.formSubmittedCount);
  const teamAssignedCount = toNumber(registrationStats.teamAssignedCount);
  const lookingForTeammatesCount = toNumber(registrationStats.lookingForTeammatesCount);
  const totalDiscountAmount = toNumber(discountAggregate?._sum?.discountAmount);
  const totalRevenue = toNumber(registrationStats.revenue);
  const totalEntries = toNumber(entryStats.totalEntries);
  const totalExits = toNumber(entryStats.totalExits);
  const currentlyInside = Math.max(0, totalEntries - totalExits);

  const confirmationRate = totalRegistrations > 0
    ? Number(((confirmedRegistrations / totalRegistrations) * 100).toFixed(1))
    : 0;
  const attendanceRate = confirmedRegistrations > 0
    ? Number(((totalAttended / confirmedRegistrations) * 100).toFixed(1))
    : 0;
  const checkInRate = totalRegistrations > 0
    ? Number(((totalEntries / totalRegistrations) * 100).toFixed(1))
    : 0;

  const activeParticipants = confirmedRegistrations;
  const incompleteRegistrations = pendingRegistrations + waitlistedRegistrations;
  const dropOffRegistrations = cancelledRegistrations;
  const dropOffRate = totalRegistrations > 0
    ? Number(((dropOffRegistrations / totalRegistrations) * 100).toFixed(1))
    : 0;

  const paymentStatusBreakdown = toArray(paymentStatusRows).map((row) => {
    const count = toNumber(row.count);
    return {
      status: toLower(row.status) || 'unknown',
      count,
      amount: toNumber(row.amount),
      percent: totalRegistrations > 0 ? Number(((count / totalRegistrations) * 100).toFixed(1)) : 0,
    };
  });

  const registrationsByDate = dateGroups.map((group) => ({
    date: group.date,
    count: toNumber(group.count),
  }));

  const topRegistrationDays = [...registrationsByDate]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const roleBreakdown = toArray(participantRoleRows).map((row) => {
    const count = toNumber(row.count);
    return {
      role: toLower(row.role) || 'unknown',
      count,
      percent: totalRegistrations > 0 ? Number(((count / totalRegistrations) * 100).toFixed(1)) : 0,
    };
  });

  const sponsors = buildSponsorList(event, event.note);
  const sponsorshipTotal = sponsors.reduce((sum, sponsor) => sum + sponsor.contributionAmount, 0);
  const confirmedSponsorships = sponsors.filter((sponsor) => sponsor.statusBucket === 'confirmed');
  const pendingSponsorships = sponsors.filter((sponsor) => sponsor.statusBucket === 'pending');
  const confirmedSponsorshipAmount = confirmedSponsorships.reduce((sum, sponsor) => sum + sponsor.contributionAmount, 0);
  const pendingSponsorshipAmount = pendingSponsorships.reduce((sum, sponsor) => sum + sponsor.contributionAmount, 0);

  const customFieldResponseCountByField = new Map(
    fieldResponseRows.map((row) => [row.fieldId, toNumber(row.responseCount)]),
  );
  const customFields = toArray(event.EventCustomField).map((field) => {
    const responseCount = customFieldResponseCountByField.get(field.id) || 0;
    return {
      id: field.id,
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      responseCount,
      responseRate: totalRegistrations > 0
        ? Number(((responseCount / totalRegistrations) * 100).toFixed(1))
        : 0,
    };
  });

  const registrationWindow = buildRegistrationWindow(event.registrationStartDate, event.registrationEndDate);
  const maxCapacity = event.maxCapacity == null ? null : toNumber(event.maxCapacity);
  const registrationsUtilization = maxCapacity && maxCapacity > 0
    ? Number(((totalRegistrations / maxCapacity) * 100).toFixed(1))
    : null;
  const confirmedUtilization = maxCapacity && maxCapacity > 0
    ? Number(((confirmedRegistrations / maxCapacity) * 100).toFixed(1))
    : null;

  const now = Date.now();
  const startMs = event.startDate ? new Date(event.startDate).getTime() : null;
  const endMs = event.endDate ? new Date(event.endDate).getTime() : null;
  const eventDurationDays = startMs && endMs
    ? Math.max(1, Math.ceil((endMs - startMs) / MS_PER_DAY))
    : null;
  const daysUntilStart = startMs ? Math.ceil((startMs - now) / MS_PER_DAY) : null;
  const daysUntilEnd = endMs ? Math.ceil((endMs - now) / MS_PER_DAY) : null;

  const scansByHourBase = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    entries: 0,
    exits: 0,
    total: 0,
  }));
  const scansByHourMap = new Map(scansByHourBase.map((item) => [item.hour, item]));
  toArray(entryFlowByHourRows).forEach((row) => {
    const hour = toNumber(row.hour);
    const entries = toNumber(row.entries);
    const exits = toNumber(row.exits);
    const target = scansByHourMap.get(hour);
    if (!target) return;
    target.entries = entries;
    target.exits = exits;
    target.total = entries + exits;
  });
  const scansByHour = [...scansByHourMap.values()];
  const peakHour = scansByHour.reduce((max, item) => (item.total > max.total ? item : max), scansByHour[0]);

  const volunteerIds = toArray(volunteerScanRows)
    .map((row) => row.volunteerId)
    .filter(Boolean);

  const volunteerRows = volunteerIds.length > 0
    ? await prisma.eventVolunteer.findMany({
      where: { id: { in: volunteerIds } },
      select: {
        id: true,
        role: true,
        assignedGate: true,
        canScanQr: true,
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    })
    : [];

  const volunteerMap = new Map(volunteerRows.map((row) => [row.id, row]));
  const topVolunteers = toArray(volunteerScanRows).map((row) => {
    const volunteer = volunteerMap.get(row.volunteerId);
    return {
      id: row.volunteerId,
      scans: toNumber(row.scans),
      entries: toNumber(row.entries),
      exits: toNumber(row.exits),
      role: volunteer?.role || null,
      canScanQr: volunteer?.canScanQr || false,
      assignedGate: volunteer?.assignedGate || null,
      user: volunteer?.user_login
        ? {
          id: volunteer.user_login.id,
          uid: volunteer.user_login.uid,
          email: volunteer.user_login.email,
          name: mapUserName(volunteer.user_login),
        }
        : null,
    };
  });

  const teamStatusCounts = {};
  toArray(teamStatusRows).forEach((row) => {
    teamStatusCounts[row.status] = toNumber(row?._count?._all);
  });
  const totalTeams = Object.values(teamStatusCounts).reduce((sum, value) => sum + toNumber(value), 0);

  return {
    eventSummary: {
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      status: event.status,
      eventType: event.eventType,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
      paymentType: event.paymentType,
      participationType: event.participationType,
      registrationFee: event.registrationFee,
      maxCapacity: event.maxCapacity,
      registrationStartDate: event.registrationStartDate || null,
      registrationEndDate: event.registrationEndDate || null,
      publishedAt: event.publishedAt || null,
      notingId: event.notingId || null,
      notingEventType: event.notingEventType || null,
      opportunityMode: event.opportunityMode || null,
    },
    totalRegistrations,
    confirmedRegistrations,
    pendingRegistrations,
    cancelledRegistrations,
    waitlistedRegistrations,
    totalAttended,
    totalEntries,
    totalExits,
    currentlyInside,
    volunteerCount,
    totalRevenue,
    revenueCollected: totalRevenue,
    registrationsByDate,
    topRegistrationDays,
    recentRegistrations: recentRegistrations.map((registration) => ({
      id: registration.id,
      registrationId: registration.registrationId,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      amountPaid: registration.amountPaid,
      hasEntered: registration.hasEntered,
      registeredAt: registration.registeredAt,
      user: mapRegistrationUser(registration.user_login),
    })),
    sponsorship: {
      totalSponsorshipAmountCollected: confirmedSponsorshipAmount,
      totalSponsorshipAmountCommitted: sponsorshipTotal,
      confirmedSponsorships: {
        count: confirmedSponsorships.length,
        amount: confirmedSponsorshipAmount,
      },
      pendingSponsorships: {
        count: pendingSponsorships.length,
        amount: pendingSponsorshipAmount,
      },
      sponsors,
    },
    participationMetrics: {
      totalRegistrations,
      activeParticipants,
      dropOffRegistrations,
      incompleteRegistrations,
      completionRate: confirmationRate,
    },
    registrationFunnel: {
      registered: totalRegistrations,
      formSubmitted: formSubmittedCount,
      confirmed: confirmedRegistrations,
      attended: totalAttended,
      dropOffs: dropOffRegistrations,
      formCompletionRate: totalRegistrations > 0
        ? Number(((formSubmittedCount / totalRegistrations) * 100).toFixed(1))
        : 0,
      confirmationRate,
      attendanceRate,
      dropOffRate,
    },
    eventInsights: {
      revenue: totalRevenue,
      ticketSales: event.paymentType === 'paid'
        ? {
          sold: completedPayments,
          grossPotentialRevenue: toNumber(event.registrationFee) * confirmedRegistrations,
        }
        : null,
      engagementMetrics: {
        confirmationRate,
        attendanceRate,
        checkInRate,
        avgEntriesPerActiveParticipant: activeParticipants > 0
          ? Number((totalEntries / activeParticipants).toFixed(2))
          : 0,
        currentlyInside,
      },
    },
    paymentMetrics: {
      completedPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      couponUsageCount,
      totalDiscountAmount,
      avgRevenuePerConfirmed: confirmedRegistrations > 0
        ? Number((totalRevenue / confirmedRegistrations).toFixed(2))
        : 0,
      avgAmountPerPaidRegistration: completedPayments > 0
        ? Number((totalRevenue / completedPayments).toFixed(2))
        : 0,
      statusBreakdown: paymentStatusBreakdown,
    },
    capacityInsights: {
      maxCapacity,
      registrationsUtilization,
      confirmedUtilization,
      remainingCapacity: maxCapacity != null ? Math.max(0, maxCapacity - totalRegistrations) : null,
      eventDurationDays,
      daysUntilStart,
      daysUntilEnd,
      registrationWindow,
    },
    participantDemographics: {
      byRole: roleBreakdown,
      withTeamCount: teamAssignedCount,
      lookingForTeammatesCount,
    },
    volunteerInsights: {
      totalVolunteers: volunteerCount,
      scannersEnabled: scannersEnabledCount,
      scansByHour,
      peakHour,
      topVolunteers,
    },
    teamInsights: event.participationType === 'team'
      ? {
        totalTeams,
        activeTeams: activeTeamCount,
        formingTeams: toNumber(teamStatusCounts.forming),
        completeTeams: toNumber(teamStatusCounts.complete),
        confirmedTeams: toNumber(teamStatusCounts.confirmed),
        disqualifiedTeams: toNumber(teamStatusCounts.disqualified),
        withdrawnTeams: toNumber(teamStatusCounts.withdrawn),
        pendingInvitations: pendingTeamInvitations,
        pendingJoinRequests: pendingTeamRequests,
        confirmedTeamMembers,
        teamsLookingForMembers,
        avgTeamSize: activeTeamCount > 0
          ? Number((confirmedTeamMembers / activeTeamCount).toFixed(2))
          : 0,
      }
      : null,
    notingAndCustomData: {
      notingId: event.notingId || null,
      notingEventType: event.notingEventType || null,
      source: event.notingId ? 'noting' : 'manual',
      sponsorsFromNotingCount: sponsors.filter((sponsor) => sponsor.source === 'noting').length,
      sponsorsAddedManuallyCount: sponsors.filter((sponsor) => sponsor.source === 'manual').length,
      resourcesFromNoting: toArray(event.note?.eventResources),
      resourcesAddedByCreator: toArray(event.resources),
      customFields,
      customFieldResponseCoverage: {
        registrationsWithResponses,
        totalRegistrations,
        coverageRate: totalRegistrations > 0
          ? Number(((registrationsWithResponses / totalRegistrations) * 100).toFixed(1))
          : 0,
      },
    },
  };
};

const getEventStatistics = async (eventId, user) => {
  assertStatisticsAdminAccess(user);

  const eventLookupCacheKey = `event:stats:entity:${String(eventId)}`;
  const { data: event } = await cache.getOrSet(
    eventLookupCacheKey,
    () => prisma.event.findFirst({
      where: { OR: [{ id: eventId }, { eventId }] },
      select: {
        id: true,
        eventId: true,
        name: true,
        status: true,
        eventType: true,
        venue: true,
        startDate: true,
        endDate: true,
        registrationStartDate: true,
        registrationEndDate: true,
        publishedAt: true,
        paymentType: true,
        participationType: true,
        registrationFee: true,
        maxCapacity: true,
        opportunityMode: true,
        notingId: true,
        notingEventType: true,
        sponsors: true,
        resources: true,
        note: {
          select: {
            eventSponsors: true,
            eventResources: true,
            subEvents: true,
          },
        },
        EventCustomField: {
          where: { isActive: true },
          select: {
            id: true,
            fieldName: true,
            fieldLabel: true,
            fieldType: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    }),
    cache.CACHE_TTL.EVENT_STATS || 60,
  );

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const cacheKey = `event:stats:${STATS_CACHE_VERSION}:${event.id}`;
  const { data } = await cache.getOrSet(
    cacheKey,
    async () => buildStatisticsPayload(event),
    cache.CACHE_TTL.EVENT_STATS || 60,
  );

  return data;
};

module.exports = {
  getEventStatistics,
};
