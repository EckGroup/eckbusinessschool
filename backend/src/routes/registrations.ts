import express from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  authenticateUser, 
  requireAdmin,
  requireStudentOrAdmin 
} from '../middleware/auth';
import { 
  validate, 
  studentRegistrationValidation,
  registrationActionValidation,
  validateQuery,
  paginationValidation,
  searchValidation
} from '../middleware/validation';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to generate WhatsApp message
const generateWhatsAppMessage = (type: 'registration' | 'approval' | 'rejection', data: any) => {
  const whatsappPhone = process.env.WHATSAPP_PHONE || '05741768196';
  let message = '';

  switch (type) {
    case 'registration':
      message = `🎓 *New Student Registration*\n\n` +
                `*Name:* ${data.firstName} ${data.lastName}\n` +
                `*Email:* ${data.email}\n` +
                `*Phone:* ${data.phone || 'Not provided'}\n` +
                `*Course:* ${data.courseName}\n` +
                `*Date:* ${new Date().toLocaleDateString()}\n\n` +
                `Please review and approve this registration.`;
      break;
      
    case 'approval':
      message = `🎉 *Registration Approved*\n\n` +
                `Dear ${data.firstName},\n\n` +
                `Your registration for *${data.courseName}* has been approved!\n\n` +
                `Welcome to Eck School of Business. You will receive further instructions via email.`;
      break;
      
    case 'rejection':
      message = `❌ *Registration Update*\n\n` +
                `Dear ${data.firstName},\n\n` +
                `Your registration for *${data.courseName}* requires attention.\n\n` +
                `*Reason:* ${data.reason}\n\n` +
                `Please contact us for more information.`;
      break;
  }

  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
};

// Create new student registration
router.post('/', 
  validate(studentRegistrationValidation), 
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      nationality,
      address,
      city,
      state,
      postalCode,
      country,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactEmail,
      previousEducation,
      workExperience,
      courseId,
      message
    } = req.body;

    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      throw new CustomError('Course not found', 404, 'COURSE_NOT_FOUND');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    let studentId: string;

    if (existingUser) {
      // If user exists, check if they already have a student profile
      const existingStudent = await prisma.student.findUnique({
        where: { userId: existingUser.id }
      });

      if (!existingStudent) {
        // Create student profile for existing user
        const student = await prisma.student.create({
          data: {
            userId: existingUser.id,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender,
            nationality,
            address,
            city,
            state,
            postalCode,
            country,
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactEmail,
            previousEducation,
            workExperience
          }
        });
        studentId = student.id;
      } else {
        studentId = existingStudent.id;
      }
    } else {
      // Create new user and student profile
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: 'temp_password_will_be_set_on_approval',
          firstName,
          lastName,
          phone,
          role: 'STUDENT',
          status: 'INACTIVE', // Will be activated on approval
          student: {
            create: {
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              gender,
              nationality,
              address,
              city,
              state,
              postalCode,
              country,
              emergencyContactName,
              emergencyContactPhone,
              emergencyContactEmail,
              previousEducation,
              workExperience
            }
          }
        },
        include: {
          student: true
        }
      });
      studentId = user.student!.id;
    }

    // Check if registration already exists
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        studentId,
        courseId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (existingRegistration) {
      throw new CustomError(
        'A registration for this course already exists',
        409,
        'REGISTRATION_EXISTS'
      );
    }

    // Create registration
    const registration = await prisma.registration.create({
      data: {
        studentId,
        courseId,
        message,
        status: 'PENDING'
      },
      include: {
        student: {
          include: {
            user: true
          }
        },
        course: true
      }
    });

    // Generate WhatsApp URL for admin notification
    const whatsappUrl = generateWhatsAppMessage('registration', {
      firstName: registration.student.user.firstName,
      lastName: registration.student.user.lastName,
      email: registration.student.user.email,
      phone: registration.student.user.phone,
      courseName: registration.course.title
    });

    res.status(201).json({
      message: 'Registration submitted successfully',
      registration: {
        id: registration.id,
        status: registration.status,
        course: {
          id: registration.course.id,
          title: registration.course.title,
          price: registration.course.price,
          currency: registration.course.currency
        },
        student: {
          name: `${registration.student.user.firstName} ${registration.student.user.lastName}`,
          email: registration.student.user.email
        },
        createdAt: registration.createdAt
      },
      whatsappUrl,
      nextSteps: [
        'Your registration has been submitted for review',
        'You will be notified via email and WhatsApp once approved',
        'Please keep your contact information updated'
      ]
    });
  })
);

