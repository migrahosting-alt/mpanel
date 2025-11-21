# HR & Employee Management System - Complete Guide

**Date**: November 18, 2025  
**Status**: ✅ Production Ready  
**Version**: 1.0.0

---

## 🎯 Overview

The HR & Employee Management System is a comprehensive solution for managing employees, departments, onboarding, time off, performance reviews, and more. It's fully integrated with mPanel's RBAC system.

---

## 📊 Features

### ✅ Core Features
1. **Department Management** - Hierarchical org structure with budgets
2. **Employee Profiles** - Extended user data with job titles, hire dates, salaries
3. **Automated Onboarding** - 13 default tasks with progress tracking
4. **Time Off Management** - Vacation, sick leave, approval workflows
5. **Performance Reviews** - Annual/quarterly reviews with ratings
6. **Employee Documents** - Contracts, certificates, resumes
7. **HR Analytics** - Employee stats, department metrics, hiring trends

### 🔐 Security & Access Control
- **10 HR-specific permissions** across admin, HR, and manager roles
- **Multi-tenant isolation** - Each company sees only their employees
- **Encrypted sensitive data** - Salaries, documents, personal info
- **Audit logging** - All HR actions tracked

---

## 🗄️ Database Schema

### Tables Created

#### 1. `departments`
```sql
- id (UUID)
- tenant_id (UUID) → tenants(id)
- name (VARCHAR 100) - "Engineering", "Sales", etc.
- code (VARCHAR 20) - "ENG", "SALES" (unique)
- description (TEXT)
- manager_id (UUID) → users(id) - Department head
- parent_department_id (UUID) - For nested departments
- location (VARCHAR 255) - Office location
- budget_allocated (DECIMAL 12,2)
- employee_count (INTEGER) - Auto-updated trigger
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 2. `employee_profiles`
```sql
- id (UUID)
- user_id (UUID) → users(id) - Links to user account
- tenant_id (UUID)
- employee_id (VARCHAR 50) - Company employee ID (EMP-001)
- department_id (UUID) → departments(id)
- job_title (VARCHAR 100) - "Senior Engineer", "Sales Manager"
- employment_type (VARCHAR 50) - full_time, part_time, contractor, intern
- work_location (VARCHAR 100) - remote, office, hybrid
- hire_date (DATE)
- termination_date (DATE)
- manager_id (UUID) → users(id) - Direct manager
- salary (DECIMAL 12,2) - Encrypted in production
- salary_currency (VARCHAR 3) - USD, EUR, GBP
- hourly_rate (DECIMAL 10,2)
- commission_rate (DECIMAL 5,2) - For sales staff
- phone_work, phone_mobile (VARCHAR 50)
- emergency_contact_name, emergency_contact_phone
- address_line1, address_line2, city, state, postal_code, country
- timezone (VARCHAR 50)
- skills (JSONB) - ["JavaScript", "React", "Node.js"]
- certifications (JSONB) - [{"name": "AWS", "date": "2024-01-01"}]
- performance_notes, notes (TEXT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 3. `onboarding_tasks`
```sql
- id (UUID)
- tenant_id (UUID)
- department_id (UUID) - Department-specific tasks
- title (VARCHAR 255) - "Complete welcome orientation"
- description (TEXT)
- task_order (INTEGER) - Display order
- assigned_to (VARCHAR 50) - employee, manager, hr, it
- due_days_after_hire (INTEGER) - Days after hire date
- is_required (BOOLEAN)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 4. `employee_onboarding_progress`
```sql
- id (UUID)
- employee_id (UUID) → users(id)
- onboarding_task_id (UUID) → onboarding_tasks(id)
- tenant_id (UUID)
- status (VARCHAR 50) - pending, in_progress, completed, skipped
- assigned_to (UUID) → users(id)
- due_date (DATE)
- completed_at (TIMESTAMP)
- completed_by (UUID) → users(id)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)
```

#### 5. `time_off_requests`
```sql
- id (UUID)
- employee_id (UUID) → users(id)
- tenant_id (UUID)
- request_type (VARCHAR 50) - vacation, sick, personal, unpaid
- start_date, end_date (DATE)
- total_days (DECIMAL 3,1) - Auto-calculated
- reason (TEXT)
- status (VARCHAR 50) - pending, approved, rejected, cancelled
- approved_by (UUID) → users(id)
- approved_at (TIMESTAMP)
- rejection_reason (TEXT)
- created_at, updated_at (TIMESTAMP)
```

#### 6. `employee_documents`
```sql
- id (UUID)
- employee_id (UUID) → users(id)
- tenant_id (UUID)
- document_type (VARCHAR 100) - resume, contract, id, certificate
- document_name (VARCHAR 255)
- file_path (VARCHAR 500)
- file_size (INTEGER)
- mime_type (VARCHAR 100)
- uploaded_by (UUID) → users(id)
- is_confidential (BOOLEAN)
- expiry_date (DATE)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)
```

#### 7. `performance_reviews`
```sql
- id (UUID)
- employee_id (UUID) → users(id)
- reviewer_id (UUID) → users(id) - Usually manager
- tenant_id (UUID)
- review_period_start, review_period_end (DATE)
- review_type (VARCHAR 50) - annual, quarterly, probation, promotion
- overall_rating (DECIMAL 3,2) - 0.00 to 5.00
- technical_skills_rating, communication_rating, teamwork_rating, leadership_rating (DECIMAL 3,2)
- strengths, areas_for_improvement, goals_next_period (TEXT)
- employee_comments (TEXT)
- status (VARCHAR 50) - draft, submitted, acknowledged
- submitted_at, acknowledged_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

