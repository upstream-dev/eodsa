# Localhost Database Connection Issue

## Problem
Your localhost environment cannot connect to the Neon database, resulting in `ETIMEDOUT` errors. This is a **network connectivity issue** at the firewall/proxy level.

## Symptoms
- All API endpoints return 500 errors
- Error: `ETIMEDOUT` or connection timeout
- Works fine in production/staging (those environments have proper network access)

## Root Cause
Your local machine's firewall, corporate proxy, or network configuration is blocking outbound connections to Neon's database servers (`*.neon.tech`).

## Solutions

### Solution 1: Check Firewall Settings (macOS)
```bash
# Check if firewall is blocking connections
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Temporarily disable firewall to test (NOT recommended for long-term)
# System Preferences > Security & Privacy > Firewall > Turn Off Firewall
```

### Solution 2: Use a Different Network
- Try connecting from a different network (home network, mobile hotspot)
- If it works on a different network, your current network has restrictions

### Solution 3: Configure Corporate Proxy
If you're on a corporate network:
1. Ask your IT department to whitelist `*.neon.tech` domains
2. Or configure proxy settings in your environment variables:
   ```bash
   export HTTPS_PROXY=http://proxy.company.com:8080
   export HTTP_PROXY=http://proxy.company.com:8080
   ```

### Solution 4: Use VPN
- Connect to a VPN that allows database connections
- Some VPNs block certain types of connections

### Solution 5: Use SSH Tunnel (Advanced)
If you have SSH access to a server that can reach the database:
```bash
ssh -L 5432:ep-lingering-base-a426puts.us-east-1.aws.neon.tech:5432 user@your-server
```
Then update `DATABASE_URL` to use `localhost:5432`

### Solution 6: Test Database Connectivity
Run this to test if the database host is reachable:
```bash
# Test DNS resolution
nslookup ep-lingering-base-a426puts.us-east-1.aws.neon.tech

# Test port connectivity
nc -zv ep-lingering-base-a426puts.us-east-1.aws.neon.tech 5432
```

## Quick Test
Run this script to verify the connection:
```bash
node scripts/test-pg-connection.js
```

If this fails with `ETIMEDOUT`, it confirms network connectivity is the issue.

## Temporary Workaround
While you fix the network issue, you can:
1. Develop on a different machine/network
2. Use staging/production environment for testing
3. Use a VPN that allows database connections

## Next Steps
1. **Check your firewall/antivirus software** - temporarily disable to test
2. **Try a different network** - mobile hotspot, home WiFi
3. **Contact your network admin** if on corporate network
4. **Check macOS firewall settings** in System Preferences

The code is configured correctly - this is purely a network/firewall issue on your local machine.

