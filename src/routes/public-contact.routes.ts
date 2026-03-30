
import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { emailService } from '../services/email.service';
import { uploadFileToS3, validateFileUpload } from '../utils/file-upload.utils';

export default async function publicContactRoutes(fastify: FastifyInstance) {
  
  fastify.post('/public/contact', {
    schema: {
      description: 'Public contact form submission with ReCaptcha and File Attachment',
      tags: ['Public'],
      consumes: ['multipart/form-data'],
    }
  }, async (request: any, reply) => {
    try {
      const parts = request.parts();
      const fields: any = {};
      const fileUrls: string[] = [];

      for await (const part of parts) {
        if (part.file) {
          // Validate and Upload File
          const buffer = await part.toBuffer();
          const fileToUpload = { data: buffer, filename: part.filename, mimetype: part.mimetype };
          
          const validation = validateFileUpload(fileToUpload);
          if (!validation.valid) {
            return reply.status(400).send(createErrorResponse(validation.error || "Invalid file"));
          }

          const url = await uploadFileToS3(fileToUpload, 'contact-inquiries');
          fileUrls.push(url);
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const { name, email, phone, subject, message, captchaToken } = fields;

      // 1. Verify ReCaptcha
      const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '6LegAZ4sAAAAAPsGG_d9clkTGhqtu_bf6Gv3x1ub';
      
      const captchaResponse = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captchaToken}`);
      
      const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

      if (!captchaResponse.data.success && isProduction) {
          return reply.status(400).send(createErrorResponse("ReCaptcha verification failed"));
      }

      // 2. Send Email Notification to Admin
      await emailService.sendContactUsNotification(
        name || 'No Name',
        email || 'No Email',
        phone || 'No Phone',
        subject || 'No Subject',
        message || 'No Message',
        fileUrls
      );

      // 3. Send Confirmation Email to User
      if (email) {
        try {
          await emailService.sendContactUsConfirmationEmail(email, name || 'Customer', subject || 'Contact Inquiry');
        } catch (emailErr) {
          fastify.log.error(emailErr, 'Failed to send contact confirmation email to user');
        }
      }

      return createResponse({ success: true }, "Message sent successfully! We'll get back to you soon.");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse("Failed to process your request: " + err.message));
    }
  });
}
