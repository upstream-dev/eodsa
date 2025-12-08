// Test with explicit UTF-8 encoding
require('dotenv').config({ path: '.env.local', encoding: 'utf8' });
const nodemailer = require('nodemailer');

const testEmail = process.argv[2] || 'masilelampendulo1@gmail.com';

// Explicitly set the password
const password = 'гRNUqKхYUХDtq8RHDCaQ';
const envPassword = process.env.SMTP_PASSWORD;

console.log('Password from env length:', envPassword?.length);
console.log('Expected password length:', password.length);
console.log('Passwords match:', envPassword === password);

// Use explicit password
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: password  // Use explicit password
  },
  tls: {
    rejectUnauthorized: false
  }
};

console.log('\n📧 Testing Email Configuration...');
console.log(`SMTP Host: ${EMAIL_CONFIG.host}`);
console.log(`SMTP Port: ${EMAIL_CONFIG.port}`);
console.log(`SMTP User: ${EMAIL_CONFIG.auth.user}`);
console.log(`Sending to: ${testEmail}\n`);

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

async function test() {
  try {
    console.log('🔄 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    console.log('📤 Sending test email...');
    const result = await transporter.sendMail({
      from: `"EODSA Test" <${process.env.SMTP_FROM_EMAIL}>`,
      to: testEmail,
      subject: '🎉 EODSA Email Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px;">
            <h1 style="color: white; margin: 0;">✅ Email Test Successful!</h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0;">Your EODSA email system is working perfectly!</p>
          </div>
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>This email confirms that your EODSA email notification system is properly configured.</p>
            <p><strong>SMTP Server:</strong> ${EMAIL_CONFIG.host}</p>
            <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your inbox at:', testEmail);
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

test();
