const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Validate phone number - must be exactly 10 digits
 */
function validatePhoneNumber(phone) {
  if (!phone) return false;
  const phoneStr = phone.toString();
  // Remove any non-digit characters
  const digitsOnly = phoneStr.replace(/\D/g, '');
  // Must be exactly 10 digits
  return digitsOnly.length === 10;
}

/**
 * Generate a 10-digit phone number
 */
function generatePhone(baseNumber) {
  const phone = baseNumber.toString();
  if (!validatePhoneNumber(phone)) {
    throw new Error(`Invalid phone number: ${phone}. Must be exactly 10 digits.`);
  }
  return phone;
}

/**
 * Seed Parents/Guardians for existing students
 */
async function seedParents() {
  console.log('\n👨‍👩‍👧‍👦 Seeding Parents/Guardians...');
  console.log('='.repeat(80) + '\n');

  try {
    // Get all students
    const students = await prisma.studentDetails.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentId: true,
        phone: true
      },
      orderBy: {
        studentId: 'asc'
      }
    });

    if (students.length === 0) {
      console.log('⚠️  No students found. Please seed students first.');
      return;
    }

    console.log(`📊 Found ${students.length} students. Creating parents...\n`);

    // Parent first names and occupations (will use student's last name)
    const parentsData = [
      {
        fatherFirstName: 'Rajendra',
        fatherOccupation: 'Business Owner',
        fatherOrganization: 'Sharma Enterprises',
        motherFirstName: 'Sunita',
        motherOccupation: 'Teacher',
        motherOrganization: 'DPS School'
      },
      {
        fatherFirstName: 'Harinder',
        fatherOccupation: 'Software Engineer',
        fatherOrganization: 'TCS Ltd',
        motherFirstName: 'Manjeet',
        motherOccupation: 'Homemaker',
        motherOrganization: 'N/A'
      },
      {
        fatherFirstName: 'Suresh',
        fatherOccupation: 'Doctor',
        fatherOrganization: 'Fortis Hospital',
        motherFirstName: 'Geeta',
        motherOccupation: 'Nurse',
        motherOrganization: 'Max Hospital'
      },
      {
        fatherFirstName: 'Ramesh',
        fatherOccupation: 'Chartered Accountant',
        fatherOrganization: 'Patel & Associates',
        motherFirstName: 'Kavita',
        motherOccupation: 'Pharmacist',
        motherOrganization: 'Apollo Pharmacy'
      },
      {
        fatherFirstName: 'Anil',
        fatherOccupation: 'Government Officer',
        fatherOrganization: 'Ministry of Finance',
        motherFirstName: 'Rekha',
        motherOccupation: 'School Principal',
        motherOrganization: 'Kendriya Vidyalaya'
      }
    ];

    let createdCount = 0;

    const normalizeRelationship = (value) => {
      const relation = String(value || '').trim().toLowerCase();
      if (relation === 'father') return 'Father';
      if (relation === 'mother') return 'Mother';
      if (relation === 'guardian') return 'Guardian';
      return value;
    };

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const parentTemplate = parentsData[i % parentsData.length];
      
      // Use student's last name for parents
      const lastName = student.lastName || 'Unknown';

      // Generate unique 10-digit phone numbers
      const fatherPhone = generatePhone(9876543200 + i);  // 9876543200, 9876543201, 9876543202...
      const motherPhone = generatePhone(9876543300 + i);  // 9876543300, 9876543301, 9876543302...

      try {
        const upsertParentByRelationship = async (relationship, data) => {
          const normalized = normalizeRelationship(relationship);
          const aliases = [normalized, normalized.toLowerCase(), normalized.toUpperCase()];

          const existing = await prisma.parentDetails.findFirst({
            where: {
              studentId: student.id,
              relationship: { in: aliases }
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          if (existing) {
            return prisma.parentDetails.update({
              where: { id: existing.id },
              data: {
                ...data,
                relationship: normalized,
                isActive: true
              }
            });
          }

          return prisma.parentDetails.create({
            data: {
              studentId: student.id,
              relationship: normalized,
              ...data,
              isActive: true
            }
          });
        };

        // Create or update Father
        const father = await upsertParentByRelationship('father', {
          firstName: parentTemplate.fatherFirstName,
          lastName: lastName,
          phone: fatherPhone,
          email: `${parentTemplate.fatherFirstName.toLowerCase()}.${lastName.toLowerCase()}@parent.com`,
          occupation: parentTemplate.fatherOccupation,
          organization: parentTemplate.fatherOrganization,
          isPrimaryContact: true
        });

        // Create or update Mother
        const mother = await upsertParentByRelationship('mother', {
          firstName: parentTemplate.motherFirstName,
          lastName: lastName,
          phone: motherPhone,
          email: `${parentTemplate.motherFirstName.toLowerCase()}.${lastName.toLowerCase()}@parent.com`,
          occupation: parentTemplate.motherOccupation,
          organization: parentTemplate.motherOrganization,
          isPrimaryContact: false
        });

        createdCount += 2;
        console.log(`✅ Created parents for: ${student.firstName} ${lastName} (${student.studentId})`);
        console.log(`   Father: ${parentTemplate.fatherFirstName} ${lastName} - Phone: ${fatherPhone}`);
        console.log(`   Mother: ${parentTemplate.motherFirstName} ${lastName} - Phone: ${motherPhone}\n`);
      } catch (error) {
        // Parent might already exist, skip
        console.log(`⚠️  Parents may already exist for: ${student.firstName} ${lastName}`);
        console.log(`   Error: ${error.message}\n`);
      }
    }

    console.log('='.repeat(80));
    console.log(`🎉 Successfully created ${createdCount} parent/guardian records!`);
    console.log('='.repeat(80) + '\n');

    // Display sample parents
    const sampleParents = await prisma.parentDetails.findMany({
      take: 5,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentId: true
          }
        }
      }
    });

    console.log('📋 Sample Parent Records:');
    console.log('='.repeat(80));
    sampleParents.forEach((parent, i) => {
      console.log(`${i + 1}. ${parent.firstName} ${parent.lastName || ''} (${parent.relationship})`);
      console.log(`   Student: ${parent.student.firstName} ${parent.student.lastName || ''} (${parent.student.studentId})`);
      console.log(`   Phone: ${parent.phone}`);
      console.log(`   Email: ${parent.email}`);
      console.log(`   Primary Contact: ${parent.isPrimaryContact ? 'Yes' : 'No'}\n`);
    });

    console.log('='.repeat(80));
    console.log('✅ Parent seeding complete!\n');

  } catch (error) {
    console.error('❌ Error seeding parents:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedParents();
