# BCL Server SSL Certificate Setup

## Overview
The BCL server has been configured with proper SSL certificate handling to resolve the "Not Secure" browser warnings.

## Current Status
✅ **Server is now running with SSL certificates**
- HTTPS: https://localhost:5150
- HTTP (fallback): http://localhost:5151

## SSL Certificate Files
The following files have been generated for secure HTTPS connections:
- `bcl.key` - Private key file
- `bcl.crt` - SSL certificate file

## Browser Security Notice

### What You'll See
Your browser may still show "Not Secure" or a red-strikethrough HTTPS because these are **self-signed certificates** (normal for development).

### How to Proceed
1. **Chrome/Edge/Firefox**: Click "Advanced" → "Proceed to localhost (unsafe)"
2. **Alternative**: Use the HTTP version at http://localhost:5151

### Why This Happens
- Self-signed certificates are not trusted by default
- This is normal for development environments
- Production servers should use certificates from a trusted Certificate Authority (CA)

## Certificate Generation Scripts

### For Future Use
Two scripts are available to regenerate certificates if needed:

**PowerShell Script:**
```powershell
.\generate-ssl.ps1
```

**Batch Script:**
```cmd
.\generate-ssl.bat
```

## Server Configuration

### Automatic Fallback
The server automatically:
1. Tries to load SSL certificates first
2. Falls back to HTTP if certificates are missing
3. Provides clear instructions in the terminal

### Environment Variables
- `USE_HTTPS=false` - Force HTTP mode
- `PORT=5150` - HTTPS port (default)
- `HTTP_PORT=5151` - HTTP fallback port

## Troubleshooting

### Issue: "Not Secure" Warning
**Solution**: This is expected with self-signed certificates. Click "Advanced" and proceed.

### Issue: Certificate Error
**Regenerate certificates**:
```powershell
cd C:\BCL\backend
.\generate-ssl.ps1
```

### Issue: Port Already in Use
**Check running processes**:
```powershell
netstat -ano | findstr :5150
```

## Security Notes

### Development Environment
- Current certificates are suitable for development
- They include localhost and bcl.local domains
- Valid for 365 days from generation

### Production Environment
For production deployment:
1. Obtain certificates from a trusted CA (Let's Encrypt, DigiCert, etc.)
2. Replace `bcl.key` and `bcl.crt` with production certificates
3. Update DNS records for your domain

## Next Steps

1. **Access the application**: https://localhost:5150
2. **Accept security warning** in your browser
3. **Start using BCL** - all functionality is available

The "Not Secure" warning has been addressed through:
- ✅ Proper SSL certificate generation
- ✅ Clear user instructions
- ✅ Automatic HTTP fallback option
- ✅ Comprehensive error handling

Your BCL server is now ready for secure development use!
