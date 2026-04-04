const express = require('express');
const prisma = require('../../../shared/config/database');
const { protect } = require('../../../shared/middleware/auth');

const router = express.Router();

// Get all IPR items with filtering
router.get('/', protect, async (req, res) => {
  try {
    const { type, status, department, priority, search } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if user has any IPR viewing permissions based on role
    const hasViewAll = ['admin', 'staff'].includes(userRole);
    const hasViewOwn = ['faculty', 'student', 'staff'].includes(userRole);
    
    if (!hasViewAll && !hasViewOwn) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view IPR items'
      });
    }
    
    let whereClause = {};
    
    // If user can only view their own IPR, filter by creator
    if (!hasViewAll && hasViewOwn) {
      whereClause.createdById = userId;
    }
    
    if (type && type !== 'all') {
      whereClause.type = type;
    }
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    if (department) {
      whereClause.department = department;
    }
    
    if (priority) {
      whereClause.priority = priority;
    }
    
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { applicant: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    const iprItems = await prisma.iPR.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        },
        approvedBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Batch all counts into 3 groupBy queries instead of 8 sequential count() calls
    const [statusGroups, typeGroups, priorityGroups] = await Promise.all([
      prisma.iPR.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.iPR.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.iPR.groupBy({ by: ['priority'], _count: { id: true } }),
    ]);
    const cbs = Object.fromEntries(statusGroups.map(g => [g.status, g._count.id]));
    const cbt = Object.fromEntries(typeGroups.map(g => [g.type, g._count.id]));
    const cbp = Object.fromEntries(priorityGroups.map(g => [g.priority, g._count.id]));
    const statistics = {
      total: statusGroups.reduce((s, g) => s + g._count.id, 0),
      patents: cbt['patent'] || 0,
      copyrights: cbt['copyright'] || 0,
      trademarks: cbt['trademark'] || 0,
      pending: (cbs['submitted'] || 0) + (cbs['under_review'] || 0),
      approved: (cbs['approved'] || 0) + (cbs['granted'] || 0),
      rejected: cbs['rejected'] || 0,
      highPriority: cbp['high'] || 0,
    };

    res.json({
      success: true,
      data: {
        items: iprItems,
        statistics,
        total: iprItems.length
      }
    });

  } catch (error) {
    console.error('Error fetching IPR items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR items',
      error: error.message
    });
  }
});

// Get single IPR item
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const iprItem = await prisma.iPR.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        },
        approvedBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        },
        documents: true
      }
    });

    if (!iprItem) {
      return res.status(404).json({
        success: false,
        message: 'IPR item not found'
      });
    }

    res.json({
      success: true,
      data: iprItem
    });

  } catch (error) {
    console.error('Error fetching IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR item',
      error: error.message
    });
  }
});