---

## 🔌 API Endpoints

### Departments

**GET** `/api/hr/departments`  
Get all departments  
**Permission**: `hr.view_employees`

**GET** `/api/hr/departments/:id`  
Get department by ID  
**Permission**: `hr.view_employees`

**POST** `/api/hr/departments`  
Create new department  
**Permission**: `hr.manage_departments`  
**Body**:
```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Software development team",
  "manager_id": "uuid-of-manager",
  "location": "New York",
  "budget_allocated": 500000.00
}
```

**PUT** `/api/hr/departments/:id`  
Update department  
**Permission**: `hr.manage_departments`

**GET** `/api/hr/analytics/departments`  
Get department stats (employee counts, budgets)  
**Permission**: `hr.view_employees`

### Employee Profiles

**GET** `/api/hr/employees`  
Get all employees  
**Permission**: `hr.view_employees`  
**Query params**:
- `department_id` - Filter by department
- `employment_type` - full_time, part_time, contractor, intern
- `is_active` - true/false

**GET** `/api/hr/employees/:userId`  
Get employee profile  
**Permission**: `hr.view_employees`

**POST** `/api/hr/employees`  
Create employee profile  
**Permission**: `hr.manage_employees`  
**Body**:
```json
{
  "userId": "uuid-of-user-account",
  "employee_id": "EMP-001",
  "department_id": "uuid-of-department",
  "job_title": "Senior Software Engineer",
  "employment_type": "full_time",
  "work_location": "remote",
  "hire_date": "2024-01-15",
  "manager_id": "uuid-of-manager",
  "salary": 120000.00,
  "phone_work": "+1-555-0100",
  "phone_mobile": "+1-555-0101",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+1-555-0102",
  "address_line1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postal_code": "10001",
  "country": "USA",
  "timezone": "America/New_York",
  "skills": ["JavaScript", "React", "Node.js", "PostgreSQL"]
}
```

**PUT** `/api/hr/employees/:userId`  
Update employee profile  
**Permission**: `hr.manage_employees`

**GET** `/api/hr/analytics/employees`  
Get employee stats (total, active, new hires, etc.)  
**Permission**: `hr.view_employees`

### Onboarding

