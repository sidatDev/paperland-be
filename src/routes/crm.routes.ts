import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';

export default async function crmRoutes(fastify: FastifyInstance) {
  
  // Customer List
  fastify.get('/admin/customers', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      description: 'Retrieves a list of all registered portal users',
      tags: ['CRM Management'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          type: { type: 'string', enum: ['CUSTOMER', 'BUSINESS', 'DEALER'] },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { search, type, page, limit } = request.query as any;
      const skip = (page - 1) * limit;

      const where: any = {
        role: {
          name: { in: ['CUSTOMER', 'BUSINESS', 'B2B_ADMIN', 'DEALER'] }
        }
      };

      if (type && type !== 'all') {
        where.role = { name: type };
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { b2bCompanyDetails: { companyName: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const [customers, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            role: true,
            b2bCompanyDetails: true,
            b2bProfile: true,
            _count: {
                select: { orders: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        fastify.prisma.user.count({ where })
      ]);

      const formattedCustomers = customers.map((user: any) => ({
        id: user.id,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.b2bCompanyDetails?.companyName || 'N/A'),
        type: (user.role?.name === 'BUSINESS' || user.role?.name === 'B2B_ADMIN') ? 'B2B' : (user.role?.name === 'DEALER' ? 'DEALER' : 'B2C'),
        email: user.email,
        region: user.b2bCompanyDetails?.registrationCountry || 'N/A',
        orders: user._count.orders,
        status: user.accountStatus.toLowerCase(),
        companyName: user.b2bCompanyDetails?.companyName || null
      }));

      return {
        data: formattedCustomers,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  // B2B Pending Approvals
  fastify.get('/admin/customers/b2b-pending', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      description: 'Fetch paginated list of pending B2B accounts (IN_REVIEW)',
      tags: ['CRM Management'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, search } = request.query as any;
      const skip = (page - 1) * limit;

      const where: any = {
        accountStatus: { in: ['PENDING', 'PENDING_DOCS', 'IN_REVIEW'] },
        b2bCompanyDetails: { isNot: null }
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { b2bCompanyDetails: { companyName: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const [pendingUsers, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: { b2bCompanyDetails: true },
          orderBy: { createdAt: 'desc' }
        }),
        fastify.prisma.user.count({ where })
      ]);

    const data = pendingUsers.map((user: any) => ({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountStatus: user.accountStatus,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      company: {
        companyName: user.b2bCompanyDetails?.companyName || 'N/A',
        taxId: user.b2bCompanyDetails?.taxId || 'N/A',
        registrationCountry: user.b2bCompanyDetails?.registrationCountry || 'N/A'
      },
      contacts: {
        primaryContactName: user.b2bCompanyDetails?.primaryContactName || 'N/A',
        contactPhone: user.b2bCompanyDetails?.contactPhone || 'N/A',
        billingEmail: user.b2bCompanyDetails?.billingEmail || user.email
      }
    }));

      return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Alias for backward compatibility if needed, or specific approvals tab
  fastify.get('/admin/customers/approvals', {
    preHandler: [fastify.authenticate],
    schema: { hide: true }
  }, async (request, reply) => {
    return reply.redirect('/api/v1/admin/customers/b2b-pending');
  });

  // Customer Detail
  fastify.get('/admin/customers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      description: 'Get detailed information for a specific customer',
      tags: ['CRM Management'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      const user = await (fastify.prisma.user.findUnique({
        where: { id },
        include: {
          role: true,
          b2bCompanyDetails: true,
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: {
                include: {
                  product: true
                }
              }
            }
          },
          addresses: true,
          orders: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      }) as any);

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
          isActive: user.isActive,
          phone: user.b2bCompanyDetails?.contactPhone || user.phoneNumber || 'N/A', // Use user.phoneNumber as fallback
          address: user.b2bCompanyDetails?.companyAddress || (user.addresses?.[0] ? `${user.addresses[0].street1}${user.addresses[0].street2 ? ', ' + user.addresses[0].street2 : ''}, ${user.addresses[0].city}` : 'N/A')
        },
        company: user.b2bCompanyDetails ? {
          companyName: user.b2bCompanyDetails.companyName,
          taxId: user.b2bCompanyDetails.taxId,
          registrationCountry: user.b2bCompanyDetails.registrationCountry,
          registrationDate: user.b2bCompanyDetails.registrationDate,
          companyAddress: user.b2bCompanyDetails.companyAddress,
          registrationProofUrls: (user.b2bCompanyDetails as any).registrationProofUrls,
          doingBusinessAs: user.b2bCompanyDetails.doingBusinessAs,
          authorizedRepresentativeName: (user.b2bCompanyDetails as any).authorizedRepresentativeName,
          authorizedRepresentativeEmail: (user.b2bCompanyDetails as any).authorizedRepresentativeEmail,
          registeredLegalEntity: (user.b2bCompanyDetails as any).registeredLegalEntity,
          primaryContactName: user.b2bCompanyDetails.primaryContactName,
          jobTitle: user.b2bCompanyDetails.jobTitle,
          contactPhone: user.b2bCompanyDetails.contactPhone,
          billingEmail: user.b2bCompanyDetails.billingEmail,
          shippingAddress: user.b2bCompanyDetails.shippingAddress,
          apContactName: user.b2bCompanyDetails.apContactName,
          apPhone: user.b2bCompanyDetails.apPhone
        } : null,
        profile: user.b2bProfile ? {
          id: user.b2bProfile.id,
          companyName: user.b2bProfile.companyName,
          creditLimit: user.b2bProfile.creditLimit,
          usedCredit: user.b2bProfile.usedCredit,
          paymentTerms: user.b2bProfile.paymentTerms,
          status: user.b2bProfile.status,
          adminNotes: (user.b2bProfile as any).adminNotes,
          rejectionReason: (user.b2bProfile as any).rejectionReason,
          discountTier: user.b2bProfile.discountTier,
          discountOverrides: user.b2bProfile.discountOverrides.map((o: any) => ({
            id: o.id,
            productId: o.productId,
            productName: o.product?.name || "Unknown Product",
            productSku: o.product?.sku || "N/A",
            discountPercent: o.discountPercent,
            isActive: o.isActive
          }))
        } : null,
        orders: user.orders.map((o: any) => ({
            id: o.id,
            date: o.createdAt.toISOString().split('T')[0],
            amount: `SAR ${o.totalAmount}`,
            status: o.status.toLowerCase()
        }))
      };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  // Assign Discount Tier
  fastify.post('/admin/customers/:id/assign-tier', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['CRM Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['tierId'],
        properties: {
          tierId: { type: 'string', nullable: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { tierId } = request.body as any;

      const user = await fastify.prisma.user.findUnique({
        where: { id },
        select: { b2bProfileId: true }
      });

      if (!user || !user.b2bProfileId) {
        return reply.status(404).send({ message: 'User or B2B Profile not found' });
      }

      await (fastify.prisma.b2BProfile.update({
        where: { id: user.b2bProfileId },
        data: { discountTierId: tierId }
      }) as any);

      await logActivity(fastify, {
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE_B2B_TIER',
        performedBy: (request.user as any)?.id,
        details: { tierId }
      });

      return reply.send({ success: true, message: 'Tier assigned successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Manage SKU Overrides
  fastify.post('/admin/customers/:id/sku-overrides', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['CRM Management'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['overrides'],
        properties: {
          overrides: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'discountPercent'],
              properties: {
                productId: { type: 'string' },
                discountPercent: { type: 'number', minimum: 0, maximum: 100 }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { overrides } = request.body as any;

      const user = await fastify.prisma.user.findUnique({
        where: { id },
        select: { b2bProfileId: true }
      });

      if (!user || !user.b2bProfileId) {
        return reply.status(404).send({ message: 'User or B2B Profile not found' });
      }

      const profileId = user.b2bProfileId;

      await fastify.prisma.$transaction(async (tx) => {
        // Delete all existing overrides for this profile
        await (tx as any).productDiscountOverride.deleteMany({
          where: { b2bProfileId: profileId }
        });

        // Insert new overrides
        if (overrides && overrides.length > 0) {
          await (tx as any).productDiscountOverride.createMany({
            data: overrides.map((o: any) => ({
              b2bProfileId: profileId,
              productId: o.productId,
              discountPercent: o.discountPercent
            }))
          });
        }
      });

      await logActivity(fastify, {
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE_SKU_OVERRIDES',
        performedBy: (request.user as any)?.id,
        details: { overrideCount: overrides?.length || 0 }
      });

      return reply.send({ success: true, message: 'SKU Overrides saved' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Approve Customer
  fastify.post('/admin/customers/:id/approve', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      description: 'Grants B2B status to a user',
      tags: ['CRM Management'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['creditLimit', 'paymentTerms'],
        properties: {
          creditLimit: { type: 'number', minimum: 0 },
          paymentTerms: { type: 'string' },
          roleAssignment: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { creditLimit, paymentTerms, roleAssignment, notes } = request.body as any;

    try {
        const user = await fastify.prisma.user.findUnique({ 
            where: { id },
            include: { b2bProfile: true, b2bCompanyDetails: true }
        });
        
        if (!user) {
            return reply.status(404).send({ message: 'User not found' });
        }

        // 2. Resolve Role
        let roleId = user.roleId;
        if (roleAssignment) {
            const role = await fastify.prisma.role.findUnique({ where: { name: roleAssignment } });
            if (role) roleId = role.id;
        }

        // 3. Update User & B2B Profile or Create if missing
        await fastify.prisma.$transaction(async (tx) => {
            // Self-healing: Ensure columns exist in database
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT`);
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS company_name TEXT`);
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS tax_id TEXT`);
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING'`);

            // Update User
            await tx.user.update({
                where: { id },
                data: { accountStatus: 'APPROVED', isActive: true, roleId }
            });

            // Upsert B2B Profile using Raw SQL to bypass Prisma Client validation errors
            if (user.b2bProfileId) {
                // We update with what Prisma knows
                await (tx as any).b2BProfile.update({
                    where: { id: user.b2bProfileId },
                    data: {
                        creditLimit: creditLimit,
                        paymentTerms: paymentTerms
                    }
                });
                
                // Then we update the missing fields with Raw SQL
                await tx.$executeRawUnsafe(`
                    UPDATE b2b_profiles 
                    SET status = $1, admin_notes = $2, rejection_reason = NULL, company_name = $3, tax_id = $4
                    WHERE id = $5
                `, 'APPROVED', notes, user.b2bCompanyDetails?.companyName || user.companyName || 'B2B Client', user.b2bCompanyDetails?.taxId, user.b2bProfileId);

            } else {
                const profileId = require('crypto').randomUUID();
                await tx.$executeRawUnsafe(`
                    INSERT INTO b2b_profiles (id, company_name, tax_id, status, credit_limit, payment_terms, admin_notes, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `, profileId, user.b2bCompanyDetails?.companyName || user.companyName || 'B2B Client', user.b2bCompanyDetails?.taxId, 'APPROVED', creditLimit, paymentTerms, notes);

                await tx.user.update({
                    where: { id },
                    data: { b2bProfileId: profileId }
                });
            }
        });

        // 4. Send Approval Email
        const { emailService } = await import('../services/email.service');
        await emailService.sendB2BApprovalEmail(
            user.email,
            user.firstName || 'Valued Customer',
            creditLimit
        );

        // 5. Log Activity
        await logActivity(fastify, {
            entityType: 'USER',
            entityId: id,
            action: 'APPROVE_B2B',
            performedBy: (request.user as any)?.id,
            details: { creditLimit, paymentTerms, notes },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return { success: true };
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  // Reject Customer
  fastify.post('/admin/customers/:id/reject', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
        description: 'Rejects B2B application with a reason',
        tags: ['CRM Management'],
        params: {
            type: 'object',
            properties: { id: { type: 'string' } }
        },
        body: {
            type: 'object',
            required: ['reason'],
            properties: { 
                reason: { type: 'string', minLength: 10 }
            }
        }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { reason } = request.body as any;

    try {
        const user = await fastify.prisma.user.findUnique({ 
            where: { id },
            include: { b2bProfile: true, b2bCompanyDetails: true }
        });

        if (!user) return reply.status(404).send({ message: 'User not found' });

        await fastify.prisma.$transaction(async (tx) => {
            // Self-healing: Ensure columns exist in database
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
            await tx.$executeRawUnsafe(`ALTER TABLE b2b_profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT`);

            await tx.user.update({
                where: { id },
                data: { accountStatus: 'REJECTED', isActive: false }
            });

            if (user.b2bProfileId) {
                // Update with what Prisma knows
                await (tx as any).b2BProfile.update({
                    where: { id: user.b2bProfileId },
                    data: { status: 'REJECTED' }
                });

                // Update missing fields with Raw SQL
                await tx.$executeRawUnsafe(`
                    UPDATE b2b_profiles 
                    SET rejection_reason = $1, admin_notes = $2
                    WHERE id = $3
                `, reason, `Rejected: ${reason}`, user.b2bProfileId);

            } else {
                const profileId = require('crypto').randomUUID();
                await tx.$executeRawUnsafe(`
                    INSERT INTO b2b_profiles (id, company_name, tax_id, status, rejection_reason, admin_notes, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                `, profileId, user.b2bCompanyDetails?.companyName || user.companyName || 'Rejected B2B', user.b2bCompanyDetails?.taxId, 'REJECTED', reason, `Rejected: ${reason}`);

                await tx.user.update({
                    where: { id },
                    data: { b2bProfileId: profileId }
                });
            }
        });

        // Send Rejection Email
        const { emailService } = await import('../services/email.service');
        await emailService.sendB2BRejectionEmail(user.email, user.firstName || 'Applicant', reason);

        // Log Activity
        await logActivity(fastify, {
            entityType: 'USER',
            entityId: id,
            action: 'REJECT_B2B',
            performedBy: (request.user as any)?.id,
            details: { reason },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return { success: true };
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });
  // Update Customer Details (Credit Limit & Notes)
  fastify.patch('/admin/customers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['CRM Management'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          creditLimit: { type: 'number' },
          adminNotes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { creditLimit, adminNotes } = request.body as any;

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { id },
        select: { b2bProfileId: true }
      });

      if (!user || !user.b2bProfileId) {
        return reply.status(404).send({ message: 'B2B Profile not found' });
      }

      await (fastify.prisma.b2BProfile.update({
        where: { id: user.b2bProfileId },
        data: {
          creditLimit: creditLimit !== undefined ? creditLimit : undefined,
          // adminNotes: adminNotes !== undefined ? adminNotes : undefined // adminNotes might not be in Prisma schema yet
        }
      }) as any);

      if (adminNotes !== undefined) {
        await fastify.prisma.$executeRawUnsafe(`
          UPDATE b2b_profiles SET admin_notes = $1 WHERE id = $2
        `, adminNotes, user.b2bProfileId);
      }

      await logActivity(fastify, {
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE_CUSTOMER_INFO',
        performedBy: (request.user as any)?.id,
        details: { creditLimit, adminNotes }
      });

      return { success: true };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
  // Fetch Customer Activity Logs
  fastify.get('/admin/customers/:id/activity', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      tags: ['CRM Management'],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      if (!fastify.prisma.auditLog) return [];
      const logs = await fastify.prisma.auditLog.findMany({
        where: { entityId: id, entityType: 'USER' },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return logs;
    } catch (err: any) {
      fastify.log.error(err);
      return [];
    }
  });
}
