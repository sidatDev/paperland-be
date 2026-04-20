
import { FastifyInstance } from 'fastify';
import { Country, State, City } from 'country-state-city';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function locationRoutes(fastify: FastifyInstance) {
    
    // GET /locations/states - Get states for Pakistan
    fastify.get('/locations/states', {
        schema: {
            description: 'Get all states for Pakistan',
            tags: ['Locations'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    isoCode: { type: 'string' },
                                    countryCode: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const states = State.getStatesOfCountry('PK');
            return createResponse(states, 'States retrieved successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return (reply as any).status(500).send(createErrorResponse(err.message));
        }
    });

    // GET /locations/cities/:stateCode - Get cities for a state in Pakistan
    fastify.get('/locations/cities/:stateCode', {
        schema: {
            description: 'Get all cities for a state in Pakistan',
            tags: ['Locations'],
            params: {
                type: 'object',
                required: ['stateCode'],
                properties: {
                    stateCode: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        success: { type: 'boolean' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    stateCode: { type: 'string' },
                                    countryCode: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { stateCode } = request.params as any;
        try {
            const cities = City.getCitiesOfState('PK', stateCode);
            return createResponse(cities, 'Cities retrieved successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return (reply as any).status(500).send(createErrorResponse(err.message));
        }
    });
}
