import express from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  authenticateUser, 
  requireAdmin,
  requireStudentOrAdmin,
  requireSelfOrAdmin 
} from '../middleware/auth';
import { 
  validateQuery,
  paginationValidation,
  searchValidation
} from '../middleware/validation';
import { asyncHandler, CustomError } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Get student dashboard data
router.get('/dashboard',
  authenticateUser,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;

    // Get student profile
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        user: true,
        enrollments: {
          include: {
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
        },
        progress: {
          include: {
            course: true,
            lessonProgress: {
              include: {
                lesson: true
              }
            }
          }
        },
        registrations: {
          include: {
            course: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!student) {
      throw new CustomError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
    }

    // Calculate overall statistics
    const totalCourses = student.enrollments.length;
    const completedCourses = student.enrollments.filter(e => e.status === 'COMPLETED').length;
    const activeCourses = student.enrollments.filter(e => e.status === 'ACTIVE').length;
    const totalLessons = student.progress.reduce((acc, p) => acc + p.totalLessons, 0);
    const completedLessons = student.progress.reduce((acc, p) => acc + p.completedLessons, 0);
    const overallProgress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // Get recent activities
    const recentProgress = student.progress
      .filter(p => p.lastAccessedAt)
      .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime())
      .slice(0, 5);

    res.json({
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        phone: student.user.phone,
        joinedAt: student.createdAt
      },
      statistics: {
        totalCourses,
        activeCourses,
        completedCourses,
        totalLessons,
        completedLessons,
        overallProgress: Math.round(overallProgress)
      },
      enrollments: student.enrollments.map(enrollment => ({
        id: enrollment.id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        paymentStatus: enrollment.paymentStatus,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          category: enrollment.course.category,
          level: enrollment.course.level,
          totalModules: enrollment.course.modules.length,
          totalLessons: enrollment.course.modules.reduce((acc, module) => acc + module.lessons.length, 0)
        },
        progress: student.progress.find(p => p.courseId === enrollment.course.id)
      })),
      recentActivity: recentProgress.map(progress => ({
        courseId: progress.course.id,
        courseTitle: progress.course.title,
        lastAccessed: progress.lastAccessedAt,
        progressPercent: Math.round(progress.progressPercent),
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons
      })),
      registrations: student.registrations.map(reg => ({
        id: reg.id,
        status: reg.status,
        createdAt: reg.createdAt,
        course: {
          id: reg.course.id,
          title: reg.course.title,
          price: reg.course.price,
          currency: reg.course.currency
        }
      }))
    });
  })
);

