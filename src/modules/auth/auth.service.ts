import { prisma } from '../../config/database.js';
import { 
  generateTokenPair, 
  verifyPassword, 
  verifyRefreshToken,
  hashPassword,
} from '../../config/auth.js';
import type { LoginRequest, LoginResponse, RefreshRequest, RefreshResponse, UserInfo } from './auth.types.js';
import logger from '../../config/logger.js';

export class AuthService {
  /**
   * Authenticate user with email and password
   * Enterprise-grade: Handles both legacy JS routes (status/role as varchar) and Prisma (isActive/role as varchar)
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const { email, password } = data;
    
    // Find user by email with optional tenant (super_admin may not have tenant)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            domain: true,
            isActive: true,
            status: true,  // Legacy column for backward compatibility
          },
        },
      },
    });
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    // Check user active status (support both legacy 'status' and new 'isActive')
    const userActive = user.isActive === true || 
                       (user.status && user.status.toLowerCase() === 'active');
    
    if (!userActive) {
      throw new Error('User account is inactive');
    }
    
    // Check tenant active status (if tenant exists)
    if (user.tenant) {
      const tenantActive = user.tenant.isActive === true || 
                          (user.tenant.status && user.tenant.status.toLowerCase() === 'active');
      if (!tenantActive) {
        throw new Error('Tenant account is inactive');
      }
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }
    
    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Build display name from available fields
    const displayName = user.displayName || 
                       [user.firstName, user.lastName].filter(Boolean).join(' ') || 
                       user.email.split('@')[0];
    
    logger.info('User logged in', { 
      userId: user.id, 
      email: user.email, 
      tenantId: user.tenantId,
      role: user.role,
    });
    
    return {
      token: tokens.accessToken,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isActive: userActive,
      },
    };
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refresh(data: RefreshRequest): Promise<RefreshResponse> {
    const { refreshToken } = data;
    
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      
      // Get user from database with optional tenant
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          tenant: {
            select: {
              isActive: true,
              status: true,
            },
          },
        },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check user active status
      const userActive = user.isActive === true || 
                        (user.status && user.status.toLowerCase() === 'active');
      
      if (!userActive) {
        throw new Error('User account is inactive');
      }
      
      // Check tenant active status (if tenant exists)
      if (user.tenant) {
        const tenantActive = user.tenant.isActive === true || 
                            (user.tenant.status && user.tenant.status.toLowerCase() === 'active');
        if (!tenantActive) {
          throw new Error('Tenant account is inactive');
        }
      }
      
      // Generate new token pair
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });
      
      logger.debug('Token refreshed', { userId: user.id });
      
      return {
        token: tokens.accessToken,
        ...tokens,
      };
    } catch (error) {
      logger.warn('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown' });
      throw new Error('Invalid or expired refresh token');
    }
  }
  
  /**
   * Get current user info
   */
  async me(userId: string): Promise<UserInfo> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        status: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Build display name from available fields
    const displayName = user.displayName || 
                       [user.firstName, user.lastName].filter(Boolean).join(' ') || 
                       user.email.split('@')[0];
    
    const isActive = user.isActive === true || 
                    (user.status && user.status.toLowerCase() === 'active');
    
    return {
      id: user.id,
      email: user.email,
      displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive,
    };
  }
  
  /**
   * Create a new user (admin only)
   * Enterprise-grade: Maintains backward compatibility with JS routes
   */
  async createUser(data: {
    email: string;
    password: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    tenantId: string;
  }): Promise<UserInfo> {
    const { email, password, displayName, firstName, lastName, role, tenantId } = data;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Build display name
    const computedDisplayName = displayName || 
                               [firstName, lastName].filter(Boolean).join(' ') ||
                               email.split('@')[0];
    
    // Create user (set both legacy and new columns for full compatibility)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName: computedDisplayName,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role.toLowerCase(),  // Normalize to lowercase
        status: 'active',          // Legacy column
        isActive: true,            // New column
        tenantId,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });
    
    logger.info('User created', { userId: user.id, email: user.email, role: user.role });
    
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || computedDisplayName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive ?? true,
    };
  }
}

export default new AuthService();
