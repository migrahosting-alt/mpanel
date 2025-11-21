/**
 * HR Service
 * Comprehensive employee and department management
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';

// ========================================
// DEPARTMENT MANAGEMENT
// ========================================

export async function getAllDepartments(tenantId) {
  const query = `
    SELECT 
      d.*,
      u.first_name || ' ' || u.last_name as manager_name,
      pd.name as parent_department_name
    FROM departments d
    LEFT JOIN users u ON d.manager_id = u.id
    LEFT JOIN departments pd ON d.parent_department_id = pd.id
    WHERE d.tenant_id = $1 OR d.tenant_id IS NULL
    ORDER BY d.name
  `;
  
  const result = await pool.query(query, [tenantId]);
  return result.rows;
}

export async function getDepartmentById(departmentId, tenantId) {
  const query = `
    SELECT 
      d.*,
      u.first_name || ' ' || u.last_name as manager_name,
      u.email as manager_email,
      pd.name as parent_department_name
    FROM departments d
    LEFT JOIN users u ON d.manager_id = u.id
    LEFT JOIN departments pd ON d.parent_department_id = pd.id
    WHERE d.id = $1 AND (d.tenant_id = $2 OR d.tenant_id IS NULL)
  `;
  
  const result = await pool.query(query, [departmentId, tenantId]);
  return result.rows[0];
}

export async function createDepartment(tenantId, departmentData) {
  const {
    name,
    code,
    description,
    manager_id,
    parent_department_id,
    location,
    budget_allocated
  } = departmentData;
  
  const query = `
    INSERT INTO departments (
      tenant_id, name, code, description, manager_id, 
      parent_department_id, location, budget_allocated
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    tenantId, name, code, description, manager_id || null,
    parent_department_id || null, location || null, budget_allocated || 0
  ]);
  
  logger.info('Department created', { departmentId: result.rows[0].id, tenantId });
  return result.rows[0];
}

export async function updateDepartment(departmentId, tenantId, updates) {
  const allowedFields = [
    'name', 'code', 'description', 'manager_id', 'parent_department_id',
    'location', 'budget_allocated', 'is_active'
  ];
  
  const setClauses = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  values.push(departmentId, tenantId);
  
  const query = `
    UPDATE departments 
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    RETURNING *
  `;
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// ========================================
// EMPLOYEE PROFILE MANAGEMENT
// ========================================

export async function getEmployeeProfile(userId, tenantId) {
  const query = `
    SELECT 
      ep.*,
      u.email, u.first_name, u.last_name, u.status as user_status,
      d.name as department_name, d.code as department_code,
      m.first_name || ' ' || m.last_name as manager_name,
      m.email as manager_email
    FROM employee_profiles ep
    INNER JOIN users u ON ep.user_id = u.id
    LEFT JOIN departments d ON ep.department_id = d.id
    LEFT JOIN users m ON ep.manager_id = m.id
    WHERE ep.user_id = $1 AND ep.tenant_id = $2
  `;
  
  const result = await pool.query(query, [userId, tenantId]);
  return result.rows[0];
}

export async function getAllEmployeeProfiles(tenantId, filters = {}) {
  let query = `
    SELECT 
      ep.*,
      u.email, u.first_name, u.last_name, u.status as user_status,
      d.name as department_name, d.code as department_code,
      m.first_name || ' ' || m.last_name as manager_name
    FROM employee_profiles ep
    INNER JOIN users u ON ep.user_id = u.id
    LEFT JOIN departments d ON ep.department_id = d.id
    LEFT JOIN users m ON ep.manager_id = m.id
    WHERE ep.tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramIndex = 2;
  
  // Apply filters
  if (filters.department_id) {
    query += ` AND ep.department_id = $${paramIndex}`;
    params.push(filters.department_id);
    paramIndex++;
  }
  
  if (filters.employment_type) {
    query += ` AND ep.employment_type = $${paramIndex}`;
    params.push(filters.employment_type);
    paramIndex++;
  }
  
  if (filters.is_active !== undefined) {
    query += ` AND ep.is_active = $${paramIndex}`;
    params.push(filters.is_active);
    paramIndex++;
  }
  
  query += ` ORDER BY u.first_name, u.last_name`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function createEmployeeProfile(userId, tenantId, profileData) {
  const {
    employee_id, department_id, job_title, employment_type,
    work_location, hire_date, manager_id, salary, hourly_rate,
    phone_work, phone_mobile, emergency_contact_name, emergency_contact_phone,
    address_line1, city, state, postal_code, country, timezone, skills
  } = profileData;
  
  const query = `
    INSERT INTO employee_profiles (
      user_id, tenant_id, employee_id, department_id, job_title,
      employment_type, work_location, hire_date, manager_id, salary,
      hourly_rate, phone_work, phone_mobile, emergency_contact_name,
      emergency_contact_phone, address_line1, city, state, postal_code,
      country, timezone, skills
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    userId, tenantId, employee_id || null, department_id || null, job_title || null,
    employment_type || 'full_time', work_location || null, hire_date || null,
    manager_id || null, salary || null, hourly_rate || null, phone_work || null,
    phone_mobile || null, emergency_contact_name || null, emergency_contact_phone || null,
    address_line1 || null, city || null, state || null, postal_code || null,
    country || null, timezone || 'UTC', skills ? JSON.stringify(skills) : null
  ]);
  
  // Auto-create onboarding tasks for new employee
  await createOnboardingTasks(userId, tenantId, department_id, hire_date);
  
  logger.info('Employee profile created', { userId, tenantId });
  return result.rows[0];
}

export async function updateEmployeeProfile(userId, tenantId, updates) {
  const allowedFields = [
    'employee_id', 'department_id', 'job_title', 'employment_type',
    'work_location', 'hire_date', 'termination_date', 'manager_id',
    'salary', 'hourly_rate', 'commission_rate', 'phone_work', 'phone_mobile',
    'emergency_contact_name', 'emergency_contact_phone', 'address_line1',
    'address_line2', 'city', 'state', 'postal_code', 'country', 'timezone',
    'skills', 'certifications', 'performance_notes', 'notes', 'is_active'
  ];
  
  const setClauses = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      // Handle JSON fields
      if (['skills', 'certifications'].includes(key) && value) {
        setClauses.push(`${key} = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }
  }
  
  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  values.push(userId, tenantId);
  
  const query = `
    UPDATE employee_profiles 
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
    RETURNING *
  `;
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// ========================================
// ONBOARDING MANAGEMENT
// ========================================

async function createOnboardingTasks(employeeId, tenantId, departmentId, hireDate) {
  const taskTemplatesQuery = `
    SELECT * FROM onboarding_tasks 
    WHERE (tenant_id = $1 OR tenant_id IS NULL)
      AND (department_id = $2 OR department_id IS NULL)
      AND is_active = true
    ORDER BY task_order
  `;
  
  const templates = await pool.query(taskTemplatesQuery, [tenantId, departmentId]);
  const baseHireDate = hireDate ? new Date(hireDate) : new Date();
  
  for (const template of templates.rows) {
    const dueDate = new Date(baseHireDate);
    dueDate.setDate(dueDate.getDate() + template.due_days_after_hire);
    
    await pool.query(`
      INSERT INTO employee_onboarding_progress (
        employee_id, onboarding_task_id, tenant_id, due_date, status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (employee_id, onboarding_task_id) DO NOTHING
    `, [employeeId, template.id, tenantId, dueDate]);
  }
  
  logger.info('Onboarding tasks created', { employeeId, taskCount: templates.rows.length });
}

export async function getOnboardingProgress(employeeId, tenantId) {
  const query = `
    SELECT 
      eop.*,
      ot.title, ot.description, ot.assigned_to, ot.is_required,
      u.first_name || ' ' || u.last_name as completed_by_name
    FROM employee_onboarding_progress eop
    INNER JOIN onboarding_tasks ot ON eop.onboarding_task_id = ot.id
    LEFT JOIN users u ON eop.completed_by = u.id
    WHERE eop.employee_id = $1 AND eop.tenant_id = $2
    ORDER BY ot.task_order
  `;
  
  const result = await pool.query(query, [employeeId, tenantId]);
  
  const totalTasks = result.rows.length;
  const completedTasks = result.rows.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0;
  
  return {
    tasks: result.rows,
    stats: {
      total: totalTasks,
      completed: completedTasks,
      pending: result.rows.filter(t => t.status === 'pending').length,
      in_progress: result.rows.filter(t => t.status === 'in_progress').length,
      completion_rate: parseFloat(completionRate)
    }
  };
}

export async function updateOnboardingTaskStatus(progressId, userId, status, notes) {
  const query = `
    UPDATE employee_onboarding_progress 
    SET status = $1, 
        completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        completed_by = CASE WHEN $1 = 'completed' THEN $2 ELSE completed_by END,
        notes = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;
  
  const result = await pool.query(query, [status, userId, notes || null, progressId]);
  return result.rows[0];
}

// ========================================
// TIME OFF REQUESTS
// ========================================

export async function createTimeOffRequest(employeeId, tenantId, requestData) {
  const { request_type, start_date, end_date, reason } = requestData;
  
  // Calculate total days
  const start = new Date(start_date);
  const end = new Date(end_date);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  const query = `
    INSERT INTO time_off_requests (
      employee_id, tenant_id, request_type, start_date, end_date, total_days, reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    employeeId, tenantId, request_type, start_date, end_date, diffDays, reason || null
  ]);
  
  logger.info('Time off request created', { requestId: result.rows[0].id, employeeId });
  return result.rows[0];
}

export async function getTimeOffRequests(tenantId, filters = {}) {
  let query = `
    SELECT 
      tor.*,
      e.first_name || ' ' || e.last_name as employee_name,
      e.email as employee_email,
      ep.department_id,
      d.name as department_name,
      a.first_name || ' ' || a.last_name as approved_by_name
    FROM time_off_requests tor
    INNER JOIN users e ON tor.employee_id = e.id
    LEFT JOIN employee_profiles ep ON e.id = ep.user_id
    LEFT JOIN departments d ON ep.department_id = d.id
    LEFT JOIN users a ON tor.approved_by = a.id
    WHERE tor.tenant_id = $1
  `;
  
  const params = [tenantId];
  let paramIndex = 2;
  
  if (filters.employee_id) {
    query += ` AND tor.employee_id = $${paramIndex}`;
    params.push(filters.employee_id);
    paramIndex++;
  }
  
  if (filters.status) {
    query += ` AND tor.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }
  
  query += ` ORDER BY tor.created_at DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function approveTimeOffRequest(requestId, approverId, tenantId) {
  const query = `
    UPDATE time_off_requests 
    SET status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND tenant_id = $3
    RETURNING *
  `;
  
  const result = await pool.query(query, [approverId, requestId, tenantId]);
  logger.info('Time off request approved', { requestId, approverId });
  return result.rows[0];
}

export async function rejectTimeOffRequest(requestId, approverId, tenantId, reason) {
  const query = `
    UPDATE time_off_requests 
    SET status = 'rejected',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        rejection_reason = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
    RETURNING *
  `;
  
  const result = await pool.query(query, [approverId, reason, requestId, tenantId]);
  logger.info('Time off request rejected', { requestId, approverId });
  return result.rows[0];
}

// ========================================
// ANALYTICS & REPORTING
// ========================================

export async function getEmployeeStats(tenantId) {
  const query = `
    SELECT 
      COUNT(DISTINCT ep.user_id) as total_employees,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.is_active = true) as active_employees,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.employment_type = 'full_time') as full_time,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.employment_type = 'part_time') as part_time,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.employment_type = 'contractor') as contractors,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.hire_date >= CURRENT_DATE - INTERVAL '90 days') as new_hires_90_days,
      COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.termination_date IS NOT NULL) as terminated,
      COUNT(DISTINCT d.id) as total_departments
    FROM employee_profiles ep
    LEFT JOIN departments d ON ep.department_id = d.id AND d.tenant_id = $1
    WHERE ep.tenant_id = $1
  `;
  
  const result = await pool.query(query, [tenantId]);
  return result.rows[0];
}

export async function getDepartmentStats(tenantId) {
  const query = `
    SELECT 
      d.id, d.name, d.code, d.employee_count,
      COUNT(ep.user_id) as actual_count,
      d.budget_allocated,
      u.first_name || ' ' || u.last_name as manager_name
    FROM departments d
    LEFT JOIN employee_profiles ep ON d.id = ep.department_id AND ep.is_active = true
    LEFT JOIN users u ON d.manager_id = u.id
    WHERE d.tenant_id = $1 OR d.tenant_id IS NULL
    GROUP BY d.id, d.name, d.code, d.employee_count, d.budget_allocated, u.first_name, u.last_name
    ORDER BY d.name
  `;
  
  const result = await pool.query(query, [tenantId]);
  return result.rows;
}
