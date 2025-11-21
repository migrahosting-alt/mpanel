/**
 * HR Routes
 * Employee, department, and HR management endpoints
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import * as hrService from '../services/hrService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ========================================
// DEPARTMENT ROUTES
// ========================================

// Get all departments
router.get('/departments', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const departments = await hrService.getAllDepartments(req.user.tenantId);
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get department by ID
router.get('/departments/:id', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const department = await hrService.getDepartmentById(req.params.id, req.user.tenantId);
    
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    
    res.json({ success: true, data: department });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create department
router.post('/departments', requirePermission('hr.manage_departments'), async (req, res) => {
  try {
    const department = await hrService.createDepartment(req.user.tenantId, req.body);
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update department
router.put('/departments/:id', requirePermission('hr.manage_departments'), async (req, res) => {
  try {
    const department = await hrService.updateDepartment(
      req.params.id,
      req.user.tenantId,
      req.body
    );
    
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }
    
    res.json({ success: true, data: department });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get department stats
router.get('/analytics/departments', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const stats = await hrService.getDepartmentStats(req.user.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// EMPLOYEE PROFILE ROUTES
// ========================================

// Get all employee profiles
router.get('/employees', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const filters = {
      department_id: req.query.department_id,
      employment_type: req.query.employment_type,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
    };
    
    const employees = await hrService.getAllEmployeeProfiles(req.user.tenantId, filters);
    res.json({ success: true, data: employees, count: employees.length });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get employee profile by user ID
router.get('/employees/:userId', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const profile = await hrService.getEmployeeProfile(req.params.userId, req.user.tenantId);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Employee profile not found' });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create employee profile
router.post('/employees', requirePermission('hr.manage_employees'), async (req, res) => {
  try {
    const { userId, ...profileData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    const profile = await hrService.createEmployeeProfile(
      userId,
      req.user.tenantId,
      profileData
    );
    
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    console.error('Create employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update employee profile
router.put('/employees/:userId', requirePermission('hr.manage_employees'), async (req, res) => {
  try {
    const profile = await hrService.updateEmployeeProfile(
      req.params.userId,
      req.user.tenantId,
      req.body
    );
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Employee profile not found' });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Update employee profile error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get employee stats
router.get('/analytics/employees', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const stats = await hrService.getEmployeeStats(req.user.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ONBOARDING ROUTES
// ========================================

// Get onboarding progress for employee
router.get('/employees/:userId/onboarding', requirePermission('hr.view_employees'), async (req, res) => {
  try {
    const progress = await hrService.getOnboardingProgress(req.params.userId, req.user.tenantId);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Get onboarding progress error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update onboarding task status
router.put('/onboarding/:progressId', requirePermission('hr.manage_onboarding'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }
    
    const task = await hrService.updateOnboardingTaskStatus(
      req.params.progressId,
      req.user.userId,
      status,
      notes
    );
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Onboarding task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Update onboarding task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// TIME OFF ROUTES
// ========================================

// Get all time off requests
router.get('/time-off', requirePermission('hr.view_time_off'), async (req, res) => {
  try {
    const filters = {
      employee_id: req.query.employee_id,
      status: req.query.status
    };
    
    const requests = await hrService.getTimeOffRequests(req.user.tenantId, filters);
    res.json({ success: true, data: requests, count: requests.length });
  } catch (error) {
    console.error('Get time off requests error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create time off request
router.post('/time-off', async (req, res) => {
  try {
    const request = await hrService.createTimeOffRequest(
      req.user.userId,
      req.user.tenantId,
      req.body
    );
    
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Create time off request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve time off request
router.post('/time-off/:id/approve', requirePermission('hr.manage_time_off'), async (req, res) => {
  try {
    const request = await hrService.approveTimeOffRequest(
      req.params.id,
      req.user.userId,
      req.user.tenantId
    );
    
    if (!request) {
      return res.status(404).json({ success: false, error: 'Time off request not found' });
    }
    
    res.json({ success: true, data: request, message: 'Time off request approved' });
  } catch (error) {
    console.error('Approve time off request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject time off request
router.post('/time-off/:id/reject', requirePermission('hr.manage_time_off'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const request = await hrService.rejectTimeOffRequest(
      req.params.id,
      req.user.userId,
      req.user.tenantId,
      reason
    );
    
    if (!request) {
      return res.status(404).json({ success: false, error: 'Time off request not found' });
    }
    
    res.json({ success: true, data: request, message: 'Time off request rejected' });
  } catch (error) {
    console.error('Reject time off request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
