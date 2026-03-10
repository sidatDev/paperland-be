import { FastifyInstance } from 'fastify';
import * as bcrypt from 'bcryptjs';
import { logActivity } from '../utils/audit';
import { mergeGuestCart } from '../services/cart.service';
import { emailService } from '../services/email.service';
import { 
  generateOTP, 
  getOTPExpiry, 
  isOTPExpired, 
  isValidOTPFormat, 
  compareOTP,
  canResendOTP,
  getRemainingResendTime 
} from '../utils/otp.utils';
import { 
  uploadFileToS3, 
  validateFileUpload, 
  processFileUpload 
} from '../utils/file-upload.utils';

export default async function authRoutes(fastify: FastifyInstance) {
  
  // ==================================================
  // MULTI-STEP SIGNUP FLOW - NEW ENDPOINTS
  // ==================================================
  
  /**
   * STEP 1: Initiate Signup (Email Only)
   * POST /api/auth/signup-step1
   */
  fastify.post('/auth/signup-step1', {
    schema: {
      description: 'Step 1: Initiate Signup & Email Verification',
      summary: 'Check email and send OTP',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            registrationId: { type: 'string' },
            email: { type: 'string' },
            otpExpiresAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { email } = request.body as any;

    try {
      // Check if verified user already exists
      const existingUser = await fastify.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return (reply as any).status(400).send({ message: 'Email already in use. Please login instead.' });
      }

      // Generate OTP
      const otpCode = generateOTP();
      const otpExpiry = getOTPExpiry();

      // Create or update PendingRegistration
      const pendingReg = await (fastify.prisma as any).pendingRegistration.upsert({
        where: { email },
        update: {
          otpCode,
          otpExpiry,
          emailVerified: false
        },
        create: {
          email,
          otpCode,
          otpExpiry
        }
      });

      // Send OTP email
      await emailService.sendOTPEmail(email, otpCode);

      // Log activity (using system or reg ID as performer if no user yet)
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: 'NEW_REGISTRATION',
        action: 'SIGNUP_INITIATED',
        performedBy: 'SYSTEM',
        details: { email, step: 1, registrationId: pendingReg.id },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return {
        message: 'OTP sent to your email. Please verify to continue.',
        registrationId: pendingReg.id,
        email: pendingReg.email,
        otpExpiresAt: pendingReg.otpExpiry
      };

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 3 & 4: Complete Personal Information & Password
   * PATCH /api/auth/complete-signup-details
   */
  fastify.patch('/auth/complete-signup-details', {
    schema: {
      description: 'Step 3 & 4: Set Password and Personal Info',
      summary: 'Complete signup details after email verification',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['registrationId', 'password', 'firstName', 'lastName', 'phoneNumber', 'phoneCountryCode'],
        properties: {
          registrationId: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 2, maxLength: 40 },
          lastName: { type: 'string', minLength: 2, maxLength: 40 },
          phoneNumber: { type: 'string', maxLength: 15 },
          phoneCountryCode: { type: 'string', enum: ['+966', '+971', '+92'] },
          city: { type: 'string' },
          state: { type: 'string' },
          zipCode: { type: 'string' },
          country: { type: 'string', enum: ['Saudi Arabia', 'United Arab Emirates', 'Pakistan'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { registrationId, password, firstName, lastName, phoneNumber, phoneCountryCode, city, state, zipCode, country } = request.body as any;

    try {
      const pendingReg = await (fastify.prisma as any).pendingRegistration.findUnique({ where: { id: registrationId } });
      if (!pendingReg) return (reply as any).status(404).send({ message: 'Registration session not found' });
      if (!pendingReg.emailVerified) return (reply as any).status(400).send({ message: 'Email must be verified first' });

      const passwordHash = await bcrypt.hash(password, 10);

      // Update pending registration with personal info and password
      await (fastify.prisma as any).pendingRegistration.update({
        where: { id: registrationId },
        data: {
          passwordHash,
          firstName,
          lastName,
          phoneNumber,
          phoneCountryCode,
          city,
          state,
          country,
          zipCode
        }
      });

      return { message: 'Signup details saved. Please select your account type.' };
    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 2: Verify OTP
   * POST /api/auth/verify-otp
   */
fastify.post('/auth/verify-otp', {
    schema: {
      description: 'Step 2: Verify Email with OTP',
      summary: 'Verify 6-digit OTP code',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['email', 'otpCode'],
        properties: {
          email: { type: 'string', format: 'email' },
          otpCode: { type: 'string', pattern: '^\\d{6}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            registrationId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { email, otpCode } = request.body as any;

    try {
      // Find pending registration
      const pendingReg = await (fastify.prisma as any).pendingRegistration.findUnique({ where: { email } });
      if (!pendingReg) {
        return (reply as any).status(404).send({ message: 'Registration session not found or expired' });
      }

      // Check if already verified
      if (pendingReg.emailVerified) {
        return {
          message: 'Email already verified successfully!',
          registrationId: pendingReg.id
        };
      }

      // Validate OTP format
      if (!isValidOTPFormat(otpCode)) {
        return (reply as any).status(400).send({ message: 'Invalid OTP format. Must be 6 digits.' });
      }

      // Check if OTP exists
      if (!pendingReg.otpCode || !pendingReg.otpExpiry) {
        return (reply as any).status(400).send({ message: 'No OTP found. Please request a new code.' });
      }

      // Check if OTP expired
      if (isOTPExpired(pendingReg.otpExpiry)) {
        return (reply as any).status(400).send({ message: 'OTP expired. Please request a new code.' });
      }

      // Verify OTP (constant-time comparison)
      if (!compareOTP(otpCode, pendingReg.otpCode)) {
        return (reply as any).status(400).send({ message: 'Incorrect OTP. Please try again.' });
      }

      // Update pending registration: mark email as verified, clear OTP
      await (fastify.prisma as any).pendingRegistration.update({
        where: { id: pendingReg.id },
        data: {
          emailVerified: true,
          otpCode: null,
          otpExpiry: null
        }
      });

      // Log activity
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: 'NEW_REGISTRATION',
        action: 'EMAIL_VERIFIED',
        performedBy: 'SYSTEM',
        details: { email, step: 2, registrationId: pendingReg.id },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return {
        message: 'Email verified successfully!',
        registrationId: pendingReg.id
      };

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 2.5: Resend OTP
   * POST /api/auth/resend-otp
   */
  fastify.post('/auth/resend-otp', {
    schema: {
      description: 'Step 2.5: Resend OTP Email',
      summary: 'Resend verification code (rate limited)',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            canResendIn: { type: 'number' },
            otpExpiresAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { email } = request.body as any;

    try {
      const pendingReg = await (fastify.prisma as any).pendingRegistration.findUnique({ where: { email } });
      if (!pendingReg) {
        return (reply as any).status(404).send({ message: 'Registration session not found' });
      }

      if (pendingReg.emailVerified) {
        return (reply as any).status(400).send({ message: 'Email already verified' });
      }

      // Rate limiting check (Allow resend after 1 minute)
      if (pendingReg.otpExpiry) {
        const otpSentTime = new Date(pendingReg.otpExpiry.getTime() - (10 * 60 * 1000));
        
        if (!canResendOTP(otpSentTime, 1)) {
          const remainingSeconds = getRemainingResendTime(otpSentTime, 1);
          return (reply as any).status(429).send({ 
            message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
            canResendIn: remainingSeconds
          });
        }
      }

      // Generate new OTP
      const otpCode = generateOTP();
      const otpExpiry = getOTPExpiry();

      await (fastify.prisma as any).pendingRegistration.update({
        where: { id: pendingReg.id },
        data: { otpCode, otpExpiry }
      });

      // Send new OTP email
      await emailService.sendOTPEmail(email, otpCode);

      return {
        message: 'New verification code sent to your email',
        canResendIn: 60,
        otpExpiresAt: otpExpiry
      };

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 3: Set Account Type (B2C or B2B)
   * PATCH /api/auth/set-account-type
   */
  fastify.patch('/auth/set-account-type', {
    schema: {
      description: 'Step 3: Select Account Type',
      summary: 'Choose B2C (individual) or B2B (corporate)',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['registrationId', 'accountType'],
        properties: {
          registrationId: { type: 'string' },
          accountType: { type: 'string', enum: ['B2C', 'B2B'] },
          guestToken: { type: 'string', nullable: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: { type: 'string', nullable: true },
            requiresB2BDetails: { type: 'boolean' },
            registrationId: { type: 'string', nullable: true }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { registrationId, accountType, guestToken } = request.body as any;

    try {
      const pendingReg = await (fastify.prisma as any).pendingRegistration.findUnique({ 
        where: { id: registrationId }
      });

      if (!pendingReg) {
        return (reply as any).status(404).send({ message: 'Registration session not found' });
      }

      if (!pendingReg.emailVerified) {
        return (reply as any).status(400).send({ message: 'Please verify your email first' });
      }

      let token: string | null = null;

      if (accountType === 'B2C') {
        const customerRole = await fastify.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
        if (!customerRole) throw new Error('CUSTOMER role not found');

        // B2C: Create actual User and complete registration
        const user = await fastify.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: pendingReg.email,
              passwordHash: pendingReg.passwordHash!,
              firstName: pendingReg.firstName,
              lastName: pendingReg.lastName,
              phoneNumber: pendingReg.phoneNumber,
              phoneCountryCode: pendingReg.phoneCountryCode,
              state: pendingReg.state,
              zipCode: pendingReg.zipCode,
              roleId: customerRole.id,
              isActive: true,
              emailVerified: true,
              accountStatus: 'APPROVED'
            } as any,
            include: { role: true }
          });

          // Create address if exists
          if (pendingReg.city && pendingReg.country) {
            const countryRecord = await tx.country.findFirst({
              where: { name: { equals: pendingReg.country, mode: 'insensitive' } }
            });
            if (countryRecord) {
              await tx.address.create({
                data: {
                  userId: newUser.id,
                  type: 'SHIPPING',
                  isDefault: true,
                  firstName: pendingReg.firstName!,
                  lastName: pendingReg.lastName!,
                  street1: pendingReg.city!,
                  city: pendingReg.city!,
                  state: pendingReg.state!,
                  countryId: countryRecord.id,
                  phone: pendingReg.phoneNumber!,
                  zipCode: pendingReg.zipCode || '00000'
                }
              });
            }
          }

          // Delete pending registration
          await (tx as any).pendingRegistration.delete({ where: { id: registrationId } });

          return newUser;
        });

        // Generate JWT token
        token = fastify.jwt.sign({ 
          id: user.id, 
          role: (user as any).role.name, 
          email: user.email 
        });
        
        // Merge Guest Cart if token provided
        if (guestToken) {
          await mergeGuestCart(fastify.prisma as any, user.id, guestToken);
        }

        // Log activity
        if (user) {
          await logActivity(fastify, {
            entityType: 'USER',
            entityId: user.id,
            action: 'SIGNUP_COMPLETED_B2C',
            performedBy: user.id,
            details: { accountType: 'B2C' },
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });
        }

        return {
          message: 'Welcome to Filters Expert!',
          token,
          requiresB2BDetails: false,
          registrationId: user.id
        };

      } else {
        // B2B: Create User now so they can log in even if they skip Step 6
        const businessRole = await fastify.prisma.role.findFirst({ 
          where: { name: { in: ['BUSINESS', 'B2B_ADMIN'] } } 
        });

        if (!businessRole) {
          throw new Error('Business/B2B role not found in database. Please contact support.');
        }

        const user = await fastify.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: pendingReg.email,
              passwordHash: pendingReg.passwordHash!,
              firstName: pendingReg.firstName,
              lastName: pendingReg.lastName,
              phoneNumber: pendingReg.phoneNumber,
              phoneCountryCode: pendingReg.phoneCountryCode,
              state: pendingReg.state,
              zipCode: pendingReg.zipCode,
              roleId: businessRole.id,
              isActive: true, // Allow login to finish setup
              emailVerified: true,
              accountStatus: 'PENDING_DETAILS'
            } as any,
            include: { role: true }
          });

          // Delete pending registration
          await (tx as any).pendingRegistration.delete({ where: { id: registrationId } });

          // Create address if exists
          if (pendingReg.city && pendingReg.country) {
            const countryRecord = await tx.country.findFirst({
              where: { name: { equals: pendingReg.country, mode: 'insensitive' } }
            });
            if (countryRecord) {
              await tx.address.create({
                data: {
                  userId: newUser.id,
                  type: 'SHIPPING',
                  isDefault: true,
                  firstName: pendingReg.firstName!,
                  lastName: pendingReg.lastName!,
                  street1: pendingReg.city!,
                  city: pendingReg.city!,
                  state: pendingReg.state!,
                  countryId: countryRecord.id,
                  phone: pendingReg.phoneNumber!,
                  zipCode: pendingReg.zipCode || '00000'
                }
              });
            }
          }

          return newUser;
        });

        return {
          message: 'Please provide your company details',
          token: null,
          requiresB2BDetails: true,
          registrationId: user.id
        };
      }

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 6: B2B Company Details (with multiple file upload)
   * POST /api/auth/b2b-company-details
   */
  fastify.post('/auth/b2b-company-details', {
    schema: {
      description: 'Step 6: B2B Company Information (Multiple Files)',
      summary: 'Submit company details and upload registration proofs',
      tags: ['Signup Flow'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Parse multipart form data
      const parts = request.parts();
      const formData: any = {};
      const registrationFiles: { data: Buffer; filename: string; mimetype: string }[] = [];

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'registrationProofs') {
          // Handle multiple files
          const buffer = await part.toBuffer();
          registrationFiles.push({
            data: buffer,
            filename: part.filename,
            mimetype: part.mimetype
          });
        } else if (part.type === 'field') {
          formData[part.fieldname] = part.value;
        }
      }

      // Check if registration exists
      const registrationId = formData.registrationId || formData.userId;
      let user = await fastify.prisma.user.findUnique({ where: { id: registrationId }, include: { role: true } });
      let pendingReg = null;

      if (!user) {
        pendingReg = await (fastify.prisma as any).pendingRegistration.findUnique({ where: { id: registrationId } });
        if (!pendingReg) return (reply as any).status(404).send({ message: 'Registration session not found' });
      }

      const businessRole = await fastify.prisma.role.findFirst({
        where: { name: { in: ['BUSINESS', 'B2B_ADMIN'] } }
      });

      if (!businessRole) {
        throw new Error('Business/B2B role not found in database. Please contact support.');
      }

      // 1. Upload files to S3/MinIO (Outside transaction to avoid timeouts)
      const fileUrls: string[] = [];
      for (const file of registrationFiles) {
        const fileValidation = validateFileUpload(file, {
          allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
          maxSizeBytes: 10 * 1024 * 1024
        });
        if (fileValidation.valid) {
          const url = await uploadFileToS3(file, 'b2b-registrations');
          fileUrls.push(url);
        }
      }

      // 2. Database changes (Atomic)
      const updatedUser = await fastify.prisma.$transaction(async (tx) => {
        let currentUser;
        if (!user) {
          // Fallback: Create new user (Old Flow)
          currentUser = await tx.user.create({
            data: {
              email: pendingReg!.email,
              passwordHash: pendingReg!.passwordHash!,
              firstName: pendingReg!.firstName,
              lastName: pendingReg!.lastName,
              phoneNumber: pendingReg!.phoneNumber,
              phoneCountryCode: pendingReg!.phoneCountryCode,
              roleId: businessRole.id,
              isActive: true,
              emailVerified: true,
              accountStatus: 'IN_REVIEW'
            }
          });
          // Delete pending registration
          await (tx as any).pendingRegistration.delete({ where: { id: registrationId } });
        } else {
          // New Flow: Update existing user
          currentUser = await tx.user.update({
            where: { id: user.id },
            data: { accountStatus: 'IN_REVIEW' }
          });
        }

        // Create or Update B2B Details (Upsert)
        await tx.b2BCompanyDetails.upsert({
          where: { userId: currentUser.id },
          update: {
            companyName: formData.companyName || undefined,
            registrationCountry: formData.registrationCountry || undefined,
            taxId: formData.taxId || undefined,
            registrationDate: formData.registrationDate ? new Date(formData.registrationDate) : undefined,
            companyAddress: formData.companyAddress || undefined,
            registrationProofUrls: fileUrls.length > 0 ? fileUrls : undefined,
            doingBusinessAs: formData.doingBusinessAs || undefined,
            authorizedRepresentativeName: formData.authorizedRepresentativeName || undefined,
            registeredLegalEntity: formData.registeredLegalEntity || undefined,
            authorizedRepresentativeEmail: formData.authorizedRepresentativeEmail || undefined,
            // Keep mandatory fields if they were already set or update them if provided
            primaryContactName: formData.authorizedRepresentativeName || undefined,
            contactPhone: formData.contactPhone || undefined,
            contactCountryCode: formData.contactCountryCode || undefined,
            shippingAddress: formData.companyAddress || undefined,
          },
          create: {
            userId: currentUser.id,
            companyName: formData.companyName || 'N/A',
            registrationCountry: formData.registrationCountry || 'N/A',
            taxId: formData.taxId || 'N/A',
            registrationDate: formData.registrationDate ? new Date(formData.registrationDate) : new Date(),
            companyAddress: formData.companyAddress || 'N/A',
            registrationProofUrls: fileUrls,
            doingBusinessAs: formData.doingBusinessAs,
            primaryContactName: formData.authorizedRepresentativeName || 'Pending',
            jobTitle: 'Pending',
            contactPhone: formData.contactPhone || 'Pending',
            contactCountryCode: formData.contactCountryCode || '+966',
            billingEmail: currentUser.email,
            shippingAddress: formData.companyAddress || 'N/A',
            apContactName: 'Pending',
            apPhone: 'Pending',
            apCountryCode: '+966'
          }
        });

        return currentUser;
      });

      // Log activity
      if (updatedUser) {
        await logActivity(fastify, {
          entityType: 'USER',
          entityId: updatedUser.id,
          action: 'B2B_COMPANY_DETAILS_SUBMITTED',
          performedBy: updatedUser.id,
          details: { companyName: formData.companyName, step: 6 },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
      }

      return { message: 'Company details saved successfully' };

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  /**
   * STEP 5: B2B Contact & Personnel Details
   * PATCH /api/auth/b2b-contact-details
   */
  fastify.patch('/auth/b2b-contact-details', {
    schema: {
      description: 'Step 5: B2B Contact Information',
      summary: 'Complete B2B registration with contact details',
      tags: ['Signup Flow'],
      body: {
        type: 'object',
        required: ['userId', 'primaryContactName', 'jobTitle', 'contactPhone', 'contactCountryCode', 'billingEmail', 'shippingAddress', 'apContactName', 'apPhone', 'apCountryCode'],
        properties: {
          userId: { type: 'string' },
          primaryContactName: { type: 'string' },
          jobTitle: { type: 'string' },
          contactPhone: { type: 'string' },
          contactCountryCode: { type: 'string' },
          billingEmail: { type: 'string', format: 'email' },
          shippingAddress: { type: 'string' },
          sameAsCompanyAddress: { type: 'boolean' },
          apContactName: { type: 'string' },
          apPhone: { type: 'string' },
          apCountryCode: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      userId, 
      primaryContactName, 
      jobTitle, 
      contactPhone, 
      contactCountryCode,
      billingEmail, 
      shippingAddress, 
      sameAsCompanyAddress,
      apContactName, 
      apPhone, 
      apCountryCode 
    } = request.body as any;

    try {
      // Find user and company details
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return (reply as any).status(404).send({ message: 'User not found' });
      }

      const companyDetails = await fastify.prisma.b2BCompanyDetails.findUnique({ 
        where: { userId } 
      });
      // Allow partial completion for skip flow? 
      // If companyDetails doesn't exist, we can't update. 
      // User must at least "start" Step 6 or we handle it here.

      // Determine shipping address (use company address if checkbox checked)
      const finalShippingAddress = sameAsCompanyAddress 
        ? (companyDetails?.companyAddress || shippingAddress)
        : shippingAddress;

      // Update company details with contact information
      await fastify.prisma.b2BCompanyDetails.update({
        where: { userId },
        data: {
          primaryContactName,
          jobTitle,
          contactPhone,
          contactCountryCode,
          billingEmail,
          shippingAddress: finalShippingAddress,
          apContactName,
          apPhone,
          apCountryCode
        }
      });

      // Update user account status to IN_REVIEW (pending admin approval)
      await fastify.prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'IN_REVIEW', // Waiting for admin approval
          isActive: true // Allow access while in review
        }
      });

      // Send admin notification email
      await emailService.sendB2BReviewNotification(
        companyDetails?.companyName || 'Unknown',
        primaryContactName,
        billingEmail
      );

      // Log activity
      if (user) {
        await logActivity(fastify, {
          entityType: 'USER',
          entityId: user.id,
          action: 'B2B_SIGNUP_COMPLETED',
          performedBy: user.id,
          details: { companyName: companyDetails?.companyName || 'Unknown', step: 5 },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
      }

      return {
        message: 'Your B2B account has been submitted for review. You will receive an email once approved.'
      };

    } catch (err: any) {
      fastify.log.error(err);
      return (reply as any).status(500).send({ message: 'Internal Server Error: ' + err.message });
    }
  });

  // ==================================================
  // EXISTING AUTH ROUTES (Keep existing code below)
  // ==================================================
}

