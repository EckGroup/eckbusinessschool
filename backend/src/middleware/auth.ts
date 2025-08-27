import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        status: string;
      };
    }
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  return bcrypt.hash(password, saltRounds);
};

// Compare password
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
export const generateToken = (userId: string, email: string, role: string): string => {
  const payload = { userId, email, role };
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(payload, secret, { expiresIn });
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.verify(token, secret) as JWTPayload;
};

// Authentication middleware
export const authenticateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid authentication token' 
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      
      // Get user from database to ensure they still exist and are active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true
        }
      });

      if (!user) {
        res.status(401).json({ 
          error: 'Invalid token',
          message: 'User not found' 
        });
        return;
      }

      if (user.status !== 'ACTIVE') {
        res.status(401).json({ 
          error: 'Account inactive',
          message: 'Your account has been deactivated' 
        });
        return;
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      };

      next();
    } catch (tokenError) {
      if (tokenError instanceof jwt.TokenExpiredError) {
        res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.' 
        });
        return;
      }
      
      if (tokenError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ 
          error: 'Invalid token',
          message: 'Authentication token is invalid' 
        });
        return;
      }
      
      throw tokenError;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred during authentication' 
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (user && user.status === 'ACTIVE') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      };
    }
  } catch (error) {
    // Silently ignore errors in optional auth
    console.warn('Optional auth warning:', error);
  }
  
  next();
};

// Authorization middleware - check user roles
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource' 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${roles.join(', ')}` 
      });
      return;
    }

    next();
  };
};

// Middleware to require admin role
export const requireAdmin = requireRole('ADMIN');

// Middleware to require student role
export const requireStudent = requireRole('STUDENT');

// Middleware to require student or admin role
export const requireStudentOrAdmin = requireRole('STUDENT', 'ADMIN');

// Middleware to check if user can access their own data or admin
export const requireSelfOrAdmin = (userIdParam = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource' 
      });
      return;
    }

    const targetUserId = req.params[userIdParam];
    const isAdmin = req.user.role === 'ADMIN';
    const isSelf = req.user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own data' 
      });
      return;
    }

    next();
  };
};
