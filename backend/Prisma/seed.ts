import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eckschool.com' },
    update: {},
    create: {
      email: 'admin@eckschool.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+234-123-456-7890',
      role: 'ADMIN',
      status: 'ACTIVE',
      adminUser: {
        create: {
          department: 'Administration',
          permissions: ['MANAGE_STUDENTS', 'MANAGE_COURSES', 'VIEW_REPORTS']
        }
      }
    },
    include: {
      adminUser: true
    }
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create sample student
  const studentPassword = await bcrypt.hash('student123', 12);
  
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      password: studentPassword,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+234-987-654-3210',
      role: 'STUDENT',
      status: 'ACTIVE',
      student: {
        create: {
          dateOfBirth: new Date('1995-06-15'),
          gender: 'Male',
          nationality: 'Nigerian',
          address: '123 Main Street',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '100001',
          country: 'Nigeria',
          emergencyContactName: 'Jane Doe',
          emergencyContactPhone: '+234-555-123-456',
          emergencyContactEmail: 'jane.doe@example.com',
          previousEducation: 'Bachelor\'s Degree in Business Administration',
          workExperience: '2 years in accounting'
        }
      }
    },
    include: {
      student: true
    }
  });

  console.log('✅ Sample student created:', studentUser.email);

  // Create ICA courses
  const icaCourses = [
    {
      title: 'ICA Foundation',
      description: 'Foundation level certification in accounting fundamentals, business ethics, and basic financial reporting.',
      category: 'Professional',
      level: 'Foundation',
      duration: '6 months',
      price: 150000,
      currency: 'NGN',
      prerequisites: 'WAEC/NECO with Mathematics and English'
    },
    {
      title: 'ICA Intermediate',
      description: 'Intermediate level covering advanced accounting principles, corporate reporting, and taxation.',
      category: 'Professional',
      level: 'Intermediate',
      duration: '8 months',
      price: 200000,
      currency: 'NGN',
      prerequisites: 'ICA Foundation or equivalent qualification'
    },
    {
      title: 'ICA Professional',
      description: 'Professional level qualification covering strategic management accounting, audit, and corporate finance.',
      category: 'Professional',
      level: 'Professional',
      duration: '12 months',
      price: 300000,
      currency: 'NGN',
      prerequisites: 'ICA Intermediate or relevant degree'
    },
    {
      title: 'ICA Public Sector Accounting',
      description: 'Specialized course in public sector financial management and governmental accounting principles.',
      category: 'Specialized',
      level: 'Intermediate',
      duration: '6 months',
      price: 180000,
      currency: 'NGN',
      prerequisites: 'Basic accounting knowledge'
    },
    {
      title: 'ICA Forensic Accounting',
      description: 'Advanced course in forensic accounting, fraud detection, and financial investigation techniques.',
      category: 'Specialized',
      level: 'Advanced',
      duration: '9 months',
      price: 250000,
      currency: 'NGN',
      prerequisites: 'ICA Intermediate or professional experience'
    },
    {
      title: 'ICA Islamic Finance',
      description: 'Comprehensive course on Islamic banking, Sharia-compliant finance, and ethical financial practices.',
      category: 'Specialized',
      level: 'Intermediate',
      duration: '6 months',
      price: 175000,
      currency: 'NGN',
      prerequisites: 'Basic finance knowledge'
    }
  ];

  for (const courseData of icaCourses) {
    const course = await prisma.course.upsert({
      where: { title: courseData.title },
      update: courseData,
      create: courseData
    });
    console.log('✅ Course created:', course.title);
  }

  // Create modules and lessons for ICA Foundation course
  const foundationCourse = await prisma.course.findFirst({
    where: { title: 'ICA Foundation' }
  });

  if (foundationCourse) {
    const modules = [
      {
        title: 'Accounting Fundamentals',
        description: 'Basic principles of accounting and bookkeeping',
        orderIndex: 1,
        lessons: [
          {
            title: 'Introduction to Accounting',
            description: 'Overview of accounting principles and concepts',
            content: 'This lesson covers the basic principles of accounting...',
            orderIndex: 1,
            duration: '45 minutes'
          },
          {
            title: 'Double Entry Bookkeeping',
            description: 'Understanding the double entry system',
            content: 'Learn the fundamental concept of double entry...',
            orderIndex: 2,
            duration: '60 minutes'
          },
          {
            title: 'Chart of Accounts',
            description: 'Setting up and managing chart of accounts',
            content: 'A comprehensive guide to organizing accounts...',
            orderIndex: 3,
            duration: '30 minutes'
          }
        ]
      },
      {
        title: 'Financial Statements',
        description: 'Preparation and analysis of financial statements',
        orderIndex: 2,
        lessons: [
          {
            title: 'Balance Sheet Preparation',
            description: 'How to prepare a balance sheet',
            content: 'Step-by-step guide to balance sheet preparation...',
            orderIndex: 1,
            duration: '50 minutes'
          },
          {
            title: 'Income Statement',
            description: 'Creating profit and loss statements',
            content: 'Understanding revenue, expenses, and profit...',
            orderIndex: 2,
            duration: '45 minutes'
          }
        ]
      },
      {
        title: 'Business Ethics',
        description: 'Professional ethics and conduct in accounting',
        orderIndex: 3,
        lessons: [
          {
            title: 'Professional Ethics',
            description: 'Ethical standards for accountants',
            content: 'The importance of integrity in accounting...',
            orderIndex: 1,
            duration: '40 minutes'
          }
        ]
      }
    ];

    for (const moduleData of modules) {
      const { lessons, ...moduleInfo } = moduleData;
      const module = await prisma.courseModule.create({
        data: {
          ...moduleInfo,
          courseId: foundationCourse.id,
          lessons: {
            create: lessons
          }
        },
        include: {
          lessons: true
        }
      });
      console.log(`✅ Module created: ${module.title} with ${module.lessons.length} lessons`);
    }
  }

  // Create sample YouTube videos
  const youtubeVideos = [
    {
      title: 'Introduction to Accounting Principles',
      description: 'Basic accounting concepts every student should know',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      category: 'Foundation',
      tags: ['accounting', 'basics', 'principles'],
      duration: '12:34'
    },
    {
      title: 'Financial Statement Analysis',
      description: 'How to read and analyze financial statements',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      category: 'Intermediate',
      tags: ['financial-statements', 'analysis', 'reporting'],
      duration: '18:45'
    },
    {
      title: 'Double Entry Bookkeeping Explained',
      description: 'Complete guide to double entry bookkeeping system',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      category: 'Foundation',
      tags: ['bookkeeping', 'double-entry', 'accounting'],
      duration: '15:22'
    },
    {
      title: 'Business Ethics in Accounting',
      description: 'Professional ethics and conduct for accountants',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      category: 'Professional',
      tags: ['ethics', 'professional', 'conduct'],
      duration: '20:11'
    },
    {
      title: 'Taxation Basics for Accountants',
      description: 'Understanding tax principles and calculations',
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      category: 'Intermediate',
      tags: ['taxation', 'tax', 'calculations'],
      duration: '25:33'
    }
  ];

  for (const videoData of youtubeVideos) {
    const video = await prisma.youTubeVideo.upsert({
      where: { videoId: `${videoData.videoId}-${videoData.title}` },
      update: videoData,
      create: {
        ...videoData,
        videoId: `${videoData.videoId}-${videoData.title}` // Make unique
      }
    });
    console.log('✅ YouTube video created:', video.title);
  }

  // Create sample enrollment and progress
  if (foundationCourse && studentUser.student) {
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: studentUser.student.id,
        courseId: foundationCourse.id,
        status: 'ACTIVE',
        paymentStatus: 'COMPLETED',
        paymentMethod: 'Bank Transfer'
      }
    });

    const totalLessons = await prisma.lesson.count({
      where: {
        module: {
          courseId: foundationCourse.id
        }
      }
    });

    const progress = await prisma.studentProgress.create({
      data: {
        studentId: studentUser.student.id,
        courseId: foundationCourse.id,
        completedLessons: 2,
        totalLessons: totalLessons,
        progressPercent: (2 / totalLessons) * 100,
        totalTimeSpent: 105, // 1 hour 45 minutes
        lastAccessedAt: new Date()
      }
    });

    console.log('✅ Sample enrollment and progress created');
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
