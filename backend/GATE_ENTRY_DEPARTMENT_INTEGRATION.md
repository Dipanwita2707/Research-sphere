# Gate Entry - Department-Employee Integration

## ✅ Completed Changes

### 1. Employee-Department Assignment (Backend)
**File**: `backend/scripts/database/seeds/seed-employees-for-gate-entry.js`

Updated seed script to assign departments to all employees:

| Employee | Department | Type |
|----------|-----------|------|
| Dr. Rajesh Sharma | Computer Science & Engineering | Academic |
| Dr. Priya Verma | Electronics & Communication Engineering | Academic |
| Prof. Amit Kumar | Mechanical Engineering | Academic |
| Mr. Vikram Singh | Administration | Central |
| Ms. Sneha Gupta | Human Resources | Central |
| Dr. Rahul Patel | Computer Science & Engineering | Academic |
| Dr. Anjali Mehta | Civil Engineering | Central |
| Mr. Suresh Reddy | Finance | Central |

**Changes**:
- Fetches both `Department` and `CentralDepartment` tables
- Maps employees to appropriate departments during seeding
- Sets `primaryDepartmentId` for academic faculty
- Sets `primaryCentralDeptId` for administrative staff
- Updates existing employees if they already exist

### 2. Employee Service Fix (Backend)
**File**: `backend/src/modules/gate-entry/services/employee.service.js`

Fixed field name inconsistency:
```javascript
// ❌ BEFORE
primaryCentralDept: {
  select: {
    id: true,
    deptName: true  // Wrong field name
  }
}

// ✅ AFTER
primaryCentralDept: {
  select: {
    id: true,
    departmentName: true  // Correct field name
  }
}

// Department name extraction
const department = emp.primaryDepartment?.departmentName || 
                  emp.primaryCentralDept?.departmentName ||  // Fixed from deptName
                  'N/A';
```

### 3. Frontend Department-Employee Filtering
**File**: `frontend/src/app/admin/gate-entry/create-pass/page.tsx`

**Added State**:
```typescript
const [departments, setDepartments] = useState<Department[]>([]);
const [loadingDepartments, setLoadingDepartments] = useState(false);
```

**Department Fetch**:
```typescript
useEffect(() => {
  const fetchDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const response = await gateEntryService.getActiveDepartments();
      console.log('Departments response:', response);
      
      if (response.success && response.data?.departments) {
        setDepartments(response.data.departments);
        console.log('Departments loaded:', response.data.count);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoadingDepartments(false);
    }
  };

  fetchDepartments();
}, []);
```

**Filtering Logic**:
```typescript
// Clear employee selection when department changes
if (name === 'departmentToVisit') {
  setFormData(prev => ({
    ...prev,
    departmentToVisit: value,
    personToMeetId: '',
    personToMeetName: ''
  }));
  return;
}

// Filter employees by department
const filteredEmployees = employees.filter(emp => {
  if (!formData.departmentToVisit) return true;
  const empDept = emp.department.toLowerCase();
  const selectedDept = formData.departmentToVisit.toLowerCase();
  return empDept.includes(selectedDept) || selectedDept.includes(empDept);
});
```

**UI Enhancements**:
```jsx
{/* Department Dropdown */}
<select
  disabled={loadingDepartments}
  value={formData.departmentToVisit}
  onChange={handleInputChange}
>
  <option value="">Select Department to Visit</option>
  {departments.map(dept => (
    <option key={dept.id} value={dept.name}>
      {dept.name} {dept.shortName ? `(${dept.shortName})` : ''}
    </option>
  ))}
</select>

{/* Employee Dropdown */}
<select
  disabled={loadingEmployees || !formData.departmentToVisit}
  value={formData.personToMeetId}
  onChange={handleInputChange}
>
  <option value="">
    {!formData.departmentToVisit 
      ? 'First select a department'
      : filteredEmployees.length === 0
      ? 'No employees in this department'
      : 'Select Employee'
    }
  </option>
  {filteredEmployees.map(emp => (
    <option key={emp.userLoginId} value={emp.userLoginId}>
      {emp.name} - {emp.designation}
    </option>
  ))}
</select>

{/* Helper Text */}
<p className="text-sm">
  {!formData.departmentToVisit ? (
    <span className="text-blue-600">
      Please select a department first to see available employees
    </span>
  ) : filteredEmployees.length > 0 ? (
    <span className="text-gray-600">
      {filteredEmployees.length} employees available in this department
    </span>
  ) : (
    <span className="text-amber-600">
      No employees found in this department
    </span>
  )}
</p>
```

## 🧪 Testing Instructions

### 1. Start Servers
```bash
# Backend (Port 5001)
cd backend
npm run dev

# Frontend (Port 3000)
cd frontend
npm run dev
```

### 2. Test Department-Employee Filtering

1. **Open Browser**: Navigate to `http://localhost:3000/admin/gate-entry/create-pass`

2. **Test Scenario 1: CSE Department**
   - Select "Computer Science & Engineering (CSE)" from Department dropdown
   - Person to Meet dropdown should show:
     - Dr. Rajesh Sharma
     - Dr. Rahul Patel
   - Helper text should show: "2 employees available in this department"

