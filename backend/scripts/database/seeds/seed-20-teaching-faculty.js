require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const FACULTY_ID = '4771706b-c6db-4283-a948-cdb266fc8f7f'; // Faculty of Engineering
const DEPARTMENTS = [
  { id: 'ac43e97b-8470-4bcf-bcbd-d782527c700b', name: 'Mechanical Engineering' },
  { id: 'ed32a8cf-cffa-45d5-89d9-16600d890d12', name: 'Civil Engineering' },
  { id: 'ed6b1675-f2bd-4db5-b4ea-84bfad552075', name: 'Electronics & Communication Engineering' },
  { id: 'fa5ba1ed-8420-4738-ba32-5906994ae313', name: 'Computer Science & Engineering' },
];

const FIRST_NAMES = [
  'Rajesh', 'Priya', 'Vikram', 'Anjali', 'Suresh',
  'Neha', 'Amit', 'Kavita', 'Deepak', 'Meera',
  'Rohit', 'Sneha', 'Arun', 'Pooja', 'Kiran',
  'Divya', 'Manoj', 'Shruti', 'Rahul', 'Nisha'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Kumar', 'Singh',
  'Gupta', 'Joshi', 'Verma', 'Rao', 'Nair',
  'Das', 'Mehta', 'Iyer', 'Kapoor', 'Saxena',
  'Agarwal', 'Mishra', 'Bhat', 'Pillai', 'Menon'
];

const DESIGNATIONS = [
  'Assistant Professor', 'Associate Professor', 'Professor',
  'Senior Lecturer', 'Lecturer'
];

async function seedTeachingFaculty() {
  console.log('🚀 Starting seed of 20 teaching faculty employees...\n');

  const passwordHash = await bcrypt.hash('Faculty@123', 12);
  const createdUsers = [];

  for (let i = 1; i <= 20; i++) {
    const uid = `TEACH${String(i).padStart(3, '0')}`;
    const firstName = FIRST_NAMES[i - 1];
    const lastName = LAST_NAMES[i - 1];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sgt.edu`;
    const empId = `EMP${String(1000 + i)}`;
    const dept = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];
    const designation = DESIGNATIONS[(i - 1) % DESIGNATIONS.length];

    try {
      // Check if user already exists
      const existing = await prisma.userLogin.findFirst({
        where: { OR: [{ uid }, { email }] }
      });

      if (existing) {
        console.log(`⏭️  Skipping ${uid} - already exists`);
        createdUsers.push({
          uid,
          email,
          password: 'Faculty@123',
          status: 'EXISTING'
        });
        continue;
      }

      // Create user with employee details
      const user = await prisma.userLogin.create({
        data: {
          uid,
          email,
          passwordHash,
          role: 'faculty',
          status: 'active',
          employeeDetails: {
            create: {
              empId,
              firstName,
              lastName,
              displayName: `${firstName} ${lastName}`,
              email,
              designation,
              phoneNumber: `98765${String(10000 + i)}`,
              primarySchoolId: FACULTY_ID,
              primaryDepartmentId: dept.id,
            }
          }
        },
        include: {
          employeeDetails: true
        }
      });

      // Create HrTeachingStaffDetails for teaching category
      await prisma.hrTeachingStaffDetails.create({
        data: {
          employeeId: user.employeeDetails.id,
          qualification: 'Ph.D.',
          experience: `${5 + (i % 10)} years`,
          specialization: dept.name,
          currentPosting: dept.name,
        }
      });

      console.log(`✅ Created: ${uid} - ${firstName} ${lastName} (${dept.name})`);
      
      createdUsers.push({
        uid,
        email,
        password: 'Faculty@123',
        name: `${firstName} ${lastName}`,
        department: dept.name,
        designation,
        status: 'CREATED'
      });

    } catch (error) {
      console.error(`❌ Error creating ${uid}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 CREDENTIALS FOR LOGIN:');
  console.log('='.repeat(80));
  console.log('\nPassword for all users: Faculty@123\n');
  console.log('| # | UID       | Email                          | Name                |');
  console.log('|---|-----------|--------------------------------|---------------------|');
  
  createdUsers.forEach((u, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const uid = u.uid.padEnd(9, ' ');
    const email = u.email.padEnd(30, ' ');
    const name = (u.name || '').padEnd(19, ' ');
    console.log(`| ${num}| ${uid} | ${email} | ${name} |`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Seed complete!');
  console.log('='.repeat(80));

  return createdUsers;
}

seedTeachingFaculty()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
