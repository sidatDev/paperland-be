import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { 
  getOTPEmailTemplate,
  getNewsletterWelcomeTemplate,
  getContactUsConfirmationTemplate,
  getOrderConfirmationTemplate,
  getOrderStatusUpdateTemplate,
  getIndividualWelcomeTemplate,
  getB2BReviewConfirmationTemplate,
  getEmailLayout
} from '../templates/email-templates';

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
      
      // Fixed: Only use DB settings if Host, Port, AND Credentials exist.
      // Otherwise, SendGrid/SMTP will fail with 550 Unauthenticated if just host is provided.
      if (settings && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass) {
        console.log('📬 Using SMTP settings from Database');
        return {
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpPort === 465,
          auth: {
            user: settings.smtpUser,
            pass: settings.smtpPass,
          },
          senderEmail: settings.senderEmail || process.env.SENDER_EMAIL || 'no-reply@paperland.com.pk',
          senderName: (settings.senderName || process.env.SENDER_NAME || 'Paperland').trim()
        };
      } else {
        console.log('⚠️ Database SMTP settings incomplete (Missing Host/User/Pass). Falling back to .env.');
      }
    } catch (error: any) {
      console.warn(`⚠️ Database SMTP fetch failed: ${error.message.substring(0, 100)}... Falling back to .env.`);
    }

    // Fallback to .env (Proved to work in user's environment)
    console.log('📂 Using SMTP settings from .env fallback');
    const config = {
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      senderEmail: process.env.SENDER_EMAIL || 'no-reply@paperland.com.pk',
      senderName: (process.env.SENDER_NAME || 'Paperland').trim()
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
      tls: {
        rejectUnauthorized: false
      }
    } as any);
  }

  /**
   * Send OTP email for signup verification
   */
  async sendOTPEmail(to: string, otpCode: string, userName?: string): Promise<void> {
    const subject = 'Your Verification Code - Paperland';
    
    // FOR DEV TESTING: Log OTP to console
    console.log('=================================================');
    console.log(`🔑 DEV OTP for ${to}: ${otpCode}`);
    console.log('=================================================');
    const text = `
      Hello${userName ? ' ' + userName : ''},
      Your verification code is: ${otpCode}
      This code will expire in 10 minutes.
      © ${new Date().getFullYear()} Paperland. All rights reserved.
    `;

    try {
      await this.sendDynamicEmail('OTP_VERIFICATION', to, { otpCode, userName: userName || 'Customer' });
    } catch (error) {
      console.warn('⚠️ Dynamic OTP email failed, falling back to hardcoded template');
      const html = getOTPEmailTemplate(otpCode, userName);
      await this.sendEmail({ to, subject, html, text });
    }
  }

  /**
   * Send admin notification for B2B account review
   */
  async sendB2BReviewNotification(companyName: string, contactName: string, email: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@paperland.com.pk';
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
      process.stdout.write(`✅ [EMAIL SUCCESS] Sent to: ${options.to} | Subject: ${options.subject}\n`);
      console.log(`✅ Email sent successfully to ${options.to} | Subject: ${options.subject}`);
    } catch (error: any) {
      process.stdout.write(`❌ [EMAIL FAILURE] to: ${options.to} | Topic: ${options.subject} | Error: ${error.message}\n`);
      console.error('❌ Email send error:', error.message);
      
      if (error.code === 'EAUTH') {
        console.error('🔒 AUTHENTICATION FAILED (535): Incorrect SMTP_USER or SMTP_PASS.');
        console.error('👉 TIP: For Brevo, ensure SMTP_USER is your account email and SMTP_PASS is an active SMTP Key.');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('🔌 CONNECTION REFUSED: Check your SMTP_HOST and SMTP_PORT settings.');
      } else if (error.code === 'ESOCKET') {
        process.stdout.write('📡 NETWORK ERROR: SMTP server timed out or connection was aborted.\n');
      }

      // Don't throw - allow signup to proceed since user can see OTP in console
      console.warn('⚠️ Email failed but suppressed for resilience. DEV OTP is still visible in console above.');
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
  async sendB2BApprovalEmail(to: string, userName: string, companyName: string, creditLimit: number): Promise<void> {
    try {
      await this.sendDynamicEmail('B2B_APPROVAL', to, {
        userName,
        companyName,
        creditLimit: creditLimit.toLocaleString()
      });
    } catch (error) {
      console.warn('⚠️ Dynamic B2B approval email failed, falling back to hardcoded template');
      const subject = '🎉 Your B2B Account Has Been Approved - Paperland';
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #22c55e; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ Account Approved!</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">Dear ${userName},</p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Congratulations! Your B2B account application for <strong>${companyName}</strong> has been <strong>approved</strong>.
            </p>
            
            <div style="background-color: white; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #059669;">Account Details:</h3>
              <p style="margin: 5px 0;">💳 <strong>Initial Credit Limit:</strong> PKR ${creditLimit.toLocaleString()}</p>
              <p style="margin: 5px 0;">🚀 <strong>Status:</strong> Active</p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Best regards,<br>
              <strong>Paperland Team</strong>
            </p>
          </div>
        </div>
      `;
      await this.sendEmail({ to, subject, html: getEmailLayout(htmlContent, subject) });
    }
    
    console.log(`✅ B2B Approval Email sent to: ${to}`);
  }

  /**
   * Send B2B account rejection notification email
   */
  async sendB2BRejectionEmail(to: string, userName: string, companyName: string, reason?: string): Promise<void> {
    try {
      await this.sendDynamicEmail('B2B_REJECTION', to, {
        userName,
        companyName,
        reason: reason || 'Information provided did not meet our requirements.'
      });
    } catch (error) {
      console.warn('⚠️ Dynamic B2B rejection email failed, falling back to hardcoded template');
      const subject = 'B2B Account Application Update - Paperland';
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ef4444; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Application Status Update</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">Dear ${userName},</p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Your B2B account application for <strong>${companyName}</strong> was rejected due to <strong>${reason || 'unspecified reasons'}</strong>. Contact support for more info.
            </p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Best regards,<br>
              <strong>Paperland Team</strong>
            </p>
          </div>
        </div>
      `;
      await this.sendEmail({ to, subject, html: getEmailLayout(htmlContent, subject) });
    }
    
    console.log(`📧 B2B Rejection Email sent to: ${to}`);
  }

  /**
   * Send newsletter welcome email
   */
  async sendNewsletterWelcomeEmail(to: string): Promise<void> {
    const subject = 'Welcome to Paperland Newsletter';
    const htmlContent = getNewsletterWelcomeTemplate();

    await this.sendEmail({
      to,
      subject,
      html: htmlContent,
      text: `Welcome to the Paperland newsletter! Thank you for subscribing. We'll keep you updated with the latest news and insights.`
    });
    
    console.log(`📧 Newsletter Welcome Email sent to: ${to}`);
  }

  /**
   * Send notification to admin for new support ticket
   */
  async sendNewTicketNotification(ticketId: string, subject: string, category: string, userName: string): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@paperland.com.pk';
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

  /**
   * Send notification to admin for new Contact Us submission
   */
  async sendContactUsNotification(name: string, email: string, phone: string, subject: string, message: string, attachments?: string[]): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@paperland.com.pk';
    const emailSubject = `New Contact Inquiry: ${subject}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #E31E24; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
          .info-row { margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .label { font-weight: bold; display: inline-block; width: 120px; color: #666; }
          .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin-top: 20px; white-space: pre-wrap; }
          .attachments { margin-top: 15px; }
          .attachment-link { display: inline-block; padding: 5px 10px; background: #eee; border-radius: 4px; margin-right: 5px; color: #E31E24; text-decoration: none; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Contact Inquiry</h2>
          </div>
          <div class="content">
            <div class="info-row"><span class="label">Name:</span><span>${name}</span></div>
            <div class="info-row"><span class="label">Email:</span><span>${email}</span></div>
            <div class="info-row"><span class="label">Phone:</span><span>${phone}</span></div>
            <div class="info-row"><span class="label">Subject:</span><span>${subject}</span></div>
            
            <div class="message-box">
              <strong>Message:</strong><br/>
              ${message}
            </div>

            ${attachments && attachments.length > 0 ? `
              <div class="attachments">
                <strong>Attachments:</strong><br/>
                ${attachments.map((url, i) => `<a href="${url}" target="_blank" class="attachment-link">Attachment ${i + 1}</a>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({ to: adminEmail, subject: emailSubject, html });
  }

  /**
   * Send confirmation receipt to user who filled Contact Us form
   */
  async sendContactUsConfirmationEmail(to: string, name: string, subject: string): Promise<void> {
    const emailSubject = `We've received your inquiry: ${subject}`;
    const html = getContactUsConfirmationTemplate(name, subject);
    const text = `Hello ${name}, thank you for contacting Paperland. We've received your message regarding "${subject}" and will respond within 24 hours.`;

    await this.sendEmail({ to, subject: emailSubject, html, text });
    console.log(`📧 Contact Confirmation Email sent to: ${to}`);
  }

  /**
   * Send order confirmation email to customer
   */
  async sendOrderConfirmationEmail(to: string, orderData: any): Promise<void> {
    try {
      const portalUrl = (process.env.FRONTEND_URL || 'https://pl-portal.sidattech.com').replace(/\/+$/, '');
      const userName = orderData.user?.firstName || (orderData.shippingSnapshot as any)?.firstName || 'Customer';
      
      await this.sendDynamicEmail('ORDER_PLACED', to, {
        userName,
        orderNumber: orderData.orderNumber,
        trackingUrl: `${portalUrl}/en/order-tracking?orderId=${orderData.orderNumber}${orderData.guestToken ? `&guestToken=${orderData.guestToken}` : ''}`,
        orderItems: this.buildOrderItemsHtml(orderData.items, orderData.currency?.code || 'PKR'),
        deliveryDetails: this.buildDeliveryDetailsHtml(orderData),
        orderSummary: this.buildOrderSummaryHtml(orderData)
      });
    } catch (error) {
      console.warn('⚠️ Dynamic order confirmation failed, falling back to hardcoded template');
      const subject = `Your order is placed! #${orderData.orderNumber} - Paperland`;
      const html = getOrderConfirmationTemplate(orderData);
      const text = `Hi ${orderData.user?.firstName}, thank you for shopping with Paperland! Your order #${orderData.orderNumber} has been successfully placed.`;
      await this.sendEmail({ to, subject, html, text });
    }
  }

  /**
   * Send order status update email to customer
   */
  async sendOrderStatusUpdateEmail(to: string, orderData: any, newStatus: string): Promise<void> {
    const portalUrl = process.env.FRONTEND_URL || 'https://pl-portal.sidattech.com';
    const statusMap: Record<string, string> = {
      'PENDING': 'ORDER_PLACED',
      'PROCESSING': 'ORDER_PROCESSING',
      'SHIPPED': 'ORDER_SHIPPED',
      'DELIVERED': 'ORDER_DELIVERED'
    };

    const templateKey = statusMap[newStatus.toUpperCase()] || 'ORDER_PLACED';

    try {
      await this.sendDynamicEmail(templateKey, to, {
        userName: orderData.user?.firstName || 'Customer',
        orderNumber: orderData.orderNumber,
        trackingUrl: `${portalUrl}/en/order-tracking?orderId=${orderData.orderNumber}${orderData.guestToken ? `&guestToken=${orderData.guestToken}` : ''}`,
        reviewUrl: `${portalUrl}/en/dashboard/orders/${orderData.id}`,
        trackingNumber: orderData.trackingNumber || 'Not Yet Assigned',
        courierPartner: orderData.deliveryMethod || 'Standard Shipping',
        orderItems: this.buildOrderItemsHtml(orderData.items, orderData.currency?.code || 'PKR'),
        deliveryDetails: this.buildDeliveryDetailsHtml(orderData),
        orderSummary: this.buildOrderSummaryHtml(orderData),
        financialOverview: this.buildFinancialOverviewHtml(orderData)
      });
    } catch (error) {
       console.warn(`⚠️ Dynamic status update [${newStatus}] failed, falling back to hardcoded template`);
       const subject = `Status Update for Order #${orderData.orderNumber} - Paperland`;
       const html = getOrderStatusUpdateTemplate(orderData, newStatus);
       const text = `Hi ${orderData.user?.firstName}, your order #${orderData.orderNumber} status has been updated to ${newStatus.toUpperCase()}.`;
       await this.sendEmail({ to, subject, html, text });
    }
  }

  /**
   * Send notification to user when their review is approved or rejected
   */
  async sendReviewStatusEmail(to: string, userName: string, productName: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    const templateKey = status === 'APPROVED' ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED';
    try {
      await this.sendDynamicEmail(templateKey, to, {
        userName,
        productName
      });
    } catch (error) {
      console.warn(`⚠️ Failed to send dynamic review status email [${status}] to ${to}`);
    }
  }

  /**
   * Send Welcome email to individual (B2C) customer
   */
  async sendIndividualWelcomeEmail(to: string, userName: string): Promise<void> {
    const subject = 'Welcome to Paperland - Your account is ready!';
    const html = getIndividualWelcomeTemplate(userName);
    const text = `Hello ${userName}, welcome to Paperland! Your account has been successfully created and is ready for use.`;

    await this.sendEmail({ to, subject, html, text });
    console.log(`📧 Individual Welcome Email sent to: ${to}`);
  }

  /**
   * Send B2B Review Confirmation email to business applicant
   */
  async sendB2BReviewConfirmationEmail(to: string, userName: string, companyName: string): Promise<void> {
    process.stdout.write(`📧 [EMAIL PREP]: Starting B2B confirmation for ${to}\n`);
    console.log(`📧 DEBUG: sendB2BReviewConfirmationEmail entry. To: ${to}, User: ${userName}, Company: ${companyName}`);
    const subject = `B2B Application Received - ${companyName}`;
    const html = getB2BReviewConfirmationTemplate(userName, companyName);
    const text = `Hello ${userName}, thank you for your B2B application for ${companyName}. Our team is reviewing your details.`;

    await this.sendEmail({ to, subject, html, text });
    console.log(`✅ DEBUG: sendB2BReviewConfirmationEmail exit. Successfully sent to: ${to}`);
  }

  /**
   * Send a dynamic email using a template key from database
   */
  async sendDynamicEmail(key: string, to: string, data: any): Promise<void> {
    try {
      const template = await (this.prisma as any).notificationTemplate.findUnique({
        where: { name: key, isActive: true }
      });

      if (!template) {
        throw new Error(`Template [${key}] not found or is inactive in database`);
      }

      console.log(`📧 Building dynamic email from template: ${key}`);
      let htmlBody = template.body;
      let subject = template.subject;

      // Replace variables in format {{variableName}}
      Object.keys(data).forEach(varName => {
        const value = data[varName];
        const regex = new RegExp(`{{${varName}}}`, 'g');
        htmlBody = htmlBody.replace(regex, value !== undefined && value !== null ? String(value) : '');
        subject = subject.replace(regex, value !== undefined && value !== null ? String(value) : '');
      });

      const finalHtml = getEmailLayout(htmlBody, subject);

      await this.sendEmail({
        to,
        subject,
        html: finalHtml,
        text: htmlBody.replace(/<[^>]*>?/gm, '') // Simple HTML strip for text fallback
      });

      console.log(`✅ Dynamic email sent: [${key}] to ${to}`);
    } catch (error: any) {
      console.error(`❌ Failed to send dynamic email [${key}]:`, error.message);
      throw error;
    }
  }

  private buildOrderItemsHtml(items: any[], currency: string): string {
    const portalUrl = (process.env.FRONTEND_URL || 'https://pl-portal.sidattech.com').replace(/\/+$/, '');
    if (!items || items.length === 0) return '<tr><td colspan="4">No items found</td></tr>';
    
    return items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 15px 0; width: 60px;">
          <img src="${item.product?.imageUrl?.startsWith('http') ? item.product.imageUrl : portalUrl + (item.product?.imageUrl ? (item.product.imageUrl.startsWith('/') ? item.product.imageUrl : '/' + item.product.imageUrl) : '/images/placeholder.png')}" alt="${item.product?.name || 'Item'}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px; border: 1px solid #fafafa; display: block;">
        </td>
        <td style="padding: 15px 10px;">
          <div style="font-weight: bold; color: #111827; font-size: 14px;">${item.product?.name || item.sku || 'Product'}</div>
          <div style="font-size: 11px; color: #6b7280;">SKU: ${item.sku || 'N/A'}</div>
        </td>
        <td style="padding: 15px 10px; color: #4b5563; font-size: 14px; text-align: center;">x${item.quantity}</td>
        <td style="padding: 15px 0; font-weight: bold; color: #111827; text-align: right; font-size: 14px;">${currency} ${Number(item.price).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  private buildOrderSummaryHtml(order: any): string {
    const currency = order.currency?.code || 'PKR';
    const subtotal = (Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount)) + Number(order.discountAmount || 0);
    
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px; border-top: 2px solid #f3f4f6; padding-top: 15px;">
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
          <td style="padding: 5px 0; font-weight: bold; color: #111827; text-align: right; font-size: 14px;">${currency} ${subtotal.toLocaleString()}</td>
        </tr>
        ${Number(order.discountAmount) > 0 ? `
        <tr>
          <td style="padding: 5px 0; color: #E31E24; font-size: 14px;">Discount</td>
          <td style="padding: 5px 0; font-weight: bold; color: #E31E24; text-align: right; font-size: 14px;">- ${currency} ${Number(order.discountAmount).toLocaleString()}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Shipping</td>
          <td style="padding: 5px 0; font-weight: bold; color: #111827; text-align: right; font-size: 14px;">${currency} ${Number(order.shippingAmount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Tax (Included)</td>
          <td style="padding: 5px 0; font-weight: bold; color: #111827; text-align: right; font-size: 14px;">${currency} ${Number(order.taxAmount).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 15px 0 0 0; color: #111827; font-weight: bold; font-size: 18px;">Grand Total</td>
          <td style="padding: 15px 0 0 0; color: #E31E24; font-weight: 800; text-align: right; font-size: 20px;">${currency} ${Number(order.totalAmount).toLocaleString()}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 20px;">
            <div style="background-color: #f9fafb; padding: 12px; border-radius: 12px; font-size: 12px; color: #6b7280; text-align: center; border: 1px dashed #e5e7eb;">
              Payment Method: <strong>${order.paymentMethod || 'COD'}</strong>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  private buildDeliveryDetailsHtml(order: any): string {
    const snapshot = order.shippingSnapshot || {};
    return `
      <div style="color: #4b5563; font-size: 14px; line-height: 1.5; background-color: #f9fafb; padding: 15px; border-radius: 12px; border: 1px solid #f3f4f6;">
        <div style="font-weight: bold; color: #111827; margin-bottom: 5px; font-size: 15px;">${snapshot.fullName || (snapshot.firstName ? snapshot.firstName + ' ' + (snapshot.lastName || '') : 'Customer')}</div>
        <div>${snapshot.streetAddress || order.address?.street1 || 'No address provided'}</div>
        <div>${snapshot.city || order.address?.city || ''}${snapshot.province || order.address?.state ? ', ' + (snapshot.province || order.address?.state) : ''}</div>
        <div>${snapshot.country || 'Pakistan'}</div>
        <div style="margin-top: 10px; font-weight: bold; color: #111827;">Phone: ${snapshot.phone || order.address?.phone || 'N/A'}</div>
      </div>
    `;
  }

  private buildFinancialOverviewHtml(order: any): string {
    const currency = order.currency?.code || 'PKR';
    const subtotal = Number(order.subTotal || (Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount) + Number(order.discountAmount || 0)));
    const discount = Number(order.discountAmount || 0);
    const tax = Number(order.taxAmount || 0);
    const grandTotal = Number(order.totalAmount);
    const downPayment = Number(order.downPayment || 0);
    const remainingBalance = grandTotal - downPayment;

    return `
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; margin: 20px 0;">
        <div style="border-bottom: 1px dashed #e5e7eb; padding-bottom: 15px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #6b7280; font-size: 14px;">Sale Price</span>
            <span style="color: #111827; font-weight: bold; font-size: 14px;">${currency} ${subtotal.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #6b7280; font-size: 14px;">Discount</span>
            <span style="color: #ef4444; font-weight: bold; font-size: 14px;">-${currency} ${discount.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #6b7280; font-size: 14px;">Taxes</span>
            <span style="color: #111827; font-weight: bold; font-size: 14px;">${currency} ${tax.toLocaleString()}</span>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <span style="color: #111827; font-weight: 800; font-size: 16px; text-transform: uppercase;">Total Amount</span>
          <span style="color: #E31E24; font-weight: 800; font-size: 24px;">${currency} ${grandTotal.toLocaleString()}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="background-color: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #f3f4f6;">
            <p style="margin: 0; font-size: 10px; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Down Payment</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #111827; font-weight: bold;">${currency} ${downPayment.toLocaleString()}</p>
          </div>
          <div style="background-color: #fff1f2; padding: 12px; border-radius: 8px; border: 1px solid #ffe4e6;">
            <p style="margin: 0; font-size: 10px; color: #e11d48; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Remaining Balance</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #be123c; font-weight: bold;">${currency} ${remainingBalance.toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Export class for initialization with Prisma
// Singleton will be created in server.ts with fastify.prisma
export let emailService: EmailService;

export function initializeEmailService(prisma: PrismaClient) {
  emailService = new EmailService(prisma);
  return emailService;
}
