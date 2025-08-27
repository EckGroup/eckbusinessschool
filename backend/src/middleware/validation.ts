import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Generic validation middleware
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input data',
        details: errorDetails
      });
      return;
    }
    
    req.body = value; // Use validated and sanitized data
    next();
  };
};

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  });

// Phone validation schema
const phoneSchema = Joi.string()
  .pattern(/^[+]?[\d\s\-()]{10,}$/)
  .optional()
  .messages({
    'string.pattern.base': 'Please provide a valid phone number'
  });

// User registration validation
export const registerValidation = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  phone: phoneSchema
});

// User login validation
export const loginValidation = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// Student registration validation
export const studentRegistrationValidation = Joi.object({
  // Personal Information
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  nationality: Joi.string().max(50).optional(),
  
  // Address Information
  address: Joi.string().max(200).optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).optional(),
  
  // Emergency Contact
  emergencyContactName: Joi.string().min(2).max(100).optional(),
  emergencyContactPhone: phoneSchema,
  emergencyContactEmail: Joi.string().email({ tlds: { allow: false } }).optional(),
  
  // Academic Information
  previousEducation: Joi.string().max(500).optional(),
  workExperience: Joi.string().max(500).optional(),
  
  // Course Selection
  courseId: Joi.string().required().messages({
    'any.required': 'Please select a course'
  }),
  
  // Additional Information
  message: Joi.string().max(1000).optional()
});

// Course creation/update validation
export const courseValidation = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().min(10).max(2000).required(),
  category: Joi.string().max(100).required(),
  level: Joi.string().valid('Beginner', 'Intermediate', 'Advanced', 'Foundation', 'Professional').default('Beginner'),
  duration: Joi.string().max(100).required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('NGN'),
  imageUrl: Joi.string().uri().optional(),
  maxStudents: Joi.number().min(1).optional(),
  prerequisites: Joi.string().max(500).optional(),
  isActive: Joi.boolean().default(true)
});

// Course module validation
export const moduleValidation = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  orderIndex: Joi.number().min(0).required()
});

// Lesson validation
export const lessonValidation = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  content: Joi.string().max(10000).optional(),
  videoUrl: Joi.string().uri().optional(),
  duration: Joi.string().max(50).optional(),
  orderIndex: Joi.number().min(0).required(),
  resources: Joi.array().items(Joi.string().uri()).default([])
});

// Progress update validation
export const progressUpdateValidation = Joi.object({
  lessonId: Joi.string().required(),
  isCompleted: Joi.boolean().required(),
  timeSpent: Joi.number().min(0).optional().default(0)
});

// YouTube video validation
export const youtubeVideoValidation = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  videoId: Joi.string().required(),
  url: Joi.string().uri().required(),
  thumbnailUrl: Joi.string().uri().optional(),
  category: Joi.string().max(100).required(),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  courseId: Joi.string().optional(),
  duration: Joi.string().max(50).optional(),
  isActive: Joi.boolean().default(true)
});

// Admin user creation validation
export const adminUserValidation = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phone: phoneSchema,
  department: Joi.string().max(100).optional(),
  permissions: Joi.array().items(Joi.string()).default([])
});

// Password change validation
export const passwordChangeValidation = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: passwordSchema,
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Password confirmation does not match new password',
    'any.required': 'Password confirmation is required'
  })
});

// Registration approval/rejection validation
export const registrationActionValidation = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  message: Joi.when('action', {
    is: 'reject',
    then: Joi.string().min(10).max(500).required().messages({
      'string.min': 'Rejection reason must be at least 10 characters',
      'any.required': 'Rejection reason is required when rejecting a registration'
    }),
    otherwise: Joi.string().max(500).optional()
  })
});

// Query parameter validation schemas
export const paginationValidation = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

export const searchValidation = Joi.object({
  q: Joi.string().min(1).max(100).optional(),
  category: Joi.string().max(50).optional(),
  status: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional()
});

// Validate query parameters
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      res.status(400).json({
        error: 'Invalid query parameters',
        details: errorDetails
      });
      return;
    }
    
    req.query = value;
    next();
  };
};
