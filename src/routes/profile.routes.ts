import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';
import { emailService } from '../services/email.service';
import { 
  generateOTP, 
  getOTPExpiry, 
  isOTPExpired, 
  compareOTP 
} from '../utils/otp.utils';

export default async function profileRoutes(fastify: FastifyInstance) {
  
  // Get Profile
  fastify.get('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Profile'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            phoneCountryCode: { type: 'string' },
            profilePictureUrl: { type: 'string', nullable: true },
            companyName: { type: 'string', nullable: true },
            preferences: { type: 'object', additionalProperties: true, nullable: true },
            role: { type: 'object', properties: { name: { type: 'string' } } },
            accountStatus: { type: 'string' },
            pendingEmail: { type: 'string', nullable: true },
            dateOfBirth: { type: 'string', format: 'date', nullable: true },
            joinDate: { type: 'string', format: 'date-time' },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            zipCode: { type: 'string', nullable: true },
            country: { type: 'string', nullable: true },
            b2bCompanyDetails: { 
              type: 'object', 
              nullable: true,
              properties: {
                companyName: { type: 'string' },
                taxId: { type: 'string' },
                registrationCountry: { type: 'string' },
                registrationDate: { type: 'string' },
                companyAddress: { type: 'string' },
                registrationProofUrls: { type: 'array', items: { type: 'string' } },
                doingBusinessAs: { type: 'string', nullable: true },
                authorizedRepresentativeName: { type: 'string', nullable: true },
                authorizedRepresentativeEmail: { type: 'string', nullable: true },
                registeredLegalEntity: { type: 'string', nullable: true },
                primaryContactName: { type: 'string', nullable: true },
                jobTitle: { type: 'string', nullable: true },
                contactPhone: { type: 'string', nullable: true },
                contactCountryCode: { type: 'string', nullable: true },
                billingEmail: { type: 'string', nullable: true },
                shippingAddress: { type: 'string', nullable: true },
                apContactName: { type: 'string', nullable: true },
                apPhone: { type: 'string', nullable: true },
                apCountryCode: { type: 'string', nullable: true }
              }
            },
            b2bProfile: {
              type: 'object',
              nullable: true,
              properties: {
                creditLimit: { type: 'number' },
                usedCredit: { type: 'number' },
                paymentTerms: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request.user as any)?.id;
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        role: true,
        b2bCompanyDetails: true,
        b2bProfile: true,
        addresses: {
            where: { isDefault: true, deletedAt: null },
            include: { country: true },
            take: 1
        }
      }
    });
    
    if (!user) {
        return reply.code(404).send({ message: 'User not found' });
    }

    const userData = user as any;
    const defaultAddress = user.addresses?.[0];
    const b2b = userData.b2bCompanyDetails;

    return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phoneNumber,
        phoneCountryCode: user.phoneCountryCode,
        profilePictureUrl: userData.profilePictureUrl || null,
        companyName: userData.companyName || b2b?.companyName || null,
        preferences: userData.preferences || {},
        role: user.role,
        accountStatus: user.accountStatus,
        pendingEmail: userData.pendingEmail || null,
        b2bCompanyDetails: b2b || null,
        b2bProfile: userData.b2bProfile || null,
        dateOfBirth: userData.dateOfBirth || null,
        joinDate: user.createdAt,
        city: defaultAddress?.city || b2b?.companyAddress || null,
        state: user.state || defaultAddress?.state || null,
        zipCode: (user as any).zipCode || defaultAddress?.zipCode || null,
        country: defaultAddress?.country?.name || b2b?.registrationCountry || null
    };
  });

  // Update Profile
  fastify.patch('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
        tags: ['Profile'],
        body: {
            type: 'object',
            properties: {
                firstName: { type: 'string', minLength: 2, maxLength: 50 },
                lastName: { type: 'string', minLength: 2, maxLength: 50 },
                phone: { type: 'string' },
                phoneCountryCode: { type: 'string' },
                profilePictureUrl: { type: 'string' },
                dateOfBirth: { type: 'string', format: 'date' },
                preferences: { type: 'object' },
                language: { type: 'string' },
                email: { type: 'string', format: 'email' },
                city: { type: 'string', minLength: 2 },
                state: { type: 'string', minLength: 1 },
                zipCode: { type: 'string', minLength: 1 },
                country: { type: 'string', minLength: 2 }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    user: { type: 'object', additionalProperties: true }
                }
            },
            404: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                }
            },
            409: {
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
      const userId = (request.user as any)?.id;
      const { firstName, lastName, phone, phoneCountryCode, profilePictureUrl, preferences, dateOfBirth, language, email: newEmail, city, state, zipCode, country } = request.body as any;
      
      try {
        const currentUser = await fastify.prisma.user.findUnique({ 
            where: { id: userId },
            include: { 
                addresses: { where: { isDefault: true, deletedAt: null }, take: 1 } 
            }
        });
        if (!currentUser) return reply.code(404).send({ message: 'User not found' });

        const sanitize = (str: string) => str ? str.replace(/<[^>]*>?/gm, '') : str;

        const currentPreferences = currentUser.preferences as any || {};
        const newPreferences = {
            ...currentPreferences,
            ...(preferences || {}),
            ...(language ? { language } : {})
        };

        const updateData: any = {
            firstName: sanitize(firstName),
            lastName: sanitize(lastName),
            phoneNumber: phone,
            phoneCountryCode,
            profilePictureUrl,
            state: sanitize(state),
            zipCode: zipCode,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            preferences: newPreferences
        };

        let emailMessage = '';
        if (newEmail && newEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
            const existingUser = await fastify.prisma.user.findUnique({ where: { email: newEmail } });
            if (existingUser) return reply.code(409).send({ message: 'This email is already registered' });

            const otp = generateOTP();
            updateData.pendingEmail = newEmail;
            updateData.otpCode = otp;
            updateData.otpExpiry = getOTPExpiry();

            await emailService.sendOTPEmail(newEmail, otp);
            emailMessage = ' Verification code sent to your new email.';
        }

        // Handle Address Update
        if (city || state || zipCode || country) {
            let countryId = currentUser.addresses?.[0]?.countryId;
            if (country) {
                const countryData = await fastify.prisma.country.findFirst({
                    where: { name: { equals: country, mode: 'insensitive' } }
                });
                
                if (countryData) {
                    countryId = countryData.id;
                } else {
                    // Fallback: Create country if it's one of the supported ones (Self-Healing)
                    const supportedCountries: any = {
                        'Pakistan': { code: 'PK', currency: 'PKR' },
                        'United Arab Emirates': { code: 'AE', currency: 'AED' },
                        'Saudi Arabia': { code: 'SA', currency: 'SAR' }
                    };
                    
                    if (supportedCountries[country]) {
                        const currencyCode = supportedCountries[country].currency;
                        let currency = await fastify.prisma.currency.findUnique({ where: { code: currencyCode } });

                        // Create Currency if missing
                        if (!currency) {
                             // Minimal currency data needed
                             const currencyDetails: any = {
                                 'SAR': { name: 'Saudi Riyal', symbol: 'SAR' },
                                 'PKR': { name: 'Pakistani Rupee', symbol: 'Rs' },
                                 'AED': { name: 'UAE Dirham', symbol: 'AED' }
                             };
                             const details = currencyDetails[currencyCode] || { name: currencyCode, symbol: currencyCode };
                             
                             currency = await fastify.prisma.currency.create({
                                 data: {
                                     code: currencyCode,
                                     name: details.name,
                                     symbol: details.symbol,
                                     decimalPlaces: 2
                                 }
                             });
                        }

                        if (currency) {
                            const newCountry = await fastify.prisma.country.create({
                                data: {
                                    name: country,
                                    code: supportedCountries[country].code,
                                    currencyId: currency.id
                                }
                            });
                            countryId = newCountry.id;
                        }
                    }
                }
            }

            const defaultAddressId = currentUser.addresses?.[0]?.id;
            
            if (defaultAddressId) {
                await fastify.prisma.address.update({
                    where: { id: defaultAddressId },
                    data: {
                        city: city || undefined,
                        state: state || undefined,
                        zipCode: zipCode || undefined,
                        countryId: countryId || undefined
                    }
                });
            } else {
                // Create default address if none exists
                await fastify.prisma.address.create({
                    data: {
                        userId,
                        type: 'SHIPPING',
                        isDefault: true,
                        firstName: currentUser.firstName || 'Pending',
                        lastName: currentUser.lastName || 'Pending',
                        street1: 'Pending',
                        city: city || 'Pending',
                        state: state || 'Pending',
                        zipCode: zipCode || '00000',
                        countryId: (countryId || (await fastify.prisma.country.findFirst({ where: { code: 'PK' }, select: { id: true } }))?.id || (await fastify.prisma.country.findFirst({ select: { id: true } }))?.id || '') as string,
                        phone: currentUser.phoneNumber || 'Pending'
                    }
                });
            }
        }

        const user = await fastify.prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                role: true,
                b2bCompanyDetails: true,
                addresses: {
                    where: { isDefault: true, deletedAt: null },
                    include: { country: true },
                    take: 1
                }
            }
        });

        await logActivity(fastify, {
            entityType: 'USER',
            entityId: userId,
            action: 'UPDATE_PROFILE',
            performedBy: userId,
            details: { updatedFields: Object.keys(request.body as object) },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        const updatedUser = user as any;
        const b2b = updatedUser.b2bCompanyDetails;
        const defAddr = updatedUser.addresses?.[0];

        return reply.send({ 
            message: 'Profile updated successfully.' + emailMessage,
            user: { 
                ...updatedUser, 
                phone: updatedUser.phoneNumber,
                city: defAddr?.city || b2b?.companyAddress || null,
                state: updatedUser.state || defAddr?.state || null,
                zipCode: (updatedUser as any).zipCode || defAddr?.zipCode || null,
                country: defAddr?.country?.name || b2b?.registrationCountry || null,
                companyName: updatedUser.companyName || b2b?.companyName || null
            }
        });

      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ message: err.message || 'Failed to update profile' });
      }
  });

  // Verify Email Change
  fastify.post('/profile/verify-email-change', {
    preHandler: [fastify.authenticate],
    schema: {
        tags: ['Profile'],
        body: {
            type: 'object',
            required: ['otpCode'],
            properties: {
                otpCode: { type: 'string', pattern: '^\\d{6}$' }
            }
        }
    }
  }, async (request, reply) => {
      const userId = (request.user as any)?.id;
      const { otpCode } = request.body as any;

      try {
        const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.pendingEmail || !user.otpCode || !user.otpExpiry) {
            return reply.code(400).send({ message: 'No pending email change found.' });
        }

        if (isOTPExpired(user.otpExpiry)) {
            return reply.code(400).send({ message: 'Verification code expired. Please request again.' });
        }

        if (!compareOTP(otpCode, user.otpCode)) {
            return reply.code(400).send({ message: 'Invalid verification code.' });
        }

        await fastify.prisma.user.update({
            where: { id: userId },
            data: {
                email: user.pendingEmail,
                pendingEmail: null,
                otpCode: null,
                otpExpiry: null,
                emailVerified: true
            }
        });

        await logActivity(fastify, {
            entityType: 'USER',
            entityId: userId,
            action: 'EMAIL_CHANGED',
            performedBy: userId,
            details: { newEmail: user.pendingEmail },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return { message: 'Email updated successfully.' };
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ message: err.message || 'Verification failed' });
      }
  });

  // Cancel Email Change
  fastify.post('/profile/cancel-email-change', {
    preHandler: [fastify.authenticate],
    schema: {
        tags: ['Profile'],
        response: {
            200: {
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
      const userId = (request.user as any)?.id;

      try {
        await fastify.prisma.user.update({
            where: { id: userId },
            data: {
                pendingEmail: null,
                otpCode: null,
                otpExpiry: null
            }
        });

        return { message: 'Pending email change cancelled.' };
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ message: 'Failed to cancel email change.' });
      }
  });
}
