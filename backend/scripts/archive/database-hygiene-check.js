/**
 * Database Hygiene Check Script
 * 
 * This script analyzes the database for:
 * - Data integrity issues
 * - Orphaned records
 * - Missing relationships
 * - Duplicate data
 * - Inconsistent data
 * - Performance issues
 * 
 * Usage:
 *   node scripts/database-hygiene-check.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const issues = {
  critical: [],
  warning: [],
  info: []
};

function logCritical(message) {
  console.log(`${colors.red}❌ CRITICAL:${colors.reset} ${message}`);
  issues.critical.push(message);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  WARNING:${colors.reset} ${message}`);
  issues.warning.push(message);
}

function logInfo(message) {
  console.log(`${colors.cyan}ℹ️  INFO:${colors.reset} ${message}`);
  issues.info.push(message);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

async function checkUserIntegrity() {
  console.log(`\n${colors.blue}=== User Data Integrity ===${colors.reset}`);
  
  // Check for users without proper details
  const usersWithoutDetails = await prisma.userLogin.findMany({
    where: {
      AND: [
        { employeeDetails: null },
        { studentLogin: null }
      ]
    },
    select: { uid: true, role: true, email: true }
  });
  
  if (usersWithoutDetails.length > 0) {
    logWarning(`${usersWithoutDetails.length} users without employee or student details`);
    usersWithoutDetails.slice(0, 5).forEach(u => {
      logInfo(`  - ${u.uid} (${u.role})`);
    });
  } else {
    logSuccess('All users have proper details');
  }
  
  // Check for inactive users
  const inactiveUsers = await prisma.userLogin.count({
    where: { status: { not: 'active' } }
  });
  
  if (inactiveUsers > 0) {
    logInfo(`${inactiveUsers} inactive users in database`);
  }
  
  // Check for duplicate UIDs
  const duplicateUIDs = await prisma.$queryRaw`
    SELECT uid, COUNT(*) as count
    FROM user_login
    GROUP BY uid
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateUIDs.length > 0) {
    logCritical(`${duplicateUIDs.length} duplicate UIDs found!`);
    duplicateUIDs.forEach(d => {
      logInfo(`  - UID: ${d.uid} (${d.count} occurrences)`);
    });
  } else {
    logSuccess('No duplicate UIDs found');
  }
  
  // Check for users without passwords (passwordHash is required, so check for empty strings only)
  const usersWithoutPassword = await prisma.userLogin.count({
    where: {
      passwordHash: ''
    }
  });
  
  if (usersWithoutPassword > 0) {
    logCritical(`${usersWithoutPassword} users without passwords!`);
  } else {
    logSuccess('All users have passwords');
  }
}

async function checkOrphanedRecords() {
  console.log(`\n${colors.blue}=== Orphaned Records ===${colors.reset}`);
  
  // Check for employee details without user login
  const orphanedEmployees = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM employee_details ed
    WHERE NOT EXISTS (
      SELECT 1 FROM user_login ul WHERE ul.id = ed.user_login_id
    )
  `;
  
  if (orphanedEmployees[0].count > 0) {
    logWarning(`${orphanedEmployees[0].count} orphaned employee records`);
  } else {
    logSuccess('No orphaned employee records');
  }
  
  // Check for student details without user login
  const orphanedStudents = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM student_details sd
    WHERE NOT EXISTS (
      SELECT 1 FROM user_login ul WHERE ul.id = sd.user_login_id
    )
  `;
  
  if (orphanedStudents[0].count > 0) {
    logWarning(`${orphanedStudents[0].count} orphaned student records`);
  } else {
    logSuccess('No orphaned student records');
  }
  
  // Check for programs without departments (departmentId is required, so this shouldn't happen)
  // But we can check for programs pointing to non-existent departments
  const programsWithInvalidDept = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM program p
    WHERE NOT EXISTS (
      SELECT 1 FROM department d WHERE d.id = p.department_id
    )
  `;
  
  if (programsWithInvalidDept[0].count > 0) {
    logWarning(`${programsWithInvalidDept[0].count} programs with invalid department references`);
  } else {
    logSuccess('All programs have valid department references');
  }
}

async function checkDataConsistency() {
  console.log(`\n${colors.blue}=== Data Consistency ===${colors.reset}`);
  
  // Check for students without programs (programId is nullable, so this is valid)
  const studentsWithoutProgram = await prisma.studentDetails.count({
    where: { programId: null }
  });
  
  if (studentsWithoutProgram > 0) {
    logInfo(`${studentsWithoutProgram} students without programs (may be pending assignment)`);
  } else {
    logSuccess('All students have programs');
  }
  
  // Check for employees without any department assignment
  const employeesWithoutDepartment = await prisma.employeeDetails.count({
    where: {
      AND: [
        { primaryDepartmentId: null },
        { primarySchoolId: null },
        { primaryCentralDeptId: null }
      ]
    }
  });
  
  if (employeesWithoutDepartment > 0) {
    logWarning(`${employeesWithoutDepartment} employees without any department assignment`);
  } else {
    logSuccess('All employees have department assignments');
  }
  
  // Check for invalid email formats
  const invalidEmails = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM user_login
    WHERE email IS NOT NULL 
    AND email != ''
    AND email NOT LIKE '%@%.%'
  `;
  
  if (invalidEmails[0].count > 0) {
    logWarning(`${invalidEmails[0].count} users with invalid email formats`);
  } else {
    logSuccess('All emails have valid formats');
  }
  
  // Check for students with invalid program references
  const studentsWithInvalidProgram = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM student_details sd
    WHERE sd.program_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM program p WHERE p.id = sd.program_id
    )
  `;
  
  if (studentsWithInvalidProgram[0].count > 0) {
    logCritical(`${studentsWithInvalidProgram[0].count} students with invalid program references!`);
  } else {
    logSuccess('All student program references are valid');
  }
}

async function checkDuplicateData() {
  console.log(`\n${colors.blue}=== Duplicate Data ===${colors.reset}`);
  
  // Check for duplicate schools
  const duplicateSchools = await prisma.$queryRaw`
    SELECT faculty_name, faculty_code, COUNT(*) as count
    FROM faculty_school_list
    GROUP BY faculty_name, faculty_code
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateSchools.length > 0) {
    logWarning(`${duplicateSchools.length} duplicate schools found`);
    duplicateSchools.forEach(s => {
      logInfo(`  - ${s.faculty_name} (${s.faculty_code}): ${s.count} occurrences`);
    });
  } else {
    logSuccess('No duplicate schools');
  }
  
  // Check for duplicate departments
  const duplicateDepartments = await prisma.$queryRaw`
    SELECT department_name, department_code, COUNT(*) as count
    FROM department
    GROUP BY department_name, department_code
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateDepartments.length > 0) {
    logWarning(`${duplicateDepartments.length} duplicate departments found`);
  } else {
    logSuccess('No duplicate departments');
  }
  
  // Check for duplicate programs
  const duplicatePrograms = await prisma.$queryRaw`
    SELECT program_name, program_code, COUNT(*) as count
    FROM program
    GROUP BY program_name, program_code
    HAVING COUNT(*) > 1
  `;
  
  if (duplicatePrograms.length > 0) {
    logWarning(`${duplicatePrograms.length} duplicate programs found`);
  } else {
    logSuccess('No duplicate programs');
  }
}

async function checkDatabaseStats() {
  console.log(`\n${colors.blue}=== Database Statistics ===${colors.reset}`);
  
  const stats = {};
  
  // Safely get each count with error handling
  try {
    stats.users = await prisma.userLogin.count();
  } catch (e) {
    stats.users = 'N/A';
    logWarning(`Could not count users: ${e.message}`);
  }
  
  try {
    stats.activeUsers = await prisma.userLogin.count({ where: { status: 'active' } });
  } catch (e) {
    stats.activeUsers = 'N/A';
  }
  
  try {
    stats.students = await prisma.studentDetails.count();
  } catch (e) {
    stats.students = 'N/A';
    logWarning(`Could not count students: ${e.message}`);
  }
  
  try {
    stats.employees = await prisma.employeeDetails.count();
  } catch (e) {
    stats.employees = 'N/A';
    logWarning(`Could not count employees: ${e.message}`);
  }
  
  try {
    stats.schools = await prisma.facultySchoolList.count();
  } catch (e) {
    stats.schools = 'N/A';
    logWarning(`Could not count schools: ${e.message}`);
  }
  
  try {
    stats.departments = await prisma.department.count();
  } catch (e) {
    stats.departments = 'N/A';
    logWarning(`Could not count departments: ${e.message}`);
  }
  
  try {
    stats.programs = await prisma.program.count();
  } catch (e) {
    stats.programs = 'N/A';
    logWarning(`Could not count programs: ${e.message}`);
  }
  
  // Try to get bug reports count (table might not exist)
  try {
    stats.bugReports = await prisma.bugReport.count();
  } catch (e) {
    stats.bugReports = 'N/A';
  }
  
  // Try to get loan letters count (table might not exist)
  try {
    stats.loanLetters = await prisma.loanLetter.count();
  } catch (e) {
    stats.loanLetters = 'N/A';
  }
  
  console.log(`\n${colors.cyan}Total Records:${colors.reset}`);
  console.log(`  Users: ${stats.users} (${stats.activeUsers} active)`);
  console.log(`  Students: ${stats.students}`);
  console.log(`  Employees: ${stats.employees}`);
  console.log(`  Schools: ${stats.schools}`);
  console.log(`  Departments: ${stats.departments}`);
  console.log(`  Programs: ${stats.programs}`);
  console.log(`  Bug Reports: ${stats.bugReports}`);
  console.log(`  Loan Letters: ${stats.loanLetters}`);
  
  // Check for empty critical tables (only if we got valid counts)
  if (typeof stats.schools === 'number' && stats.schools === 0) {
    logCritical('No schools in database!');
  }
  if (typeof stats.departments === 'number' && stats.departments === 0) {
    logCritical('No departments in database!');
  }
  if (typeof stats.programs === 'number' && stats.programs === 0) {
    logWarning('No programs in database');
  }
  
  return stats;
}

async function checkPermissions() {
  console.log(`\n${colors.blue}=== Permissions & Access Control ===${colors.reset}`);
  
  // Check for users without permissions
  const usersWithoutPermissions = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM user_login ul
    WHERE ul.role IN ('faculty', 'staff')
    AND NOT EXISTS (
      SELECT 1 FROM department_permission dp 
      WHERE dp.user_id = ul.id AND dp.is_active = true
    )
  `;
  
  if (usersWithoutPermissions[0].count > 0) {
    logWarning(`${usersWithoutPermissions[0].count} faculty/staff without permissions`);
  } else {
    logSuccess('All faculty/staff have permissions');
  }
  
  // Check for inactive permissions
  const inactivePermissions = await prisma.departmentPermission.count({
    where: { isActive: false }
  });
  
  if (inactivePermissions > 0) {
    logInfo(`${inactivePermissions} inactive permissions in database`);
  }
}

async function checkRecentActivity() {
  console.log(`\n${colors.blue}=== Recent Activity ===${colors.reset}`);
  
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Recent logins
  const recentLogins = await prisma.userLogin.count({
    where: {
      lastLoginAt: {
        gte: last24Hours
      }
    }
  });
  
  console.log(`  Logins (last 24h): ${recentLogins}`);
  
  // Recent bug reports
  try {
    const recentBugReports = await prisma.bugReport.count({
      where: {
        createdAt: {
          gte: last7Days
        }
      }
    });
    console.log(`  Bug Reports (last 7d): ${recentBugReports}`);
  } catch (e) {
    console.log(`  Bug Reports (last 7d): N/A`);
  }
  
  // Recent loan letters
  try {
    const recentLoanLetters = await prisma.loanLetter.count({
      where: {
        createdAt: {
          gte: last7Days
        }
      }
    });
    console.log(`  Loan Letters (last 7d): ${recentLoanLetters}`);
  } catch (e) {
    console.log(`  Loan Letters (last 7d): N/A`);
  }
}

async function generateReport() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Database Hygiene Report${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  try {
    await checkDatabaseStats();
    await checkUserIntegrity();
    await checkOrphanedRecords();
    await checkDataConsistency();
    await checkDuplicateData();
    await checkPermissions();
    await checkRecentActivity();
    
    // Summary
    console.log(`\n${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}Summary${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);
    
    console.log(`${colors.red}Critical Issues: ${issues.critical.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${issues.warning.length}${colors.reset}`);
    console.log(`${colors.cyan}Info: ${issues.info.length}${colors.reset}`);
    
    if (issues.critical.length === 0 && issues.warning.length === 0) {
      console.log(`\n${colors.green}🎉 Database hygiene is excellent! No critical issues or warnings found.${colors.reset}\n`);
    } else if (issues.critical.length === 0) {
      console.log(`\n${colors.yellow}⚠️  Database hygiene is good, but there are some warnings to address.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}❌ Database has critical issues that need immediate attention!${colors.reset}\n`);
    }
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        critical: issues.critical.length,
        warnings: issues.warning.length,
        info: issues.info.length
      },
      issues: issues
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportFile = path.join(__dirname, 'database-hygiene-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`${colors.cyan}Report saved to: ${reportFile}${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Error during hygiene check:${colors.reset}`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

generateReport();