**GET** `/api/hr/employees/:userId/onboarding`  
Get onboarding progress for employee  
**Permission**: `hr.view_employees`  
**Response**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "title": "Complete welcome orientation",
        "status": "completed",
        "due_date": "2024-01-15",
        "completed_at": "2024-01-15T10:30:00Z"
      }
    ],
    "stats": {
      "total": 13,
      "completed": 8,
      "pending": 3,
      "in_progress": 2,
      "completion_rate": 61.5
    }
  }
}
```

**PUT** `/api/hr/onboarding/:progressId`  
Update onboarding task status  
**Permission**: `hr.manage_onboarding`  
**Body**:
```json
{
  "status": "completed",
  "notes": "Employee completed orientation successfully"
}
```

### Time Off

**GET** `/api/hr/time-off`  
Get all time off requests  
**Permission**: `hr.view_time_off`  
**Query params**:
- `employee_id` - Filter by employee
- `status` - pending, approved, rejected, cancelled

**POST** `/api/hr/time-off`  
Create time off request (any employee can create for themselves)  
**Body**:
```json
{
  "request_type": "vacation",
  "start_date": "2024-07-01",
  "end_date": "2024-07-05",
  "reason": "Family vacation"
}
```

**POST** `/api/hr/time-off/:id/approve`  
Approve time off request  
**Permission**: `hr.manage_time_off`

**POST** `/api/hr/time-off/:id/reject`  
Reject time off request  
**Permission**: `hr.manage_time_off`  
**Body**:
```json
{
  "reason": "Insufficient leave balance"
}
```

---

## 🔐 Permissions

### New Permissions Added
```sql
hr.view_employees       - View employee profiles and information
hr.manage_employees     - Create and edit employee profiles
hr.manage_departments   - Create and manage departments
hr.view_reviews         - View performance reviews
hr.manage_reviews       - Create and manage performance reviews
hr.view_time_off        - View time off requests
hr.manage_time_off      - Approve/reject time off requests
hr.view_documents       - View employee documents
hr.manage_documents     - Upload and manage employee documents
hr.manage_onboarding    - Manage onboarding process and tasks
```

### Role Assignments
- **Admin** → All HR permissions
- **HR Role** (customer_service) → All HR permissions
- **Managers** → `hr.view_employees`, `hr.view_time_off`, `hr.manage_time_off` (for their team)

---

## 📝 Default Data

### 10 Default Departments
1. **Engineering** (ENG)
2. **Sales** (SALES)
3. **Support** (SUPPORT)
4. **Marketing** (MARKETING)
5. **Finance** (FINANCE)
6. **Human Resources** (HR)
7. **Operations** (OPS)
8. **Product** (PRODUCT)
9. **Legal** (LEGAL)
10. **Executive** (EXEC)

### 13 Default Onboarding Tasks

**Day 1**:
1. Complete welcome orientation
2. Set up workstation
3. Sign employment contract

**Week 1**:
4. Submit tax forms (Day 1)
5. Complete security training (Day 3)
6. Set up access credentials (Day 1)
7. Meet with manager (Day 1)
8. Department introduction (Day 3)
9. Enroll in benefits (Day 7)

**Month 1**:
10. Complete product training (Day 14)
11. Submit emergency contact info (Day 7)
12. 30-day check-in (Day 30)

**Month 3**:
13. 90-day probation review (Day 90)

---

## 🚀 Usage Examples

### Example 1: Hire New Employee

```bash
# Step 1: Create user account
POST /api/users
{
  "email": "john.doe@company.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "role": "editor"
}
# Returns: { "user": { "id": "user-uuid", ... } }

# Step 2: Create employee profile
POST /api/hr/employees
{
  "userId": "user-uuid",
  "employee_id": "EMP-101",
  "department_id": "engineering-dept-uuid",
  "job_title": "Software Engineer",
  "employment_type": "full_time",
  "hire_date": "2024-12-01",
  "manager_id": "manager-uuid",
  "salary": 95000.00
}
# Automatically creates 13 onboarding tasks!

# Step 3: Check onboarding progress
GET /api/hr/employees/user-uuid/onboarding
# Returns onboarding tasks with completion status
```

### Example 2: Request Time Off

```bash
# Employee creates request
POST /api/hr/time-off
{
  "request_type": "vacation",
  "start_date": "2024-12-20",
  "end_date": "2024-12-27",
  "reason": "Holiday vacation"
}

# Manager approves
POST /api/hr/time-off/{request-id}/approve

# Or rejects
POST /api/hr/time-off/{request-id}/reject
{
  "reason": "Team coverage needed during this period"
}
```

### Example 3: Department Analytics

```bash
GET /api/hr/analytics/departments

