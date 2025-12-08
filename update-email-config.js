// Quick script to update email config in .env.local
// Usage: node update-email-config.js

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateConfig() {
  console.log('📧 Email Configuration Updater\n');
  console.log('Enter your SMTP credentials (press Enter to keep current value):\n');
  
  // Read current .env.local
  let envContent = '';
  if (fs.existsSync('.env.local')) {
    envContent = fs.readFileSync('.env.local', 'utf8');
  }
  
  // Get current values
  const getCurrentValue = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1] : '';
  };
  
  const currentHost = getCurrentValue('SMTP_HOST') || 'mail.upstreamcreatives.co.za';
  const currentPort = getCurrentValue('SMTP_PORT') || '587';
  const currentUser = getCurrentValue('SMTP_USER') || 'devops@upstreamcreatives.co.za';
  const currentPass = getCurrentValue('SMTP_PASSWORD') || '';
  const currentFrom = getCurrentValue('SMTP_FROM_EMAIL') || currentUser;
  
  // Get new values
  const host = await question(`SMTP Host [${currentHost}]: `) || currentHost;
  const port = await question(`SMTP Port [${currentPort}]: `) || currentPort;
  const user = await question(`SMTP User [${currentUser}]: `) || currentUser;
  const pass = await question(`SMTP Password [${currentPass ? '***hidden***' : ''}]: `) || currentPass;
  const fromEmail = await question(`From Email [${currentFrom}]: `) || currentFrom;
  
  // Update or add email config section
  const emailConfig = `
# Email Notification Configuration (SMTP)
SMTP_HOST=${host}
SMTP_PORT=${port}
SMTP_SECURE=false
SMTP_USER=${user}
SMTP_PASSWORD=${pass}
SMTP_FROM_EMAIL=${fromEmail}
SMTP_REJECT_UNAUTHORIZED=false`;
  
  // Remove old email config if exists
  const lines = envContent.split('\n');
  let inEmailSection = false;
  let newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('# Email Notification Configuration')) {
      inEmailSection = true;
      continue;
    }
    if (inEmailSection && lines[i].startsWith('SMTP_')) {
      continue;
    }
    if (inEmailSection && lines[i].trim() === '') {
      inEmailSection = false;
    }
    if (!inEmailSection) {
      newLines.push(lines[i]);
    }
  }
  
  // Add new config at the end
  const newContent = newLines.join('\n') + emailConfig;
  
  // Write back
  fs.writeFileSync('.env.local', newContent);
  
  console.log('\n✅ Email configuration updated in .env.local!');
  console.log('\n📧 You can now test with: npm run test:email your-email@example.com');
  
  rl.close();
}

updateConfig().catch(console.error);