// Get all registrations (Admin only)
router.get('/', 
  authenticateUser,
  requireAdmin,
  validateQuery(paginationValidation.concat(searchValidation)),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', q, status } = req.query as any;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } }
              ]
            }
          }
        },
        {
          course: {
            title: { contains: q, mode: 'insensitive' }
          }
        }
      ];
    }

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          student: {
            include: {
              user: true
            }
          },
          course: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit
      }),
      prisma.registration.count({ where })
    ]);

    res.json({
      registrations: registrations.map(reg => ({
        id: reg.id,
        status: reg.status,
        message: reg.message,
        createdAt: reg.createdAt,
        reviewedAt: reg.reviewedAt,
        rejectionReason: reg.rejectionReason,
        student: {
          id: reg.student.id,
          name: `${reg.student.user.firstName} ${reg.student.user.lastName}`,
          email: reg.student.user.email,
          phone: reg.student.user.phone,
          address: `${reg.student.city || ''}, ${reg.student.state || ''}`.trim().replace(/^,\s*/, ''),
          previousEducation: reg.student.previousEducation
        },
        course: {
          id: reg.course.id,
          title: reg.course.title,
          category: reg.course.category,
          price: reg.course.price,
          currency: reg.course.currency
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// Get single registration
router.get('/:id',
  authenticateUser,
  requireStudentOrAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: true
          }
        },
        course: {
          include: {
            modules: {
              include: {
                lessons: true
              }
            }
          }
        }
      }
    });

    if (!registration) {
      throw new CustomError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    }

    // Check if user can access this registration
    const isAdmin = req.user!.role === 'ADMIN';
    const isOwner = registration.student.userId === req.user!.id;

    if (!isAdmin && !isOwner) {
      throw new CustomError('Access denied', 403, 'ACCESS_DENIED');
    }

    res.json({
      registration: {
        id: registration.id,
        status: registration.status,
        message: registration.message,
        createdAt: registration.createdAt,
        reviewedAt: registration.reviewedAt,
        rejectionReason: registration.rejectionReason,
        student: {
          id: registration.student.id,
          name: `${registration.student.user.firstName} ${registration.student.user.lastName}`,
          email: registration.student.user.email,
          phone: registration.student.user.phone,
          dateOfBirth: registration.student.dateOfBirth,
          gender: registration.student.gender,
          nationality: registration.student.nationality,
          address: registration.student.address,
          city: registration.student.city,
          state: registration.student.state,
          country: registration.student.country,
          emergencyContact: {
            name: registration.student.emergencyContactName,
            phone: registration.student.emergencyContactPhone,
            email: registration.student.emergencyContactEmail
          },
          previousEducation: registration.student.previousEducation,
          workExperience: registration.student.workExperience
        },
        course: {
          id: registration.course.id,
          title: registration.course.title,
          description: registration.course.description,
          category: registration.course.category,
          level: registration.course.level,
          duration: registration.course.duration,
          price: registration.course.price,
          currency: registration.course.currency,
          prerequisites: registration.course.prerequisites,
          totalModules: registration.course.modules.length,
          totalLessons: registration.course.modules.reduce((acc, module) => acc + module.lessons.length, 0)
        }
      }
    });
  })
);

// Approve or reject registration (Admin only)
router.patch('/:id/action',
  authenticateUser,
  requireAdmin,
  validate(registrationActionValidation),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { action, message } = req.body;

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: true
          }
        },
        course: true
      }
    });

    if (!registration) {
      throw new CustomError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    }

    if (registration.status !== 'PENDING') {
      throw new CustomError('Registration has already been processed', 400, 'REGISTRATION_PROCESSED');
    }

    const updateData: any = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewedBy: req.user!.id,
      reviewedAt: new Date()
    };

    if (action === 'reject' && message) {
      updateData.rejectionReason = message;
    }

    // Update registration
    const updatedRegistration = await prisma.registration.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
            user: true
          }
        },
        course: true
      }
    });

    // If approved, create enrollment and activate user
    if (action === 'approve') {
      // Activate user if inactive
      if (updatedRegistration.student.user.status === 'INACTIVE') {
        await prisma.user.update({
          where: { id: updatedRegistration.student.user.id },
          data: { status: 'ACTIVE' }
        });
      }

      // Create enrollment
      await prisma.enrollment.create({
        data: {
          studentId: updatedRegistration.student.id,
          courseId: updatedRegistration.course.id,
          status: 'ACTIVE',
          paymentStatus: 'PENDING'
        }
      });

      // Create initial progress record
      const totalLessons = await prisma.lesson.count({
        where: {
          module: {
            courseId: updatedRegistration.course.id
          }
        }
      });

      await prisma.studentProgress.create({
        data: {
          studentId: updatedRegistration.student.id,
          courseId: updatedRegistration.course.id,
          totalLessons
        }
      });
    }

    // Generate WhatsApp URL for student notification
    const whatsappUrl = generateWhatsAppMessage(
      action === 'approve' ? 'approval' : 'rejection',
      {
        firstName: updatedRegistration.student.user.firstName,
        courseName: updatedRegistration.course.title,
        reason: message || 'No additional details provided'
      }
    );

    res.json({
      message: `Registration ${action}d successfully`,
      registration: {
        id: updatedRegistration.id,
        status: updatedRegistration.status,
        reviewedAt: updatedRegistration.reviewedAt,
        rejectionReason: updatedRegistration.rejectionReason
      },
      whatsappUrl,
      ...(action === 'approve' && {
        nextSteps: [
          'Student enrollment has been created',
          'Student account has been activated',
          'Initial progress tracking has been set up'
        ]
      })
    });
  })
);

export default router;
