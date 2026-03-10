import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Email service using nodemailer with SMTP configuration
export class EmailService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get SMTP settings from database or fallback to .env
   */
  private async getSmtpSettings() {
    try {
      if (!this.prisma) {
        throw new Error('Prisma client not initialized in EmailService');
      }
      
      // Use explicit select to avoid errors with missing columns (e.g. sitemap_content)
      const settings = await this.prisma.globalSettings.findFirst({
        select: {
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          senderEmail: true,
          senderName: true
        }
      });
      
      if (settings && settings.smtpHost && settings.smtpPort) {
        console.log('📬 Using SMTP settings from Database');
        return {
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpPort === 465,
          auth: settings.smtpUser && settings.smtpPass ? {
            user: settings.smtpUser,
            pass: settings.smtpPass,
          } : undefined,
          senderEmail: settings.senderEmail || process.env.SENDER_EMAIL || 'no-reply@filtersexpert.com',
          senderName: (settings.senderName || process.env.SENDER_NAME || 'Filters Expert').trim()
        };
      }
    } catch (error: any) {
      console.warn(`⚠️ Database SMTP fetch failed: ${error.message.substring(0, 100)}... Falling back to .env.`);
    }

    // Fallback to .env
    console.log('📂 Using SMTP settings from .env fallback');
    const config = {
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      senderEmail: process.env.SENDER_EMAIL || 'no-reply@filtersexpert.com',
      senderName: (process.env.SENDER_NAME || 'Filters Expert').trim()
    };

    return config;
  }

  /**
   * Create nodemailer transporter with current SMTP settings
   */
  private async createTransporter() {
    const config = await this.getSmtpSettings();
    
    // Log connection details (Security: Mask password)
    const maskedPass = config.auth?.pass ? `${config.auth.pass.substring(0, 4)}***` : 'none';
    console.log(`📡 Attempting SMTP connection: ${config.host}:${config.port} | User: ${config.auth?.user} | Pass: ${maskedPass} | Sender: ${config.senderEmail}`);

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      requireTLS: config.port === 587,
      tls: {
        rejectUnauthorized: false
      }
    } as any);
  }

  /**
   * Send OTP email for signup verification
   */
  async sendOTPEmail(to: string, otpCode: string, userName?: string): Promise<void> {
    const subject = 'Your Verification Code - Filters Expert';
    
    // FOR DEV TESTING: Log OTP to console
    console.log('=================================================');
    console.log(`🔑 DEV OTP for ${to}: ${otpCode}`);
    console.log('=================================================');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ED2823; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ED2823; text-align: center; padding: 20px; background-color: #fff; border: 2px dashed #ED2823; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
          </div>
          <div class="content">
            ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
            <p>Thank you for registering with <strong>Filters Expert</strong>!</p>
            <p>Please use the following 6-digit verification code to complete your registration:</p>
            <div class="otp-code">${otpCode}</div>
            <p><strong>This code will expire in 10 minutes.</strong></p>
            <p>If you didn't request this code, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Filters Expert. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Hello${userName ? ' ' + userName : ''},
      
      Thank you for registering with Filters Expert!
      
      Your verification code is: ${otpCode}
      
      This code will expire in 10 minutes.
      
      If you didn't request this code, you can safely ignore this email.
      
      © ${new Date().getFullYear()} Filters Expert. All rights reserved.
    `;

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Send admin notification for B2B account review
   */
  async sendB2BReviewNotification(companyName: string, contactName: string, email: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@filtersexpert.com';
    const subject = `New B2B Account Registration - ${companyName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; display: inline-block; width: 150px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ED2823; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New B2B Account Review Required</h1>
          </div>
          <div class="content">
            <p>A new B2B account has been registered and requires admin approval.</p>
            <div class="info-row">
              <span class="label">Company Name:</span>
              <span>${companyName}</span>
            </div>
            <div class="info-row">
              <span class="label">Primary Contact:</span>
              <span>${contactName}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span>${email}</span>
            </div>
            <p>Please review the application in the admin panel.</p>
            <a href="${process.env.ADMIN_PANEL_URL || 'http://localhost:3000/admin-dashboard'}/b2b-approvals" class="button">
              Review Application →
            </a>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({ 
      to: adminEmail, 
      subject, 
      html,
      text: `New B2B Account Review Required\n\nCompany: ${companyName}\nContact: ${contactName}\nEmail: ${email}\n\nPlease review in admin panel.`
    });
  }

  /**
   * Generic email send function
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const config = await this.getSmtpSettings(); // Fetch config
      const transporter = await this.createTransporter(); // This now logs connection details
      
      await transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`✅ Email sent successfully to ${options.to} | Subject: ${options.subject}`);
    } catch (error: any) {
      console.error('❌ Email send error:', error.message);
      if (error.code === 'EAUTH') {
        console.error('🔒 AUTHENTICATION FAILED: Please check your SMTP_USER and SMTP_PASS in .env or Database');
      }
      // Don't throw - allow cleanup etc to continue
      console.warn('⚠️ Email failed but suppressed for resilience. Check logs above for exact connection details.');
    }
  }

  /**
   * Verify email service connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = await this.createTransporter();
      await transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }

  /**
   * Send B2B account approval notification email
   */
  async sendB2BApprovalEmail(to: string, userName: string, creditLimit: number): Promise<void> {
    const subject = '🎉 Your B2B Account Has Been Approved - Filters Expert';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #22c55e; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Account Approved!</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${userName},</p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Congratulations! Your B2B account application has been <strong>approved</strong>.
          </p>
          
          <div style="background-color: white; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #059669;">Account Details:</h3>
            <p style="margin: 5px 0;">💳 <strong>Initial Credit Limit:</strong> SAR ${creditLimit.toLocaleString()}</p>
            <p style="margin: 5px 0;">🚀 <strong>Status:</strong> Active</p>
          </div>
          
          <h3 style="color: #374151;">What's Next?</h3>
          <ul style="color: #374151; line-height: 1.8;">
            <li>You can now <strong>login to your account</strong> using your registered email</li>
            <li>Browse our complete product catalog</li>
            <li>Place orders with your credit limit</li>
            <li>Access exclusive B2B pricing and bulk discounts</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3002'}/en/login" 
               style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Login to Your Account
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions, feel free to contact our support team.
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br>
            <strong>Filters Expert Team</strong>
          </p>
        </div>
      </div>
    `;

    const textContent = `
Dear ${userName},

Congratulations! Your B2B account has been APPROVED.

Account Details:
- Initial Credit Limit: SAR ${creditLimit.toLocaleString()}
- Status: Active

What's Next?
- Login to your account using your registered email
- Browse our complete product catalog
- Place orders with your credit limit
- Access exclusive B2B pricing

Login here: ${process.env.FRONTEND_URL || 'http://localhost:3002'}/en/login

Best regards,
Filters Expert Team
    `;

    await this.sendEmail({
      to,
      subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ B2B Approval Email sent to: ${to}`);
  }

  /**
   * Send B2B account rejection notification email
   */
  async sendB2BRejectionEmail(to: string, userName: string, reason?: string): Promise<void> {
    const subject = 'B2B Account Application Update - Filters Expert';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ef4444; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Application Status Update</h1>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Dear ${userName},</p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Your B2B account application was rejected due to <strong>${reason || 'unspecified reasons'}</strong>. Contact support for more info.
          </p>
          
          <h3 style="color: #374151;">Need Help?</h3>
          <p style="color: #374151; line-height: 1.6;">
            If you have any questions about this decision or would like to discuss your application further, 
            please don't hesitate to contact our support team.
          </p>
          
          <div style="background-color: white; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 5px 0; color: #374151;">📧 <strong>Email:</strong> support@filtersexpert.com</p>
            <p style="margin: 5px 0; color: #374151;">📞 <strong>Phone:</strong> +966 59 965 9888</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            We appreciate your interest in partnering with Filters Expert.
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br>
            <strong>Filters Expert Team</strong>
          </p>
        </div>
      </div>
    `;

    const textContent = `
Dear ${userName},

Your B2B account application was rejected due to ${reason || 'unspecified reasons'}. Contact support for more info.

Need Help?
If you have any questions, please contact our support team:
- Email: support@filtersexpert.com
- Phone: +966 59 965 9888

Best regards,
Filters Expert Team
    `;

    await this.sendEmail({
      to,
      subject,
      html: htmlContent,
      text: textContent
    });
    
    console.log(`📧 B2B Rejection Email sent to: ${to}`);
  }

  /**
   * Send newsletter welcome email
   */
  async sendNewsletterWelcomeEmail(to: string): Promise<void> {
    const config = await this.getSmtpSettings();
    const subject = 'Welcome to Filters Expert Newsletter';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px, overflow: hidden;">
        <div style="background-color: #ED2823; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome!</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <h2 style="color: #333;">Thank you for subscribing!</h2>
          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            You've successfully joined the <strong>Filters Expert</strong> newsletter.
          </p>
          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            We'll keep you updated with the latest trends, filtration technologies, and industry insights.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 14px;">
            Best regards,<br>
            <strong>Filters Expert Team</strong>
          </p>
          <div style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
            If you wish to unsubscribe, please contact us at ${config.senderEmail}
          </div>
        </div>
      </div>
    `;

    await this.sendEmail({
      to,
      subject,
      html: htmlContent,
      text: `Welcome to the Filters Expert newsletter! Thank you for subscribing. We'll keep you updated with the latest news and insights.`
    });
    
    console.log(`📧 Newsletter Welcome Email sent to: ${to}`);
  }

  /**
   * Send notification to admin for new support ticket
   */
  async sendNewTicketNotification(ticketId: string, subject: string, category: string, userName: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@filtersexpert.com';
    const emailSubject = `New Support Ticket: ${subject} (${category})`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ED2823; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; display: inline-block; width: 120px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Support Ticket</h2>
          </div>
          <div class="content">
            <div class="info-row"><span class="label">Ticket ID:</span><span>${ticketId}</span></div>
            <div class="info-row"><span class="label">User:</span><span>${userName}</span></div>
            <div class="info-row"><span class="label">Category:</span><span>${category}</span></div>
            <div class="info-row"><span class="label">Subject:</span><span>${subject}</span></div>
            <p>Please log in to the admin panel to respond.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({ to: adminEmail, subject: emailSubject, html });
  }

  /**
   * Send notification to user for ticket reply
   */
  async sendTicketReplyNotification(to: string, userName: string, ticketId: string, subject: string): Promise<void> {
    const emailSubject = `Reply to Ticket: ${subject}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ED2823; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Reply on Your Ticket</h2>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>There is a new reply on your support ticket <strong>${ticketId}</strong>: "${subject}".</p>
            <p>Please log in to your dashboard to view and respond.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({ to, subject: emailSubject, html });
  }

  /**
   * Send notification to user when ticket is resolved
   */
  async sendTicketResolvedNotification(to: string, userName: string, ticketId: string, subject: string): Promise<void> {
    const emailSubject = `Support Ticket Resolved: ${subject}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .button { display: inline-block; padding: 12px 24px; background-color: #22c55e; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Ticket Resolved</h2>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your support ticket <strong>${ticketId}</strong>: "${subject}" has been marked as <strong>Resolved</strong> by our support team.</p>
            <p>If you have any further questions or if the issue persists, please feel free to reopen the ticket or create a new one.</p>
            <p>Thank you for your patience!</p>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3002'}/en/dashboard/support" class="button">View Ticket Status</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({ to, subject: emailSubject, html });
  }
}

// Export class for initialization with Prisma
// Singleton will be created in server.ts with fastify.prisma
export let emailService: EmailService;

export function initializeEmailService(prisma: PrismaClient) {
  emailService = new EmailService(prisma);
  return emailService;
}
