
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'aisha.singh@sgt.edu';
    console.log(`Searching for user with email: ${email}`);

    const user = await prisma.userLogin.findUnique({
        where: { email },
        include: {
            employeeDetails: {
                include: {
                    primaryDepartment: true,
                    primarySchool: true,
                },
            },
            studentLogin: {
                include: {
                    program: {
                        include: {
                            department: {
                                include: {
                                    faculty: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User Found:', user.id);

    if (user.employeeDetails) {
        console.log('--- Employee Details ---');
        console.log('Employee ID:', user.employeeDetails.id);
        console.log('Primary Dept:', user.employeeDetails.primaryDepartment);
        console.log('Primary School:', user.employeeDetails.primarySchool);
    } else {
        console.log('No Employee Details');
    }

    if (user.studentLogin) {
        console.log('--- Student Details ---');
        console.log('Student ID:', user.studentLogin.id);
        console.log('Program ID (raw):', user.studentLogin.programId); // View the raw ID
        console.log('Program Object:', user.studentLogin.program);

        if (user.studentLogin.program) {
            console.log('Department:', user.studentLogin.program.department);
            if (user.studentLogin.program.department) {
                console.log('Faculty (School):', user.studentLogin.program.department.faculty);
            }
        }
    } else {
        console.log('No Student Details');
    }

    console.log('\n--- Checking for ANY student with a program ---');
    const studentWithProgram = await prisma.studentDetails.findFirst({
        where: {
            programId: { not: null }
        },
        include: {
            program: {
                include: {
                    department: {
                        include: {
                            faculty: true
                        }
                    }
                }
            },
            userLogin: true
        }
    });

    if (studentWithProgram) {
        console.log('Found Student:', studentWithProgram.firstName, studentWithProgram.lastName);
        console.log('Program:', studentWithProgram.program?.programName);

        const programId = studentWithProgram.programId;
        console.log('Using Program ID:', programId);

        // Update Aisha Singh
        if (user.studentLogin && !user.studentLogin.programId) {
            console.log('Updating Aisha Singh with Program ID...');
            await prisma.studentDetails.update({
                where: { id: user.studentLogin.id },
                data: { programId: programId }
            });
            console.log('Update successful! Refresh the frontend.');
        } else {
            console.log('Aisha Singh already has a program or is not a student.');
        }

        console.log('Email:', studentWithProgram.userLogin?.email);
        console.log('Department:', studentWithProgram.program?.department?.departmentName);
        console.log('Faculty:', studentWithProgram.program?.department?.faculty?.facultyName);
    } else {
        console.log('No students with programs found in the database.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
