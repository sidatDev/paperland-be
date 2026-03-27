import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';

export default async function categoryRoutes(fastify: FastifyInstance) {
  
  // List all categories
  fastify.get('/admin/categories', {
    schema: {
      description: 'List all product categories',
      tags: ['Catalog'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Active', 'Inactive'] }, // allow filtering by status
          deleted: { type: 'boolean' } // optional: show deleted
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string', nullable: true },
              description: { type: 'string', nullable: true },
              imageUrl: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
              parentId: { type: 'string', nullable: true },
              parent: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' }
                }
              },
              subCategories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    isActive: { type: 'boolean' },
                    parentId: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { status, deleted } = request.query as any;
    try {
      const whereClause: any = {};
      
      // Status Filtering
      if (status) {
        whereClause.isActive = status === 'Active';
      }

      // Soft Delete Filtering (default: hide deleted)
      if (!deleted) {
        whereClause.deletedAt = null;
      }

      const categories = await (fastify.prisma as any).category.findMany({
        where: whereClause,
        include: {
          parent: { select: { id: true, name: true } },
          subCategories: { 
             where: { deletedAt: null },
             select: { id: true, name: true, slug: true, isActive: true, parentId: true } 
          }
        },
        orderBy: { position: 'asc' }
      });
      return categories;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // List deactivated categories
  fastify.get('/admin/categories/deactivated', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_view')],
    schema: {
      description: 'List all deactivated product categories',
      tags: ['Catalog'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string', nullable: true },
              deletedAt: { type: 'string' }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const categories = await (fastify.prisma as any).category.findMany({
        where: { NOT: { deletedAt: null } },
        orderBy: { deletedAt: 'desc' }
      });
      return categories;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Create a category
  fastify.post('/admin/categories', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Create a new category',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          slug: { type: 'string' },
          imageUrl: { type: 'string' },
          isActive: { type: 'boolean' },
          parentId: { type: 'string', nullable: true },
          position: { type: 'integer' }
        }
      },
      response: {
        201: {
          description: 'Category created successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            imageUrl: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            parentId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        400: {
          description: 'Bad request (duplicate name/slug)',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { name, description, slug, imageUrl, isActive, parentId, position } = request.body as any;
    try {
      const category = await (fastify.prisma as any).category.create({
        data: { 
          name, 
          description, 
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          imageUrl,
          isActive: isActive ?? true,
          parentId: parentId || null,
          position: position || 0
        }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'CATEGORY',
          entityId: category.id,
          action: 'CREATE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name, slug: category.slug },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(201).send(category);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Category name or slug already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update a category
  fastify.put('/admin/categories/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Update a category',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          slug: { type: 'string' },
          imageUrl: { type: 'string' },
          isActive: { type: 'boolean' },
          parentId: { type: 'string', nullable: true },
          position: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { name, description, slug, imageUrl, isActive, parentId, position } = request.body as any;
    try {
      const category = await (fastify.prisma as any).category.update({
        where: { id },
        data: { 
          name, 
          description, 
          slug, 
          imageUrl, 
          isActive,
          parentId: parentId || null,
          position
        }
      });

      // Cascade Status: If parent status is updated, all its subcategories must match the parent's status
      if (typeof isActive === 'boolean') {
        await (fastify.prisma as any).category.updateMany({
          where: { parentId: id },
          data: { isActive: isActive }
        });
        fastify.log.info(`Cascade status update (isActive: ${isActive}) for subcategories of parent category: ${id}`);
      }

      // Log Activity
      await logActivity(fastify, {
          entityType: 'CATEGORY',
          entityId: id,
          action: 'UPDATE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name, slug, isActive },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return category;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Soft Delete a category
  fastify.delete('/admin/categories/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Soft delete a category (cascade deletes all subcategories)',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        204: {
          description: 'Category successfully deleted',
          type: 'null'
        },
        400: {
          description: 'Cannot delete category',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      // Check for products
      const productCount = await (fastify.prisma as any).product.count({ 
        where: { categoryId: id, deletedAt: null } 
      });
      
      if (productCount > 0) {
        return reply.status(400).send({ message: 'Cannot delete category with associated active products' });
      }

      // Recursive helper to soft delete all descendants
      const softDeleteDescendants = async (parentId: string) => {
        // Find ALL active subcategories of this parent
        const subs = await (fastify.prisma as any).category.findMany({
          where: { parentId, deletedAt: null }
        });

        fastify.log.info(`Soft deleting ${subs.length} subcategories of ${parentId}`);

        for (const sub of subs) {
          // Check for sub-products
          const subProductCount = await (fastify.prisma as any).product.count({
            where: { categoryId: sub.id, deletedAt: null }
          });
          
          if (subProductCount > 0) {
            throw new Error(`Cannot deactivate: Subcategory "${sub.name}" has associated active products.`);
          }

          // First, recursively delete its children
          await softDeleteDescendants(sub.id);

          // Then soft delete the subcategory itself
          await (fastify.prisma as any).category.update({
            where: { id: sub.id },
            data: { 
              deletedAt: new Date(),
              isActive: false 
            }
          });
        }
      };

      try {
        await softDeleteDescendants(id);
      } catch (err: any) {
        fastify.log.error(`Soft delete cascade failed: ${err.message}`);
        return reply.status(400).send({ message: err.message });
      }

      // Now soft delete the main parent category
      await (fastify.prisma as any).category.update({ 
        where: { id },
        data: { 
          deletedAt: new Date(),
          isActive: false 
        }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'CATEGORY',
          entityId: id,
          action: 'DELETE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { type: 'SOFT_DELETE' },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Permanent Delete a category
  fastify.delete('/admin/categories/:id/permanent', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Permanently delete a category (This will fail if products exist or it is not deactivated)',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      const category = await (fastify.prisma as any).category.findUnique({
        where: { id },
        include: { subCategories: true }
      });

      if (!category) {
        return reply.status(404).send({ message: 'Category not found' });
      }

      if (!category.deletedAt) {
        return reply.status(400).send({ message: 'Only deactivated categories can be permanently deleted. Deactivate the category first.' });
      }

      // Recursive helper to delete all descendants
      const deleteDescendants = async (parentId: string) => {
        const subs = await (fastify.prisma as any).category.findMany({
          where: { parentId }
        });

        for (const sub of subs) {
          // Check for products in sub before deleting
          const subProductCount = await (fastify.prisma as any).product.count({
            where: { categoryId: sub.id }
          });
          if (subProductCount > 0) {
            throw new Error(`Cannot delete: Subcategory "${sub.name}" has associated products.`);
          }
          
          await deleteDescendants(sub.id);
          await (fastify.prisma as any).category.delete({ where: { id: sub.id } });
        }
      };

      // Check for products in the main category
      const productCount = await (fastify.prisma as any).product.count({ 
        where: { categoryId: id } 
      });
      
      if (productCount > 0) {
        return reply.status(400).send({ message: 'Cannot permanently delete category with associated products' });
      }

      try {
        await deleteDescendants(id);
      } catch (err: any) {
        return reply.status(400).send({ message: err.message });
      }

      await (fastify.prisma as any).category.delete({
        where: { id }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'CATEGORY',
          entityId: id,
          action: 'PERMANENT_DELETE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name: category.name, slug: category.slug },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return { success: true, message: 'Category permanently deleted' };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Restore a category
  fastify.patch('/admin/categories/:id/restore', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Restore a deactivated category',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
             message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      const category = await (fastify.prisma as any).category.update({
        where: { id },
        data: { 
          deletedAt: null,
          isActive: true 
        }
      });

      // Restore subcategories as well? Usually it's better to restore just the parent.
      // But user might want cascading restore. For now, just restore the parent and set to Active.
      
      // Log Activity
      await logActivity(fastify, {
          entityType: 'CATEGORY',
          entityId: id,
          action: 'RESTORE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name: category.name },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return { success: true, message: 'Category restored successfully' };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Reorder categories
  fastify.patch('/admin/categories/reorder', {
    preHandler: [fastify.authenticate, fastify.hasPermission('category_manage')],
    schema: {
      description: 'Bulk update category positions',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['orders'],
        properties: {
          orders: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'position'],
              properties: {
                id: { type: 'string' },
                position: { type: 'integer' }
              }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { orders } = request.body as any;
    try {
      await (fastify.prisma as any).$transaction(
        orders.map((o: any) =>
          (fastify.prisma as any).category.update({
            where: { id: o.id },
            data: { position: o.position }
          })
        )
      );

      // Invalidate public cache
      if ((fastify as any).cache) {
        await (fastify as any).cache.del('shop:categories:hierarchy');
      }

      return { success: true, message: 'Category order updated successfully' };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
}