# Returns:
{
  "data": [
    {
      "id": "uuid",
      "name": "Engineering",
      "code": "ENG",
      "employee_count": 12,
      "budget_allocated": 1200000.00,
      "manager_name": "Sarah Johnson"
    },
    ...
  ]
}
```

---

## 🛠️ Installation

### 1. Run Migration

```bash
# From project root
docker exec mpanel-postgres psql -U mpanel -d mpanel -f prisma/migrations/20251118_employee_management_system/migration.sql
```

### 2. Verify Tables Created

```bash
docker exec -it mpanel-postgres psql -U mpanel -d mpanel -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('departments', 'employee_profiles', 'onboarding_tasks', 'time_off_requests')
ORDER BY table_name;
"
```

### 3. Check Default Data

```bash
# Check departments
docker exec -it mpanel-postgres psql -U mpanel -d mpanel -c "SELECT name, code FROM departments ORDER BY name;"

# Check onboarding tasks
docker exec -it mpanel-postgres psql -U mpanel -d mpanel -c "SELECT title, due_days_after_hire FROM onboarding_tasks ORDER BY task_order;"
```

---

## 🎨 Frontend Integration

### Employee List Component

```typescript
// src/pages/admin/Employees.tsx
import { useState, useEffect } from 'react';
import api from '@/services/api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    department_id: '',
    employment_type: '',
    is_active: true
  });

  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, [filters]);

  const loadEmployees = async () => {
    const params = new URLSearchParams();
    if (filters.department_id) params.append('department_id', filters.department_id);
    if (filters.employment_type) params.append('employment_type', filters.employment_type);
    if (filters.is_active !== '') params.append('is_active', filters.is_active);

    const response = await api.get(`/hr/employees?${params}`);
    setEmployees(response.data.data);
  };

  const loadDepartments = async () => {
    const response = await api.get('/hr/departments');
    setDepartments(response.data.data);
  };

  return (
    <div>
      <h1>Employees</h1>
      
      {/* Filters */}
      <div className="filters">
        <select 
          value={filters.department_id}
          onChange={(e) => setFilters({...filters, department_id: e.target.value})}
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
        
        <select
          value={filters.employment_type}
          onChange={(e) => setFilters({...filters, employment_type: e.target.value})}
        >
          <option value="">All Types</option>
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contractor">Contractor</option>
        </select>
      </div>

      {/* Employee Table */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Job Title</th>
            <th>Department</th>
            <th>Manager</th>
            <th>Hire Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>{emp.first_name} {emp.last_name}</td>
              <td>{emp.job_title}</td>
              <td>{emp.department_name}</td>
              <td>{emp.manager_name}</td>
              <td>{new Date(emp.hire_date).toLocaleDateString()}</td>
              <td>{emp.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 📊 Analytics & Reporting

### Employee Stats Dashboard

```bash
GET /api/hr/analytics/employees

# Response:
{
  "total_employees": 47,
  "active_employees": 45,
  "full_time": 38,
  "part_time": 5,
  "contractors": 4,
  "new_hires_90_days": 6,
  "terminated": 2,
  "total_departments": 8
}
```

### Department Breakdown

```bash
GET /api/hr/analytics/departments

# Shows employee count and budget by department
```

---

## 🔄 Automated Workflows

### 1. Employee Onboarding Trigger
When `employee_profiles` is created:
- Automatically creates 13 onboarding tasks
- Calculates due dates based on hire_date
- Assigns tasks to employee, manager, HR, IT
- Tracks completion progress

### 2. Department Employee Count
Trigger automatically updates `departments.employee_count` when:
- Employee profile created
- Employee changes departments
- Employee profile deleted

### 3. Time Off Auto-Calculation
When time off request created:
- Automatically calculates `total_days`
- Validates date ranges
- Sets status to 'pending'

---

## 🎯 Next Steps (Future Enhancements)

1. **Payroll Integration** - Connect to payroll services (Gusto, ADP)
2. **Leave Balance Tracking** - Track vacation/sick days used/remaining
3. **Org Chart Visualization** - Interactive department hierarchy
4. **360° Reviews** - Peer feedback for performance reviews
5. **Training Module** - Track employee training and certifications
6. **Recruitment Pipeline** - Job postings, applicant tracking
7. **Benefits Administration** - Health insurance, 401k enrollment
8. **Mobile App** - Employee self-service mobile access

---

## 📞 Support

**Documentation**: `/docs/hr-management`  
**API Reference**: `/docs/api#hr-endpoints`  
**Database Schema**: `prisma/migrations/20251118_employee_management_system/migration.sql`

---

**Status**: ✅ **PRODUCTION READY**  
**Last Updated**: November 18, 2025  
**Version**: 1.0.0
