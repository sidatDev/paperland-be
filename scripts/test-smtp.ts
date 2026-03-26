
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testSMTP() {
  console.log('--- 🛡️ SMTP Diagnostic Tool ---');
  
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SENDER_EMAIL
  };

  console.log(`📡 Target: ${config.host}:${config.port}`);
  console.log(`👤 User:   ${config.user}`);
  console.log(`📧 From:   ${config.from}`);
  console.log(`🔑 Pass:   ${config.pass ? config.pass.substring(0, 4) + '...' : 'MISSING'}`);

  if (!config.host || !config.user || !config.pass) {
    console.error('❌ ERROR: Missing required SMTP environment variables in .env');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('\n⏳ Verifying connection...');
    await transporter.verify();
    console.log('✅ SUCCESS: SMTP server is reachable and credentials are valid!');

    console.log('\n⏳ Sending test email to sender address...');
    await transporter.sendMail({
      from: config.from,
      to: config.from,
      subject: '🛡️ SMTP Diagnostic Test',
      text: 'If you received this, your SMTP settings are working perfectly.'
    });
    console.log(`✅ SUCCESS: Test email sent to ${config.from}`);

  } catch (error: any) {
    console.error('\n❌ SMTP FAILURE:');
    console.error(`   Code:    ${error.code || 'N/A'}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.error('\n📝 ADVICE: Authentication failed. This usually means:');
      console.error('   1. The SMTP_USER or SMTP_PASS in .env is incorrect.');
      console.error('   2. For Brevo: The SMTP_USER should be your account email.');
      console.error('   3. For Brevo: The SMTP_PASS should be an "SMTP Key" from the Brevo dashboard.');
    } else if (error.code === 'ESOCKET') {
      console.error('\n📝 ADVICE: Connection failed. Check your SMTP_HOST and SMTP_PORT.');
    }
  }
}

testSMTP();
