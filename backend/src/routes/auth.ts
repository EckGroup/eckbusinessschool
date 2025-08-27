import express from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  hashPassword, 
  comparePassword, 
  generateToken,
  authenticateUser 
} from '../middleware/auth';
import { 
  validate, 
  loginValidation,
  passwordChangeValidation 
} from '../middleware/validation';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Login endpoint
router.post('/login', validate(loginValidation), asyncHandler(async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      student: true,
      adminUser: true
    }
  });

  if (!user) {
    throw new CustomError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user is active
  if (user.status !== 'ACTIVE') {
    throw new CustomError('Account is inactive. Please contact support.', 401, 'ACCOUNT_INACTIVE');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  
  if (!isPasswordValid) {
    throw new CustomError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT token
  const token = generateToken(user.id, user.email, user.role);

  // Prepare user response (excluding password)
  const userResponse = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    student: user.student ? {
      id: user.student.id,
      dateOfBirth: user.student.dateOfBirth,
      gender: user.student.gender,
      nationality: user.student.nationality,
      address: user.student.address,
      city: user.student.city,
      state: user.student.state,
      country: user.student.country
    } : null,
    adminUser: user.adminUser ? {
      id: user.adminUser.id,
      department: user.adminUser.department,
      permissions: user.adminUser.permissions
    } : null
  };

  res.json({
    message: 'Login successful',
    token,
    user: userResponse
  });
}));

// Get current user profile
router.get('/profile', authenticateUser, asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      student: {
        include: {
          enrollments: {
            include: {
              course: true
            }
          },
          progress: {
            include: {
              course: true
            }
          }
        }
      },
      adminUser: true
    }
  });

  if (!user) {
    throw new CustomError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  res.json({
    message: 'Profile retrieved successfully',
    user: userWithoutPassword
  });
}));

// Update user profile
router.put('/profile', authenticateUser, asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = req.user!.id;
  const { firstName, lastName, phone } = req.body;

  // Update user basic information
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(phone && { phone })
    },
    include: {
      student: true,
      adminUser: true
    }
  });

  // Remove password from response
  const { password, ...userWithoutPassword } = updatedUser;

  res.json({
    message: 'Profile updated successfully',
    user: userWithoutPassword
  });
}));

// Change password
router.post('/change-password', 
  authenticateUser, 
  validate(passwordChangeValidation), 
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new CustomError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      throw new CustomError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.json({
      message: 'Password changed successfully'
    });
  })
);

// Logout endpoint (client-side token removal, server-side optional)
router.post('/logout', authenticateUser, asyncHandler(async (req: express.Request, res: express.Response) => {
  // In a more complex setup, you might want to blacklist the token
  // For now, we'll just send a success response
  res.json({
    message: 'Logout successful'
  });
}));

// Check authentication status
router.get('/verify', authenticateUser, asyncHandler(async (req: express.Request, res: express.Response) => {
  res.json({
    message: 'Token is valid',
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      status: req.user!.status
    }
  });
}));

// Refresh token (optional - for extending session)
router.post('/refresh', authenticateUser, asyncHandler(async (req: express.Request, res: express.Response) => {
  const user = req.user!;
  
  // Generate new token
  const newToken = generateToken(user.id, user.email, user.role);
  
  res.json({
    message: 'Token refreshed successfully',
    token: newToken
  });
}));

export default router;