// Get all students (Admin only)
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
      where.user = { status };
    }

    if (q) {
      where.user = {
        ...where.user,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      };
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          user: true,
          enrollments: {
            include: {
              course: true
            }
          },
          progress: true,
          registrations: true
        },
        skip: offset,
        take: limit
      }),
      prisma.student.count({ where })
    ]);

    res.json({
      students: students.map(student => ({
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        phone: student.user.phone,
        status: student.user.status,
        joinedAt: student.createdAt,
        statistics: {
          totalEnrollments: student.enrollments.length,
          activeEnrollments: student.enrollments.filter(e => e.status === 'ACTIVE').length,
          totalProgress: student.progress.length,
          averageProgress: student.progress.length > 0 
            ? Math.round(student.progress.reduce((acc, p) => acc + p.progressPercent, 0) / student.progress.length)
            : 0
        },
        lastActivity: student.progress
          .filter(p => p.lastAccessedAt)
          .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime())[0]?.lastAccessedAt
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

// Get single student details
router.get('/:id',
  authenticateUser,
  requireStudentOrAdmin,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        enrollments: {
          include: {
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
        },
        progress: {
          include: {
            course: true,
            lessonProgress: {
              include: {
                lesson: {
                  include: {
                    module: true
                  }
                }
              }
            }
          }
        },
        registrations: {
          include: {
            course: true
          }
        }
      }
    });

    if (!student) {
      throw new CustomError('Student not found', 404, 'STUDENT_NOT_FOUND');
    }

    // Check access permissions
    const isAdmin = req.user!.role === 'ADMIN';
    const isOwner = student.userId === req.user!.id;

    if (!isAdmin && !isOwner) {
      throw new CustomError('Access denied', 403, 'ACCESS_DENIED');
    }

    res.json({
      student: {
        id: student.id,
        personalInfo: {
          name: `${student.user.firstName} ${student.user.lastName}`,
          email: student.user.email,
          phone: student.user.phone,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          nationality: student.nationality
        },
        address: {
          street: student.address,
          city: student.city,
          state: student.state,
          postalCode: student.postalCode,
          country: student.country
        },
        emergencyContact: {
          name: student.emergencyContactName,
          phone: student.emergencyContactPhone,
          email: student.emergencyContactEmail
        },
        academic: {
          previousEducation: student.previousEducation,
          workExperience: student.workExperience
        },
        status: student.user.status,
        joinedAt: student.createdAt
      },
      enrollments: student.enrollments.map(enrollment => ({
        id: enrollment.id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        paymentStatus: enrollment.paymentStatus,
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          description: enrollment.course.description,
          category: enrollment.course.category,
          level: enrollment.course.level,
          duration: enrollment.course.duration,
          price: enrollment.course.price,
          currency: enrollment.course.currency,
          totalModules: enrollment.course.modules.length,
          totalLessons: enrollment.course.modules.reduce((acc, module) => acc + module.lessons.length, 0)
        },
        progress: student.progress.find(p => p.courseId === enrollment.course.id)
      })),
      courseProgress: student.progress.map(progress => ({
        id: progress.id,
        course: {
          id: progress.course.id,
          title: progress.course.title
        },
        completedLessons: progress.completedLessons,
        totalLessons: progress.totalLessons,
        progressPercent: Math.round(progress.progressPercent),
        totalTimeSpent: progress.totalTimeSpent,
        lastAccessedAt: progress.lastAccessedAt,
        lessonDetails: progress.lessonProgress.map(lp => ({
          lessonId: lp.lesson.id,
          lessonTitle: lp.lesson.title,
          moduleTitle: lp.lesson.module.title,
          isCompleted: lp.isCompleted,
          completedAt: lp.completedAt,
          timeSpent: lp.timeSpent
        }))
      })),
      registrations: student.registrations.map(reg => ({
        id: reg.id,
        status: reg.status,
        createdAt: reg.createdAt,
        reviewedAt: reg.reviewedAt,
        course: {
          id: reg.course.id,
          title: reg.course.title,
          price: reg.course.price,
          currency: reg.course.currency
        }
      }))
    });
  })
);

// Update student profile
router.put('/profile',
  authenticateUser,
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;
    const {
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
      workExperience
    } = req.body;

    const student = await prisma.student.findUnique({
      where: { userId }
    });

    if (!student) {
      throw new CustomError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
    }

    const updatedStudent = await prisma.student.update({
      where: { userId },
      data: {
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender && { gender }),
        ...(nationality && { nationality }),
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(postalCode && { postalCode }),
        ...(country && { country }),
        ...(emergencyContactName && { emergencyContactName }),
        ...(emergencyContactPhone && { emergencyContactPhone }),
        ...(emergencyContactEmail && { emergencyContactEmail }),
        ...(previousEducation && { previousEducation }),
        ...(workExperience && { workExperience })
      },
      include: {
        user: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      student: {
        id: updatedStudent.id,
        personalInfo: {
          name: `${updatedStudent.user.firstName} ${updatedStudent.user.lastName}`,
          email: updatedStudent.user.email,
          phone: updatedStudent.user.phone,
          dateOfBirth: updatedStudent.dateOfBirth,
          gender: updatedStudent.gender,
          nationality: updatedStudent.nationality
        },
        address: {
          street: updatedStudent.address,
          city: updatedStudent.city,
          state: updatedStudent.state,
          postalCode: updatedStudent.postalCode,
          country: updatedStudent.country
        },
        emergencyContact: {
          name: updatedStudent.emergencyContactName,
          phone: updatedStudent.emergencyContactPhone,
          email: updatedStudent.emergencyContactEmail
        },
        academic: {
          previousEducation: updatedStudent.previousEducation,
          workExperience: updatedStudent.workExperience
        }
      }
    });
  })
);

export default router;
