import { FastifyInstance } from 'fastify';

export default async function b2bRoutes(fastify: FastifyInstance) {
  
  // ====================================
  // ADMIN: B2B APPROVAL WORKFLOW
  // ====================================

  /**
   * GET /api/v1/admin/b2b/requests
   * List all B2B registration requests (for admin approval)
   */
  fastify.get('/admin/b2b/requests', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      description: 'List B2B registration requests for admin review',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'] },
          limit: { type: 'integer', default: 50 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { status, limit = 50 } = request.query as any;

      // Build query filter
      const where: any = {};
      if (status) {
        where.accountStatus = status;
      } else {
        // Default: Show pending, pending_docs and in-review
        where.accountStatus = { in: ['PENDING', 'PENDING_DOCS', 'IN_REVIEW'] };
      }

      // Fetch users with B2B company details
      const users = await fastify.prisma.user.findMany({
        where: {
          ...where,
          role: {
            name: { in: ['CUSTOMER', 'BUSINESS'] }
          }
        },
        include: {
          role: true,
          b2bCompanyDetails: true
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      // Filter only users with company details (B2B)
      const b2bRequests = users
        .filter(user => user.b2bCompanyDetails)
        .map(user => ({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accountStatus: user.accountStatus,
            createdAt: user.createdAt,
            isActive: user.isActive
          },
          company: {
            companyName: user.b2bCompanyDetails!.companyName,
            taxId: user.b2bCompanyDetails!.taxId,
            registrationCountry: user.b2bCompanyDetails!.registrationCountry,
            registrationDate: user.b2bCompanyDetails!.registrationDate,
            companyAddress: user.b2bCompanyDetails!.companyAddress,
            registrationProofUrl: user.b2bCompanyDetails!.registrationProofUrl,
            doingBusinessAs: user.b2bCompanyDetails!.doingBusinessAs
          },
          contacts: {
            primaryContactName: user.b2bCompanyDetails!.primaryContactName,
            jobTitle: user.b2bCompanyDetails!.jobTitle,
            contactPhone: user.b2bCompanyDetails!.contactPhone,
            contactCountryCode: user.b2bCompanyDetails!.contactCountryCode,
            billingEmail: user.b2bCompanyDetails!.billingEmail,
            shippingAddress: user.b2bCompanyDetails!.shippingAddress,
            apContactName: user.b2bCompanyDetails!.apContactName,
            apPhone: user.b2bCompanyDetails!.apPhone,
            apCountryCode: user.b2bCompanyDetails!.apCountryCode
          }
        }));

      return b2bRequests;
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch B2B requests' });
    }
  });

  /**
   * GET /api/v1/admin/b2b/requests/:userId
   * Get specific B2B registration request details
   */
  fastify.get('/admin/b2b/requests/:userId', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      description: 'Get B2B registration request details',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as any;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: true,
          b2bCompanyDetails: true,
          b2bProfile: true
        }
      });

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          accountStatus: user.accountStatus,
          createdAt: user.createdAt,
          isActive: user.isActive
        },
        company: user.b2bCompanyDetails ? {
          companyName: user.b2bCompanyDetails.companyName,
          taxId: user.b2bCompanyDetails.taxId,
          registrationCountry: user.b2bCompanyDetails.registrationCountry,
          registrationDate: user.b2bCompanyDetails.registrationDate,
          companyAddress: user.b2bCompanyDetails.companyAddress,
          registrationProofUrls: user.b2bCompanyDetails.registrationProofUrls,
          doingBusinessAs: user.b2bCompanyDetails.doingBusinessAs
        } : null,
        contacts: user.b2bCompanyDetails ? {
          primaryContactName: user.b2bCompanyDetails.primaryContactName,
          jobTitle: user.b2bCompanyDetails.jobTitle,
          contactPhone: user.b2bCompanyDetails.contactPhone,
          contactCountryCode: user.b2bCompanyDetails.contactCountryCode,
          billingEmail: user.b2bCompanyDetails.billingEmail,
          shippingAddress: user.b2bCompanyDetails.shippingAddress,
          apContactName: user.b2bCompanyDetails.apContactName,
          apPhone: user.b2bCompanyDetails.apPhone,
          apCountryCode: user.b2bCompanyDetails.apCountryCode
        } : null,
        profile: user.b2bProfile ? {
          id: user.b2bProfile.id,
          companyName: user.b2bProfile.companyName,
          creditLimit: user.b2bProfile.creditLimit,
          usedCredit: user.b2bProfile.usedCredit,
          paymentTerms: user.b2bProfile.paymentTerms,
          status: user.b2bProfile.status
        } : null
      };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch B2B request details: ' + err.message });
    }
  });

  /**
   * PATCH /api/v1/admin/b2b/requests/:userId/status
   * Approve or reject B2B application
   */
  fastify.patch('/admin/b2b/requests/:userId/status', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      description: 'Approve or reject a B2B registration',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
          creditLimit: { type: 'number', default: 5000 },
          rejectionReason: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { userId } = request.params as any;
    const { action, creditLimit = 5000, rejectionReason } = request.body as any;

    try {
      // Check if user exists
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        include: { b2bCompanyDetails: true }
      });

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      if (!user.b2bCompanyDetails) {
        return reply.status(400).send({ message: 'User is not a B2B applicant' });
      }

      if (action === 'APPROVE') {
        // Approve: Set active, update status
        const updatedUser = await fastify.prisma.user.update({
          where: { id: userId },
          data: {
            isActive: true,
            accountStatus: 'APPROVED'
          }
        });

        // Send approval email
        const { emailService } = await import('../services/email.service');
        await emailService.sendB2BApprovalEmail(
          user.email,
          user.firstName || 'Valued Customer',
          creditLimit
        );

        // Log activity
        const { logActivity } = await import('../utils/audit');
        await logActivity(fastify, {
          entityType: 'USER',
          entityId: user.id,
          action: 'B2B_APPROVED',
          performedBy: (request.user as any).id,
          details: { companyName: user.b2bCompanyDetails.companyName, creditLimit },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return {
          message: 'B2B account approved successfully',
          user: updatedUser
        };

      } else if (action === 'REJECT') {
        // Reject: Update status
        const updatedUser = await fastify.prisma.user.update({
          where: { id: userId },
          data: {
            accountStatus: 'REJECTED',
            isActive: false
          }
        });

        // Send rejection email
        const { emailService } = await import('../services/email.service');
        await emailService.sendB2BRejectionEmail(
          user.email,
          user.firstName || 'Applicant',
          rejectionReason
        );

        // Log activity
        const { logActivity } = await import('../utils/audit');
        await logActivity(fastify, {
          entityType: 'USER',
          entityId: user.id,
          action: 'B2B_REJECTED',
          performedBy: (request.user as any).id,
          details: { companyName: user.b2bCompanyDetails.companyName, reason: rejectionReason },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return {
          message: 'B2B account rejected',
          user: updatedUser
        };
      }

      return reply.status(400).send({ message: 'Invalid action' });

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  // ====================================
  // ADMIN: RFQ MANAGEMENT
  // ====================================

  /**
   * GET /api/v1/admin/b2b/rfq
   * List all RFQs across all B2B users
   */
  fastify.get('/admin/b2b/rfq', {
    preHandler: [fastify.authenticate, fastify.hasPermission('order_view')],
    schema: {
      description: 'List all RFQs for admin review',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const rfqs = await fastify.prisma.rFQ.findMany({
        include: { 
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, b2bCompanyDetails: true }
            },
            items: { include: { product: true } } 
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map notes to title for frontend compatibility
      const mappedRfqs = rfqs.map((r: any) => {
        let title = `RFQ-${r.id.substring(0, 8)}`;
        if (r.notes) {
          try {
             const parsed = JSON.parse(r.notes);
             if (parsed.title) title = parsed.title;
          } catch(e) {
             title = r.notes.split('\n')[0];
          }
        }
        return {
          ...r,
          title
        };
      });

      return reply.send(mappedRfqs);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch Admin RFQs' });
    }
  });

  /**
   * GET /api/v1/admin/b2b/rfq/:id
   * Get specific RFQ details for admin
   */
  fastify.get('/admin/b2b/rfq/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('order_view')],
    schema: {
      description: 'Get specific RFQ details',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const rfq = await fastify.prisma.rFQ.findUnique({
        where: { id },
        include: { 
          user: { select: { id: true, firstName: true, lastName: true, email: true, b2bCompanyDetails: true } },
          items: { include: { product: true } }
        }
      });
      if (!rfq) return reply.status(404).send({ message: 'RFQ not found' });
      return reply.send(rfq);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch RFQ details' });
    }
  });

  /**
   * PATCH /api/v1/admin/b2b/rfq/:id/quote
   * Admin sets custom price/quote for an RFQ
   */
  fastify.patch('/admin/b2b/rfq/:id/quote', {
    preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
    schema: {
      description: 'Update RFQ status or provide a quote',
      tags: ['Admin B2B Management'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED'] },
          adminNotes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, quotedPrice: { type: 'number' } }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status, adminNotes, items } = request.body as any;
      
      const rfq = await fastify.prisma.rFQ.findUnique({ where: { id } });
      if (!rfq) return reply.status(404).send({ message: 'RFQ not found' });

      // Update basic details
      const updateData: any = {};
      if (status) updateData.status = status;
      if (adminNotes) {
         try {
             // Try parsing existing notes if it's JSON
             const currentNotes = JSON.parse(rfq.notes || '{}');
             currentNotes.adminNotes = adminNotes;
             updateData.notes = JSON.stringify(currentNotes);
         } catch(e) {
             updateData.notes = rfq.notes + `\n\nAdmin: ${adminNotes}`;
         }
      }

      const updated = await fastify.prisma.rFQ.update({
        where: { id },
        data: updateData
      });

      // Update individual item prices if provided
      if (items && items.length > 0) {
         await Promise.all(items.map((item: any) => 
            fastify.prisma.rFQItem.update({
                where: { id: item.id },
                data: { quotedPrice: item.quotedPrice }
            })
         ));
      }

      return reply.send({ message: 'RFQ updated successfully', rfq: updated });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update RFQ' });
    }
  });

  // ====================================
  // B2B OPERATIONS
  // ====================================
  
  // Get Current User's B2B Profile (Credit info)
  fastify.get('/b2b/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get logged in user B2B credit profile',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        include: { b2bProfile: true }
      });

      if (!user || !user.b2bProfile) {
        // Return 200 with null or empty to prevent frontend crash
        return reply.send(null);
      }

      return reply.send(user.b2bProfile);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch B2B profile' });
    }
  });

  // Get My RFQs
  fastify.get('/b2b/rfq', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all RFQs for the logged in B2B user',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const rfqs = await fastify.prisma.rFQ.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' }
      });

      // Map notes to title for frontend compatibility
      const mappedRfqs = rfqs.map((r: any) => {
        let title = `RFQ-${r.id.substring(0, 8)}`;
        if (r.notes) {
          try {
             const parsed = JSON.parse(r.notes);
             if (parsed.title) title = parsed.title;
          } catch(e) {
             title = r.notes.split('\n')[0];
          }
        }
        return {
          ...r,
          title
        };
      });

      return reply.send(mappedRfqs);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch RFQs' });
    }
  });

  // Get RFQ Details by ID
  fastify.get('/b2b/rfq/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get RFQ details',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const userId = (request.user as any).id;
      
      const rfq = await fastify.prisma.rFQ.findFirst({
        where: { id, userId },
        include: { 
          items: {
            include: { product: true }
          }
        }
      });

      if (!rfq) return reply.status(404).send({ message: 'RFQ not found' });

      return reply.send(rfq);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch RFQ' });
    }
  });

  // Submit RFQ
  fastify.post('/b2b/rfq', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Submits a Request for Quotation',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const { title, description, items } = request.body as any;

      // Pack title and description into notes JSON for future-proofing without DB change
      const notesJson = JSON.stringify({
        title: title || 'New RFQ',
        description: description || ''
      });

      const rfq = await fastify.prisma.rFQ.create({
        data: {
          userId,
          status: 'DRAFT', // or SUBMITTED depending on items
          notes: notesJson,
          items: items?.length > 0 ? {
            create: items.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity
            }))
          } : undefined
        }
      });

      return reply.send(rfq);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create RFQ' });
    }
  });

  // Update RFQ Status (Accept/Reject Quote)
  fastify.patch('/b2b/rfq/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Accept or reject an RFQ quote',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] }
        },
        required: ['status']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;
      const userId = (request.user as any).id;

      // Ensure the RFQ belongs to the user
      const existingRfq = await fastify.prisma.rFQ.findFirst({
        where: { id, userId }
      });

      if (!existingRfq) {
        return reply.status(404).send({ message: 'RFQ not found' });
      }

      // Only allow accepting/rejecting if it's currently QUOTED
      if (existingRfq.status !== 'QUOTED') {
        return reply.status(400).send({ message: 'Only QUOTED RFQs can be accepted or rejected by the customer' });
      }

      const updatedRfq = await fastify.prisma.rFQ.update({
        where: { id },
        data: { status }
      });

      return reply.send(updatedRfq);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update RFQ status' });
    }
  });


  // Check Credit
  fastify.get('/b2b/finance/credit', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Checks current credit limit and available balance',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        include: { b2bProfile: true }
      });
      if (!user || !user.b2bProfile) return reply.send({ limit: 0, used: 0, available: 0 });
      return reply.send({ 
        limit: Number(user.b2bProfile.creditLimit), 
        used: Number(user.b2bProfile.usedCredit), 
        available: Math.max(0, Number(user.b2bProfile.creditLimit) - Number(user.b2bProfile.usedCredit)) 
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to check credit' });
    }
  });

  // ====================================
  // B2B TEAM MANAGEMENT
  // ====================================

  // Get My Team Members
  fastify.get('/b2b/team', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all team members for the logged in B2B user',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { b2bProfileId: true }
      });

      if (!user?.b2bProfileId) {
        return reply.status(403).send({ message: 'No B2B profile associated with this account' });
      }

      const members = await fastify.prisma.b2b_team_members.findMany({
        where: { b2b_profile_id: user.b2bProfileId },
        include: {
          users: {
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true }
          }
        }
      });

      return reply.send(members);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch team members' });
    }
  });

  // Invite/Add Team Member
  fastify.post('/b2b/team/invite', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Invites a new team member to the B2B account',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'firstName', 'lastName', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'BUYER', 'MANAGER'] },
          orderLimit: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, firstName, lastName, role, orderLimit } = request.body as any;
    const requesterId = (request.user as any).id;
    const { randomUUID } = await import('crypto');

    try {
      // 1. Get requester's B2B profile
      const requester = await fastify.prisma.user.findUnique({
        where: { id: requesterId },
        select: { b2bProfileId: true }
      });

      if (!requester?.b2bProfileId) {
        return reply.status(403).send({ message: 'Unauthorized: No B2B profile' });
      }

      // 2. Check if user already exists
      let targetUser = await fastify.prisma.user.findUnique({ where: { email } });

      if (targetUser) {
        if (targetUser.b2bProfileId) {
          return reply.status(400).send({ message: 'User is already part of a B2B account' });
        }
      } else {
        // Create new user (temporary password, they should reset it or use invite link)
        // In a real app, send an invite email with a token
        const { hash } = await import('bcryptjs');
        const tempPassword = await hash('B2BUser123!', 10);
        
        // Get generic role for B2B users
        const b2bRole = await fastify.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

        targetUser = await fastify.prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            passwordHash: tempPassword,
            roleId: b2bRole?.id || '',
            b2bProfileId: requester.b2bProfileId,
            accountStatus: 'APPROVED',
            isActive: true
          }
        });
      }

      // 3. Create team member record
      const teamMember = await fastify.prisma.b2b_team_members.create({
        data: {
          id: randomUUID(),
          user_id: targetUser.id,
          b2b_profile_id: requester.b2bProfileId,
          role: role,
          status: 'ACTIVE',
          order_approval_limit: orderLimit || 0,
          updated_at: new Date()
        }
      });

      return reply.send({ message: 'Team member added successfully', member: teamMember });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to invite team member: ' + err.message });
    }
  });

  // Remove Team Member
  fastify.delete('/b2b/team/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Removes a team member from the B2B account',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any; // team member record id
    const requesterId = (request.user as any).id;

    try {
      const requester = await fastify.prisma.user.findUnique({
        where: { id: requesterId },
        select: { b2bProfileId: true }
      });

      const member = await fastify.prisma.b2b_team_members.findUnique({
        where: { id },
        include: { users: true }
      });

      if (!member || member.b2b_profile_id !== requester?.b2bProfileId) {
        return reply.status(404).send({ message: 'Member not found or unauthorized' });
      }

      // Cannot remove yourself
      if (member.user_id === requesterId) {
        return reply.status(400).send({ message: 'You cannot remove yourself from the team' });
      }

      // Delete the team member record
      await fastify.prisma.b2b_team_members.delete({ where: { id } });

      // De-link the user from the B2B profile
      await fastify.prisma.user.update({
        where: { id: member.user_id },
        data: { b2bProfileId: null }
      });

      return reply.send({ message: 'Member removed successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to remove member' });
    }
  });

  // ====================================
  // B2B CUSTOM CATALOGS
  // ====================================

  // Get My Catalogs
  fastify.get('/b2b/catalogs', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all custom catalogs for the logged in B2B user',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { b2bProfileId: true }
      });

      if (!user?.b2bProfileId) {
        return reply.status(403).send({ message: 'No B2B profile associated with this account' });
      }

      const catalogs = await fastify.prisma.custom_catalogs.findMany({
        where: { 
          b2b_profile_id: user.b2bProfileId,
          is_active: true
        },
        orderBy: { created_at: 'desc' }
      });

      return reply.send(catalogs);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch catalogs' });
    }
  });

  // Get Catalog Details (with products)
  fastify.get('/b2b/catalogs/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get specific catalog details and items',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const userId = (request.user as any).id;
      
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { b2bProfileId: true }
      });

      if (!user?.b2bProfileId) {
        return reply.status(403).send({ message: 'Unauthorized: No B2B profile' });
      }

      const catalog = await fastify.prisma.custom_catalogs.findFirst({
        where: { 
          id, 
          b2b_profile_id: user.b2bProfileId 
        },
        include: {
          custom_catalog_items: {
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  images: true
                }
              }
            }
          }
        }
      });

      if (!catalog) return reply.status(404).send({ message: 'Catalog not found' });

      return reply.send(catalog);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch catalog details' });
    }
  });

  // ====================================
  // B2B PURCHASE ORDERS
  // ====================================

  // Get My Purchase Orders
  fastify.get('/b2b/purchase-orders', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all purchase orders for the logged in B2B user',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).id;
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { b2bProfileId: true }
      });

      if (!user?.b2bProfileId) {
        return reply.status(403).send({ message: 'No B2B profile associated with this account' });
      }

      const pos = await fastify.prisma.purchase_orders.findMany({
        where: { b2b_profile_id: user.b2bProfileId },
        include: {
          users: { select: { firstName: true, lastName: true, email: true } },
          orders: { select: { status: true, totalAmount: true } }
        },
        orderBy: { created_at: 'desc' }
      });

      return reply.send(pos);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch purchase orders' });
    }
  });

  // Get Specific Purchase Order Details
  fastify.get('/b2b/purchase-orders/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get details of a specific purchase order',
      tags: ['B2B Operations'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const userId = (request.user as any).id;
      
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { b2bProfileId: true }
      });

      if (!user?.b2bProfileId) {
        return reply.status(403).send({ message: 'No B2B profile associated with this account' });
      }

      const po = await fastify.prisma.purchase_orders.findFirst({
        where: { id, b2b_profile_id: user.b2bProfileId },
        include: {
          users: { select: { firstName: true, lastName: true, email: true } },
          orders: { include: { items: { include: { product: true } } } }
        }
      });


      if (!po) return reply.status(404).send({ message: 'Purchase order not found' });

      return reply.send(po);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch purchase order details' });
    }
  });

}
