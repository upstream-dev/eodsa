// Simple Email Test Script
// Usage: node test-email-simple.js your-email@example.com

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

// Get email from command line argument or use default
const testEmail = process.argv[2] || 'solisangelo882@gmail.com';

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.upstreamcreatives.co.za',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'devops@upstreamcreatives.co.za',
    pass: process.env.SMTP_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'true'
  }
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

async function runEmailTest() {
  console.log('📧 Testing Email Configuration...\n');
  console.log(`SMTP Host: ${EMAIL_CONFIG.host}`);
  console.log(`SMTP Port: ${EMAIL_CONFIG.port}`);
  console.log(`SMTP User: ${EMAIL_CONFIG.auth.user}`);
  console.log(`Sending to: ${testEmail}\n`);
  
  try {
    // Test connection
    console.log('🔄 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    // Send test email
    console.log('📤 Sending test email...');
    const result = await transporter.sendMail({
      from: `"EODSA Test" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
      to: testEmail,
      subject: '🎉 EODSA Email Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px;">
            <h1 style="color: white; margin: 0;">✅ Email Test Successful!</h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0;">Your EODSA email system is working perfectly!</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #333;">Email Configuration Test</h2>
            <p style="color: #555;">This email confirms that your EODSA email notification system is properly configured and working.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Configuration Details:</h3>
              <p><strong>SMTP Host:</strong> ${EMAIL_CONFIG.host}</p>
              <p><strong>Port:</strong> ${EMAIL_CONFIG.port}</p>
              <p><strong>From Address:</strong> ${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}</p>
              <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
              EODSA Competition Management System
            </p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log(`📬 Check your inbox at: ${testEmail}`);
    console.log('\n🎉 Email system is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Email test failed!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Server response:', error.response);
    }
    process.exit(1);
  }
}

runEmailTest();

