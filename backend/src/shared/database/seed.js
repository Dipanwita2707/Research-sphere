const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const config = require('../config/app.config');
const { seedDefaultCategories } = require('../../modules/dsw/services/categoryService');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', config.bcrypt.rounds);
    const admin = await prisma.userLogin.upsert({
      where: { uid: 'admin' },
      update: {},
      create: {
        uid: 'admin',
        email: 'admin@sgtuniversity.edu',
        passwordHash: adminPassword,
        role: 'admin',
        status: 'active'
      }
    });
    console.log('✅ Admin created (uid: admin, password: admin123)');

    // Create test faculty member
    const facultyPassword = await bcrypt.hash('faculty123', config.bcrypt.rounds);
    const faculty = await prisma.userLogin.upsert({
      where: { uid: 'FAC001' },
      update: {},
      create: {
        uid: 'FAC001',
        email: 'faculty@sgtuniversity.edu',
        passwordHash: facultyPassword,
        role: 'faculty',
        status: 'active',
        employeeDetails: {
          create: {
            firstName: 'John',
            lastName: 'Doe',
            empId: 'EMP001',
            designation: 'Assistant Professor',
            isActive: true
          }
        }
      }
    });
    console.log('✅ Faculty created (uid: FAC001, password: faculty123)');

    // Create test staff member
    const staffPassword = await bcrypt.hash('staff123', config.bcrypt.rounds);
    const staff = await prisma.userLogin.upsert({
      where: { uid: 'STF001' },
      update: {},
      create: {
        uid: 'STF001',
        email: 'staff@sgtuniversity.edu',
        passwordHash: staffPassword,
        role: 'staff',
        status: 'active',
        employeeDetails: {
          create: {
            firstName: 'Jane',
            lastName: 'Smith',
            empId: 'EMP002',
            designation: 'Administrative Officer',
            isActive: true
          }
        }
      }
    });
    console.log('✅ Staff created (uid: STF001, password: staff123)');

    // Create faculty
    const engineeringFaculty = await prisma.facultySchoolList.upsert({
      where: { facultyCode: 'ENG' },
      update: {},
      create: {
        facultyCode: 'ENG',
        facultyName: 'Faculty of Engineering',
        facultyType: 'engineering',
        shortName: 'Engineering',
        isActive: true,
        headOfFacultyId: faculty.id
      }
    });
    console.log('✅ Engineering Faculty created');

    // Create department
    const csDepartment = await prisma.department.upsert({
      where: { departmentCode: 'CSE' },
      update: {},
      create: {
        facultyId: engineeringFaculty.id,
        departmentCode: 'CSE',
        departmentName: 'Computer Science & Engineering',
        shortName: 'CSE',
        isActive: true,
        headOfDepartmentId: faculty.id
      }
    });
    console.log('✅ CSE Department created');

    // Create program
    const btechProgram = await prisma.program.upsert({
      where: { programCode: 'BTECH-CSE' },
      update: {},
      create: {
        departmentId: csDepartment.id,
        programCode: 'BTECH-CSE',
        programName: 'Bachelor of Technology in Computer Science',
        programType: 'undergraduate',
        shortName: 'B.Tech CSE',
        durationYears: 4,
        durationSemesters: 8,
        admissionCapacity: 120,
        isActive: true,
        programCoordinatorId: faculty.id
      }
    });
    console.log('✅ B.Tech CSE Program created');

    // Create section
    const section = await prisma.section.upsert({
      where: {
        programId_sectionCode_academicYear_semester: {
          programId: btechProgram.id,
          sectionCode: 'A',
          academicYear: '2024-25',
          semester: 1
        }
      },
      update: {},
      create: {
        programId: btechProgram.id,
        sectionCode: 'A',
        sectionName: 'Section A',
        academicYear: '2024-25',
        semester: 1,
        batchYear: 2024,
        capacity: 60,
        classTeacherId: faculty.id,
        status: 'active'
      }
    });
    console.log('✅ Section A created');

    // Create test student
    const studentPassword = await bcrypt.hash('student123', config.bcrypt.rounds);
    const studentUser = await prisma.userLogin.upsert({
      where: { uid: 'STU123456789' },
      update: {},
      create: {
        uid: 'STU123456789',
        email: 'student@sgtuniversity.edu',
        passwordHash: studentPassword,
        role: 'student',
        status: 'active'
      }
    });

    const student = await prisma.studentDetails.upsert({
      where: { studentId: '2024001' },
      update: {},
      create: {
        userLoginId: studentUser.id,
        studentId: '2024001',
        registrationNo: '123456789',
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'student@sgtuniversity.edu',
        sectionId: section.id,
        programId: btechProgram.id,
        currentSemester: 1,
        isActive: true,
        dataEntryStatus: 'approved'
      }
    });
    console.log('✅ Student created (uid: STU123456789, password: student123)');

    // Create Central Departments
    const drdDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'DRD' },
      update: {},
      create: {
        departmentCode: 'DRD',
        departmentName: 'Director of Research and Development',
        shortName: 'DRD',
        departmentType: 'drd',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ DRD Department created');

    const registrarDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'REGISTRAR' },
      update: {},
      create: {
        departmentCode: 'REGISTRAR',
        departmentName: 'Registrar Office',
        shortName: 'Registrar',
        departmentType: 'registrar',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ Registrar Department created');

    const admissionsDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'ADMISSIONS' },
      update: {},
      create: {
        departmentCode: 'ADMISSIONS',
        departmentName: 'Admissions Office',
        shortName: 'Admissions',
        departmentType: 'admissions',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ Admissions Department created');

    const hrDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'HR' },
      update: {},
      create: {
        departmentCode: 'HR',
        departmentName: 'Human Resources',
        shortName: 'HR',
        departmentType: 'hr',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ HR Department created');

    const financeDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'FINANCE' },
      update: {},
      create: {
        departmentCode: 'FINANCE',
        departmentName: 'Finance Department',
        shortName: 'Finance',
        departmentType: 'finance',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ Finance Department created');

    // Noting workflow: DSW and Central Team (manage at /admin/central-departments; members get approval rights)
    const dswDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'DSW' },
      update: {},
      create: {
        departmentCode: 'DSW',
        departmentName: 'Department of Student Welfare',
        shortName: 'DSW',
        departmentType: 'noting',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ DSW Central Department created');

    const centralTeamDepartment = await prisma.centralDepartment.upsert({
      where: { departmentCode: 'CENTRAL_TEAM' },
      update: {},
      create: {
        departmentCode: 'CENTRAL_TEAM',
        departmentName: 'Central Team (Noting)',
        shortName: 'Central Team',
        departmentType: 'noting',
        isActive: true,
        headOfDepartmentId: admin.id
      }
    });
    console.log('✅ Central Team Central Department created');

    await prisma.centralDepartmentPermission.upsert({
      where: {
        userId_centralDeptId: { userId: admin.id, centralDeptId: dswDepartment.id }
      },
      update: {},
      create: {
        userId: admin.id,
        centralDeptId: dswDepartment.id,
        isPrimary: true,
        isActive: true,
        assignedBy: admin.id,
        permissions: { noting_approve: true },
        assignedSchoolIds: []
      }
    });
    await prisma.centralDepartmentPermission.upsert({
      where: {
        userId_centralDeptId: { userId: admin.id, centralDeptId: centralTeamDepartment.id }
      },
      update: {},
      create: {
        userId: admin.id,
        centralDeptId: centralTeamDepartment.id,
        isPrimary: true,
        isActive: true,
        assignedBy: admin.id,
        permissions: { noting_approve: true },
        assignedSchoolIds: []
      }
    });
    console.log('✅ DSW & Central Team permissions granted to admin for noting');

    // Grant central department permissions to admin for DRD
    await prisma.centralDepartmentPermission.upsert({
      where: {
        userId_centralDeptId: {
          userId: admin.id,
          centralDeptId: drdDepartment.id
        }
      },
      update: {},
      create: {
        userId: admin.id,
        centralDeptId: drdDepartment.id,
        isPrimary: true,
        isActive: true,
        assignedBy: admin.id,
        permissions: {
          research_view: true,
          research_review: true,
          research_approve: true,
          research_manage_policies: true
        },
        assignedSchoolIds: [],
        assignedResearchSchoolIds: []
      }
    });

    // Grant central department permissions to admin for IPR
    await prisma.centralDepartmentPermission.upsert({
      where: {
        userId_centralDeptId: {
          userId: admin.id,
          centralDeptId: iprDepartment.id
        }
      },
      update: {},
      create: {
        userId: admin.id,
        centralDeptId: iprDepartment.id,
        isPrimary: false,
        isActive: true,
        assignedBy: admin.id,
        permissions: {
          ipr_view: true,
          ipr_review: true,
          ipr_approve: true,
          ipr_manage_policies: true
        },
        assignedSchoolIds: [],
        assignedResearchSchoolIds: []
      }
    });
    console.log('✅ Central department permissions granted to admin');

    // Grant department permissions
    await prisma.userDepartmentPermission.upsert({
      where: {
        userId_department: {
          userId: faculty.id,
          department: 'REGISTRAR'
        }
      },
      update: {},
      create: {
        userId: faculty.id,
        department: 'REGISTRAR',
        permissions: {
          viewStudents: true,
          editStudents: false,
          approveData: true
        },
        isActive: true,
        assignedBy: admin.id
      }
    });
    console.log('✅ Permissions granted to faculty');

    // Seed DSW club categories
    console.log('\n📚 Seeding DSW club categories...');
    await seedDefaultCategories();
    console.log('✅ DSW club categories seeded');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Faculty: FAC001 / faculty123');
    console.log('   Staff: STF001 / staff123');
    console.log('   Student: STU123456789 / student123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

seedDatabase();
