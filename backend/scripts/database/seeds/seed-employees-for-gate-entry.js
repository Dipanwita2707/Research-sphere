const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedEmployeesForGateEntry() {
  console.log('🌱 Starting employee seeding for Gate Entry...\n');

  try {
    // Fetch departments first
    console.log('📂 Fetching departments...');
    const academicDepartments = await prisma.department.findMany({
      select: { id: true, departmentCode: true, departmentName: true }
    });
    const centralDepartments = await prisma.centralDepartment.findMany({
      select: { id: true, departmentCode: true, departmentName: true }
    });

    console.log(`   Found ${academicDepartments.length} academic departments`);
    console.log(`   Found ${centralDepartments.length} central departments\n`);

    // Find specific departments
    const cseDept = academicDepartments.find(d => d.departmentCode === 'CSE');
    const eceDept = academicDepartments.find(d => d.departmentCode === 'ECE');
    const meDept = academicDepartments.find(d => d.departmentCode === 'ME');
    const civilDept = academicDepartments.find(d => d.departmentCode === 'CIVIL');
    const adminDept = centralDepartments.find(d => d.departmentCode === 'ADMIN');
    const hrDept = centralDepartments.find(d => d.departmentCode === 'HR');
    const finDept = centralDepartments.find(d => d.departmentCode === 'FIN');

    // Create sample employees with userLogin and department assignments
    const employees = [
      {
        firstName: 'Rajesh',
        lastName: 'Sharma',
        displayName: 'Dr. Rajesh Sharma',
        empId: 'EMP001',
        designation: 'Professor & HOD',
        email: 'rajesh.sharma@university.edu',
        phoneNumber: '+91-9876543210',
        role: 'faculty',
        departmentId: cseDept?.id,
        departmentType: 'academic'
      },
      {
        firstName: 'Priya',
        lastName: 'Verma',
        displayName: 'Dr. Priya Verma',
        empId: 'EMP002',
        designation: 'Associate Professor',
        email: 'priya.verma@university.edu',
        phoneNumber: '+91-9876543211',
        role: 'faculty',
        departmentId: eceDept?.id,
        departmentType: 'academic'
      },
      {
        firstName: 'Amit',
        lastName: 'Kumar',
        displayName: 'Prof. Amit Kumar',
        empId: 'EMP003',
        designation: 'Dean - Academics',
        email: 'amit.kumar@university.edu',
        phoneNumber: '+91-9876543212',
        role: 'faculty',
        departmentId: meDept?.id,
        departmentType: 'academic'
      },
      {
        firstName: 'Vikram',
        lastName: 'Singh',
        displayName: 'Mr. Vikram Singh',
        empId: 'STAFF001',
        designation: 'Administrative Officer',
        email: 'vikram.singh@university.edu',
        phoneNumber: '+91-9876543213',
        role: 'staff',
        departmentId: adminDept?.id,
        departmentType: 'central'
      },
      {
        firstName: 'Sneha',
        lastName: 'Gupta',
        displayName: 'Ms. Sneha Gupta',
        empId: 'STAFF002',
        designation: 'HR Manager',
        email: 'sneha.gupta@university.edu',
        phoneNumber: '+91-9876543214',
        role: 'staff',
        departmentId: hrDept?.id,
        departmentType: 'central'
      },
      {
        firstName: 'Rahul',
        lastName: 'Patel',
        displayName: 'Dr. Rahul Patel',
        empId: 'EMP004',
        designation: 'Assistant Professor',
        email: 'rahul.patel@university.edu',
        phoneNumber: '+91-9876543215',
        role: 'faculty',
        departmentId: cseDept?.id,
        departmentType: 'academic'
      },
      {
        firstName: 'Anjali',
        lastName: 'Mehta',
        displayName: 'Dr. Anjali Mehta',
        empId: 'EMP005',
        designation: 'Professor',
        email: 'anjali.mehta@university.edu',
        phoneNumber: '+91-9876543216',
        role: 'faculty',
        departmentId: civilDept?.id,
        departmentType: 'academic'
      },
      {
        firstName: 'Suresh',
        lastName: 'Reddy',
        displayName: 'Mr. Suresh Reddy',
        empId: 'STAFF003',
        designation: 'Finance Officer',
        email: 'suresh.reddy@university.edu',
        phoneNumber: '+91-9876543217',
        role: 'staff',
        departmentId: finDept?.id,
        departmentType: 'central'
      }
    ];

    const passwordHash = await bcrypt.hash('password123', 10);

    for (const emp of employees) {
      console.log(`Creating ${emp.displayName}...`);

      // Check if user already exists
      const existingUser = await prisma.userLogin.findFirst({
        where: {
          OR: [
            { email: emp.email },
            { uid: emp.empId }
          ]
        }
      });

      if (existingUser) {
        console.log(`  ⚠️  User already exists: ${emp.email}`);
        
        // Update existing employee with department if missing
        const existingEmployee = await prisma.employeeDetails.findUnique({
          where: { userLoginId: existingUser.id }
        });

        if (existingEmployee && emp.departmentId) {
          const updateData = {};
          if (emp.departmentType === 'academic') {
            updateData.primaryDepartmentId = emp.departmentId;
          } else if (emp.departmentType === 'central') {
            updateData.primaryCentralDeptId = emp.departmentId;
          }

          await prisma.employeeDetails.update({
            where: { userLoginId: existingUser.id },
            data: updateData
          });

          const deptName = emp.departmentType === 'academic' 
            ? academicDepartments.find(d => d.id === emp.departmentId)?.departmentName
            : centralDepartments.find(d => d.id === emp.departmentId)?.departmentName;
          console.log(`  ✅ Updated department: ${emp.displayName} → ${deptName || 'No Department'}`);
        }
        
        continue;
      }

      // Create UserLogin
      const userLogin = await prisma.userLogin.create({
        data: {
          uid: emp.empId,
          email: emp.email,
          passwordHash: passwordHash,
          role: emp.role,
          status: 'active'
        }
      });

      // Create EmployeeDetails with department assignment
      const employeeData = {
        userLoginId: userLogin.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        empId: emp.empId,
        designation: emp.designation,
        email: emp.email,
        phoneNumber: emp.phoneNumber,
        isActive: true,
        joinDate: new Date('2020-01-01'),
        metadata: {}
      };

      // Add department assignment
      if (emp.departmentId) {
        if (emp.departmentType === 'academic') {
          employeeData.primaryDepartmentId = emp.departmentId;
        } else if (emp.departmentType === 'central') {
          employeeData.primaryCentralDeptId = emp.departmentId;
        }
      }

      await prisma.employeeDetails.create({
        data: employeeData
      });

      const deptName = emp.departmentType === 'academic' 
        ? academicDepartments.find(d => d.id === emp.departmentId)?.departmentName
        : centralDepartments.find(d => d.id === emp.departmentId)?.departmentName;
      console.log(`  ✅ Created: ${emp.displayName} → ${deptName || 'No Department'}`);
    }

    console.log('\n✅ Employee seeding completed!');
    console.log(`📊 Total employees processed: ${employees.length}`);
    console.log('\n🔑 Login credentials:');
    console.log('   Email: Any employee email from above');
    console.log('   Password: password123');

  } catch (error) {
    console.error('❌ Error seeding employees:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedEmployeesForGateEntry()
  .then(() => {
    console.log('\n🎉 Seeding successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
