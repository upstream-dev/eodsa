require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const password = 'гRNUqKхYUХDtq8RHDCaQ';
const testEmail = process.argv[2] || 'masilelampendulo1@gmail.com';

const configs = [
  {
    name: 'Port 587 with requireTLS',
    config: {
      host: 'mail.elementscentral.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'no_reply@elementscentral.com', pass: password },
      tls: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Port 587 without requireTLS',
    config: {
      host: 'mail.elementscentral.com',
      port: 587,
      secure: false,
      auth: { user: 'no_reply@elementscentral.com', pass: password },
      tls: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Port 465 with SSL',
    config: {
      host: 'mail.elementscentral.com',
      port: 465,
      secure: true,
      auth: { user: 'no_reply@elementscentral.com', pass: password },
      tls: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Username only (no domain)',
    config: {
      host: 'mail.elementscentral.com',
      port: 587,
      secure: false,
      auth: { user: 'no_reply', pass: password },
      tls: { rejectUnauthorized: false }
    }
  }
];

async function testConfig(name, config) {
  console.log(`\n🔄 Testing: ${name}...`);
  try {
    const transporter = nodemailer.createTransport(config);
    await transporter.verify();
    console.log(`✅ ${name} - Connection successful!`);
    
    const result = await transporter.sendMail({
      from: `"EODSA Test" <no_reply@elementscentral.com>`,
      to: testEmail,
      subject: `EODSA Test - ${name}`,
      html: `<h1>Test successful with ${name}</h1>`
    });
    
    console.log(`✅ ${name} - Email sent! Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name} - Failed: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log('📧 Testing multiple SMTP configurations...\n');
  for (const { name, config } of configs) {
    const success = await testConfig(name, config);
    if (success) {
      console.log(`\n🎉 SUCCESS! Use the "${name}" configuration.`);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testAll();
