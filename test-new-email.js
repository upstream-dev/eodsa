require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const testEmail = process.argv[2] || 'masilelampendulo1@gmail.com';

// Try with requireTLS
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
};

console.log('Testing with requireTLS...');
console.log('User:', EMAIL_CONFIG.auth.user);
console.log('Host:', EMAIL_CONFIG.host);
console.log('Port:', EMAIL_CONFIG.port);

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

async function test() {
  try {
    console.log('\n🔄 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');
    
    console.log('📤 Sending test email...');
    const result = await transporter.sendMail({
      from: `"EODSA Test" <${process.env.SMTP_FROM_EMAIL}>`,
      to: testEmail,
      subject: '🎉 EODSA Email Test - Success!',
      html: '<h1>Email test successful!</h1>'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your inbox at:', testEmail);
  } catch (error) {
    console.error('\n❌ Email test failed!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Server response:', error.response);
    }
  }
}

test();