// Create new IPR item
router.post('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if user can file IPR based on role
    const canFile = ['faculty', 'student', 'staff'].includes(userRole);
    
    if (!canFile) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to file IPR applications'
      });
    }
    const {
      title,
      description,
      type,
      department,
      priority,
      estimatedValue,
      applicant,
      coApplicants,
      researchArea,
      keywords,
      technicalSpecifications,
      marketPotential,
      competitiveAdvantage
    } = req.body;

    // Validate required fields
    if (!title || !description || !type || !department || !applicant) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, type, department, and applicant are required'
      });
    }

    // Generate application number based on type and current year
    const currentYear = new Date().getFullYear();
    const typePrefix = {
      patent: 'PAT',
      copyright: 'CR',
      trademark: 'TM'
    };
    
    const count = await prisma.iPR.count({
      where: {
        type,
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`)
        }
      }
    }) + 1;

    const applicationNumber = `${typePrefix[type]}-${currentYear}-${String(count).padStart(4, '0')}`;

    const iprItem = await prisma.iPR.create({
      data: {
        title,
        description,
        type,
        department,
        priority: priority || 'medium',
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
        applicant,
        coApplicants: coApplicants || [],
        researchArea,
        keywords: keywords || [],
        technicalSpecifications,
        marketPotential,
        competitiveAdvantage,
        applicationNumber,
        status: 'draft',
        submissionDate: new Date(),
        createdById: req.user.id
      },
      include: {
        createdBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'IPR item created successfully',
      data: iprItem
    });

  } catch (error) {
    console.error('Error creating IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create IPR item',
      error: error.message
    });
  }
});

// Update IPR item
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if IPR item exists
    const existingItem = await prisma.iPR.findUnique({
      where: { id }
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'IPR item not found'
      });
    }

    // Prevent editing of approved/granted items unless user has admin role
    if (['approved', 'granted'].includes(existingItem.status) && 
        !['admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit approved or granted IPR items'
      });
    }

    const updatedItem = await prisma.iPR.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        createdBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        },
        approvedBy: {
          select: {
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                empId: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'IPR item updated successfully',
      data: updatedItem
    });

  } catch (error) {
    console.error('Error updating IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update IPR item',
      error: error.message
    });
  }
});

// Submit IPR item for review
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const iprItem = await prisma.iPR.findUnique({
      where: { id }
    });

    if (!iprItem) {
      return res.status(404).json({
        success: false,
        message: 'IPR item not found'
      });
    }

    if (iprItem.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft items can be submitted'
      });
    }

    const updatedItem = await prisma.iPR.update({
      where: { id },
      data: {
        status: 'submitted',
        submissionDate: new Date()
      }
    });

    res.json({
      success: true,
      message: 'IPR item submitted for review successfully',
      data: updatedItem
    });

  } catch (error) {
    console.error('Error submitting IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit IPR item',
      error: error.message
    });
  }
});

// Approve/Reject IPR item
router.post('/:id/review', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments, reviewerNotes } = req.body;

    if (!['approve', 'reject', 'request_changes'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve, reject, or request_changes'
      });
    }

    const iprItem = await prisma.iPR.findUnique({
      where: { id }
    });

    if (!iprItem) {
      return res.status(404).json({
        success: false,
        message: 'IPR item not found'
      });
    }

    if (!['submitted', 'under_review'].includes(iprItem.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review items can be reviewed'
      });
    }

    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      request_changes: 'draft'
    };

    const updatedItem = await prisma.iPR.update({
      where: { id },
      data: {
        status: statusMap[action],
        reviewComments: comments,
        reviewerNotes,
        reviewDate: new Date(),
        approvedById: action === 'approve' ? req.user.id : null
      }
    });

    res.json({
      success: true,
      message: `IPR item ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent back for changes'} successfully`,
      data: updatedItem
    });

  } catch (error) {
    console.error('Error reviewing IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review IPR item',
      error: error.message
    });
  }
});

// Get IPR analytics
router.get('/analytics/dashboard', protect, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Current year statistics
    const currentYearStats = await prisma.iPR.groupBy({
      by: ['type', 'status'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`)
        }
      }
    });

    // Previous year statistics for comparison
    const previousYearStats = await prisma.iPR.groupBy({
      by: ['type'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(`${lastYear}-01-01`),
          lt: new Date(`${currentYear}-01-01`)
        }
      }
    });

    // Monthly submissions for current year
    const monthlyStats = await prisma.iPR.findMany({
      where: {
        createdAt: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`)
        }
      },
      select: {
        createdAt: true,
        type: true,
        status: true
      }
    });

    // Department-wise statistics
    const departmentStats = await prisma.iPR.groupBy({
      by: ['department'],
      _count: {
        id: true
      },
      _sum: {
        estimatedValue: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // Top applicants
    const topApplicants = await prisma.iPR.groupBy({
      by: ['applicant'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    res.json({
      success: true,
      data: {
        currentYearStats,
        previousYearStats,
        monthlyStats,
        departmentStats,
        topApplicants,
        summary: {
          totalCurrentYear: monthlyStats.length,
          totalValue: departmentStats.reduce((sum, dept) => sum + (dept._sum.estimatedValue || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching IPR analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPR analytics',
      error: error.message
    });
  }
});

// Delete IPR item
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const iprItem = await prisma.iPR.findUnique({
      where: { id }
    });

    if (!iprItem) {
      return res.status(404).json({
        success: false,
        message: 'IPR item not found'
      });
    }

    // Prevent deletion of approved/granted items
    if (['approved', 'granted'].includes(iprItem.status)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete approved or granted IPR items'
      });
    }

    await prisma.iPR.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'IPR item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting IPR item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete IPR item',
      error: error.message
    });
  }
});

module.exports = router;