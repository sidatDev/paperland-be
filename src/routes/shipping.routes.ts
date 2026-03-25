import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function shippingRoutes(fastify: FastifyInstance) {
  
  // GET Zones (with Rates)
  fastify.get('/admin/shipping/zones', {
    schema: {
        description: 'Get all shipping zones with rates',
        tags: ['Admin Shipping Management'],
        response: {
            200: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        countries: { type: 'array', items: { type: 'string' } },
                        volumetricDivisor: { type: 'integer' },
                        rates: { 
                            type: 'array', 
                            items: { 
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    cityName: { type: 'string', nullable: true },
                                    baseRate: { type: 'number' },
                                    weightIncrement: { type: 'number' },
                                    volumeIncrement: { type: 'number' },
                                    minWeight: { type: 'number' }
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
    try {
        const zones = await (fastify.prisma as any).shippingZone.findMany({
            where: { deletedAt: null },
            include: { rates: true },
            orderBy: { name: 'asc' }
        });
        return zones;
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // CREATE Zone
  fastify.post('/admin/shipping/zones', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Create new shipping zone',
        tags: ['Admin Shipping Management'],
        body: {
            type: 'object',
            required: ['name', 'countries'],
            properties: {
                name: { type: 'string' },
                countries: { type: 'array', items: { type: 'string' } },
                volumetricDivisor: { type: 'integer' }
            }
        },
        response: {
            201: {
                type: 'object',
                additionalProperties: true
            },
            400: {
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
  }, async (request: any, reply) => {
    const { name, countries, volumetricDivisor } = request.body;
    try {
        if (volumetricDivisor < 0) return reply.status(400).send({ message: 'Volumetric divisor cannot be negative' });
        
        const zone = await (fastify.prisma as any).shippingZone.create({
            data: {
                name,
                countries,
                volumetricDivisor: volumetricDivisor || 5000
            }
        });
        
        await logActivity(fastify, {
            entityType: 'SHIPPING_ZONE',
            entityId: zone.id,
            action: 'CREATE',
            performedBy: request.user?.id,
            details: { name, countries },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return zone;
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // DELETE Zone
  fastify.delete('/admin/shipping/zones/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Delete shipping zone',
          tags: ['Admin Shipping Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          response: {
              200: {
                  type: 'object',
                  properties: {
                      success: { type: 'boolean' }
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
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          // Switching to soft-delete to preserve data as per user request
          await (fastify.prisma as any).shippingZone.update({ 
              where: { id },
              data: { deletedAt: new Date() }
          });
          
          await logActivity(fastify, {
            entityType: 'SHIPPING_ZONE',
            entityId: id,
            action: 'DELETE',
            performedBy: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          return { success: true };
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });

  // UPDATE Zone
  fastify.put('/admin/shipping/zones/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update shipping zone',
          tags: ['Admin Shipping Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              properties: {
                  name: { type: 'string' },
                  countries: { type: 'array', items: { type: 'string' } },
                  volumetricDivisor: { type: 'integer' }
              }
          },
          response: {
              200: { type: 'object', additionalProperties: true },
              400: { type: 'object', additionalProperties: true },
              500: { type: 'object', additionalProperties: true }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { name, countries, volumetricDivisor } = request.body;
      try {
          if (volumetricDivisor && volumetricDivisor < 0) return reply.status(400).send({ message: 'Volumetric divisor cannot be negative' });
          
          const zone = await (fastify.prisma as any).shippingZone.update({
              where: { id },
              data: { name, countries, volumetricDivisor }
          });

          await logActivity(fastify, {
              entityType: 'SHIPPING_ZONE',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return zone;
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });

  // ADD Rate to Zone
  fastify.post('/admin/shipping/zones/:id/rates', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Add shipping rate to zone',
          tags: ['Admin Shipping Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              required: ['baseRate'],
              properties: {
                  cityName: { type: 'string' },
                  baseRate: { type: 'number' },
                  weightIncrement: { type: 'number' },
                  volumeIncrement: { type: 'number' },
                  minWeight: { type: 'number' }
              }
          },
          response: {
              201: {
                  type: 'object',
                  additionalProperties: true
              },
              400: {
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
  }, async (request: any, reply) => {
      const { id: zoneId } = request.params;
      const { cityName, baseRate, weightIncrement, volumeIncrement, minWeight } = request.body;
      
      try {
          if (baseRate < 0 || (weightIncrement && weightIncrement < 0) || (volumeIncrement && volumeIncrement < 0)) {
              return reply.status(400).send({ message: 'Rates cannot be negative' });
          }
          
          const rate = await (fastify.prisma as any).shippingRate.create({
              data: {
                  zoneId,
                  cityName,
                  baseRate,
                  weightIncrement: weightIncrement || 0,
                  volumeIncrement: volumeIncrement || 0,
                  minWeight: minWeight || 0
              }
          });
          
          await logActivity(fastify, {
            entityType: 'SHIPPING_RATE',
            entityId: rate.id,
            action: 'CREATE',
            performedBy: request.user?.id,
            details: { zoneId, cityName, baseRate },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

          return rate;
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });
  
  // DELETE Rate
  fastify.delete('/admin/shipping/rates/:id', {
      preHandler: [fastify.authenticate],
      schema: { 
        description: 'Delete shipping rate',
        tags: ['Admin Shipping Management'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
            200: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' }
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
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          await (fastify.prisma as any).shippingRate.delete({ where: { id } });
          
          await logActivity(fastify, {
            entityType: 'SHIPPING_RATE',
            entityId: id,
            action: 'DELETE',
            performedBy: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          return { success: true };
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });

  // UPDATE Rate
  fastify.put('/admin/shipping/rates/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update shipping rate',
          tags: ['Admin Shipping Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              properties: {
                  cityName: { type: 'string' },
                  baseRate: { type: 'number' },
                  weightIncrement: { type: 'number' },
                  volumeIncrement: { type: 'number' },
                  minWeight: { type: 'number' }
              }
          },
          response: {
              200: { type: 'object', additionalProperties: true },
              400: { type: 'object', additionalProperties: true },
              500: { type: 'object', additionalProperties: true }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { cityName, baseRate, weightIncrement, volumeIncrement, minWeight } = request.body;
      
      try {
          if ((baseRate && baseRate < 0) || (weightIncrement && weightIncrement < 0) || (volumeIncrement && volumeIncrement < 0)) {
              return reply.status(400).send({ message: 'Rates cannot be negative' });
          }

          const rate = await (fastify.prisma as any).shippingRate.update({
              where: { id },
              data: { cityName, baseRate, weightIncrement, volumeIncrement, minWeight }
          });

          await logActivity(fastify, {
              entityType: 'SHIPPING_RATE',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return rate;
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });

  // GET Couriers
  fastify.get('/admin/shipping/couriers', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Get all shipping couriers',
          tags: ['Admin Shipping Management'],
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: {
                          type: 'array',
                          items: {
                              type: 'object',
                              properties: {
                                  id: { type: 'string' },
                                  name: { type: 'string' },
                                  identifier: { type: 'string' },
                                  isActive: { type: 'boolean' },
                                  config: { type: 'object', additionalProperties: true }
                              }
                          }
                      }
                  }
              },
              500: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: { type: 'null' }
                  }
              }
          }
      }
  }, async (request, reply) => {
      try {
          const couriers = await (fastify.prisma as any).shippingCourier.findMany({
              orderBy: { name: 'asc' }
          });
          return createResponse(couriers, 'Couriers retrieved successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });

  // UPDATE Courier
  fastify.put('/admin/shipping/couriers/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update shipping courier configuration',
          tags: ['Admin Shipping Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              properties: {
                  isActive: { type: 'boolean' },
                  config: { type: 'object', additionalProperties: true }
              }
          },
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: { type: 'object', additionalProperties: true }
                  }
              },
              500: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: { type: 'null' }
                  }
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { isActive, config } = request.body;
      try {
          const courier = await (fastify.prisma as any).shippingCourier.update({
              where: { id },
              data: { isActive, config }
          });

          await logActivity(fastify, {
              entityType: 'SHIPPING_COURIER',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(courier, 'Courier updated successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });
}