3. **Test Scenario 2: HR Department**
   - Select "Human Resources (HR)" from Department dropdown
   - Person to Meet dropdown should show:
     - Ms. Sneha Gupta
   - Helper text should show: "1 employees available in this department"

4. **Test Scenario 3: Administration**
   - Select "Administration (ADMIN)" from Department dropdown
   - Person to Meet dropdown should show:
     - Mr. Vikram Singh
   - Helper text should show: "1 employees available in this department"

5. **Test Scenario 4: Department Change**
   - Select "Computer Science & Engineering"
   - Select "Dr. Rajesh Sharma" as Person to Meet
   - Change department to "Human Resources"
   - Verify that Person to Meet is cleared (reset to "Select Employee")
   - Verify that only Ms. Sneha Gupta appears in dropdown

6. **Test Scenario 5: No Department Selected**
   - Clear department selection (select "Select Department to Visit")
   - Verify Person to Meet dropdown is disabled
   - Verify helper text shows: "Please select a department first to see available employees"

### 3. Verify Database

Check employee-department assignments in database:
```sql
SELECT 
  ed.display_name,
  d.department_name as academic_dept,
  cd.department_name as central_dept,
  ul.role
FROM employee_details ed
LEFT JOIN user_login ul ON ul.id = ed.user_login_id
LEFT JOIN department d ON d.id = ed.primary_department_id
LEFT JOIN central_department cd ON cd.id = ed.primary_central_dept_id
WHERE ed.is_active = true
ORDER BY ed.display_name;
```

## 📊 Department Distribution

**Academic Departments (4)**:
- Computer Science & Engineering (CSE) - 2 faculty
- Electronics & Communication Engineering (ECE) - 1 faculty
- Mechanical Engineering (ME) - 1 faculty
- Civil Engineering (CIVIL) - 1 faculty

**Central Departments (5)**:
- Administration (ADMIN) - 1 staff
- Human Resources (HR) - 1 staff
- Finance (FIN) - 1 staff
- Library (LIB) - 0 staff
- Registrar Office (REG) - 0 staff

**Total**: 9 departments, 8 employees

## 🔍 API Endpoints

### Get Active Departments
```
GET /api/v1/gate-entry/departments
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Departments fetched successfully",
  "data": {
    "departments": [
      {
        "id": "uuid",
        "code": "CSE",
        "name": "Computer Science & Engineering",
        "shortName": "CS",
        "type": "academic",
        "faculty": "Faculty of Engineering"
      },
      ...
    ],
    "count": 9
  }
}
```

### Get Active Employees
```
GET /api/v1/gate-entry/employees
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Employees fetched successfully",
  "data": {
    "employees": [
      {
        "id": "uuid",
        "userLoginId": "uuid",
        "name": "Dr. Rajesh Sharma",
        "empId": "EMP001",
        "designation": "Professor & HOD",
        "department": "Computer Science & Engineering",
        "email": "rajesh.sharma@university.edu",
        "phone": "+91-9876543210",
        "role": "faculty"
      },
      ...
    ],
    "count": 8
  }
}
```

## ✅ Expected Behavior

1. **Department dropdown** fetches real data from database (not hardcoded)
2. **Employee dropdown** is disabled until department is selected
3. **Filtering** shows only employees from selected department
4. **Helper text** provides contextual guidance:
   - Blue: Select department first
   - Gray: X employees available
   - Amber: No employees found
5. **State clearing**: Changing department clears selected employee
6. **Case-insensitive matching**: Filtering uses `includes()` for fuzzy matching

## 🐛 Known Issues & Solutions

### Issue 1: employees.department is "N/A"
**Cause**: Employee doesn't have department assigned  
**Solution**: Run seed script to assign departments

### Issue 2: No employees showing after department selection
**Cause**: Department name mismatch between employee.department and formData.departmentToVisit  
**Solution**: Uses `includes()` for fuzzy matching (case-insensitive)

### Issue 3: "deptName" field error
**Cause**: CentralDepartment uses `departmentName` not `deptName`  
**Solution**: Fixed in employee.service.js

## 📝 Next Steps

1. ✅ Department-employee filtering implemented
2. ⏳ Photo upload with multer
3. ⏳ QR code generation
4. ⏳ Email/SMS notifications
5. ⏳ Verify Pass page integration
6. ⏳ End-to-end testing with all validations

## 🔗 Related Files

- Backend Service: `backend/src/modules/gate-entry/services/employee.service.js`
- Backend Controller: `backend/src/modules/gate-entry/controllers/employee.controller.js`
- Backend Routes: `backend/src/modules/gate-entry/routes/gatePass.routes.js`
- Frontend Service: `frontend/src/shared/services/gateEntry.service.ts`
- Frontend Page: `frontend/src/app/admin/gate-entry/create-pass/page.tsx`
- Seed Script: `backend/scripts/database/seeds/seed-employees-for-gate-entry.js`
- Department Seed: `backend/scripts/database/seeds/seed-departments-for-gate-entry.js`
