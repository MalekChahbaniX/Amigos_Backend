# HTTPS Configuration - Quick Reference Guide

## Implementation Summary

### What Was Configured
✅ Express proxy trust settings
✅ HTTPS detection in upload routes  
✅ Correct image URL generation with HTTPS protocol
✅ Support for production and development deployments

---

## Code Changes

### 1. server.js (Line ~49)
```javascript
// Trust proxy headers (for HTTPS behind reverse proxy)
app.set('trust proxy', 1);
```

**Effect:** Tells Express to trust the X-Forwarded-Proto header from your reverse proxy

---

### 2. routes/uploadRoutes.js - Product Upload (Lines 59-76)
```javascript
// Construire l'URL de l'image avec détection HTTPS correcte
const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
const protocol = isHttps ? 'https' : 'http';
const baseUrl = `${protocol}://${req.get('host')}`;
const imageUrl = `${baseUrl}/uploads/product/${req.file.filename}`;
```

### 3. routes/uploadRoutes.js - Provider Upload (Lines 86-103)
```javascript
// Construire l'URL de l'image avec détection HTTPS correcte
const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
const protocol = isHttps ? 'https' : 'http';
const baseUrl = `${protocol}://${req.get('host')}`;
const imageUrl = `${baseUrl}/uploads/provider/${req.file.filename}`;
```

---

## How It Works

| Deployment Scenario | req.secure | x-forwarded-proto | Result |
|---|---|---|---|
| Direct HTTPS | true | https | ✓ Uses HTTPS |
| Behind Reverse Proxy | false | https | ✓ Uses HTTPS |
| Development HTTP | false | (not set) | ✓ Uses HTTP |
| Mobile App via Proxy | false | https | ✓ Uses HTTPS |

---

## Testing

### Run Unit Tests
```bash
node test-https-urls.js
```
✓ Tests 6 different deployment scenarios
✓ All tests pass

### Run Integration Test
```bash
node integration-test-https.js
```
✓ Demonstrates complete request/response flow
✓ Shows URL generation for each scenario
✓ All 4 deployment scenarios validated

---

## Deployment Checklist

- [ ] Verify `app.set('trust proxy', 1)` is in server.js
- [ ] Restart backend service
- [ ] Test image upload in production
- [ ] Verify returned URLs have `https://` protocol
- [ ] Check images load correctly in browser
- [ ] Monitor for mixed content warnings
- [ ] Verify reverse proxy forwards X-Forwarded-Proto header

---

## Reverse Proxy Configuration

### Nginx Example
```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

### Cloudflare
Automatically forwards X-Forwarded-Proto header ✓

### AWS Load Balancer
Enable X-Forwarded-Proto in target group settings ✓

---

## Common Issues & Solutions

### Issue: Images returning HTTP in production
**Solution:** 
1. Verify `app.set('trust proxy', 1)` exists
2. Check reverse proxy config sends X-Forwarded-Proto
3. Run tests to verify HTTPS detection

### Issue: Mixed content errors
**Solution:**
1. Ensure HTTPS detection works (run tests)
2. Check all URLs start with `https://`
3. Verify browser console for warnings

### Issue: Images work locally but not in production
**Solution:**
1. Verify reverse proxy forwards headers
2. Test with actual domain, not localhost
3. Check CORS configuration in server.js

---

## Key Files

| File | Change |
|------|--------|
| [server.js](server.js#L49) | Added `app.set('trust proxy', 1)` |
| [routes/uploadRoutes.js](routes/uploadRoutes.js#L59) | Updated HTTPS detection logic |
| [test-https-urls.js](test-https-urls.js) | Unit test suite (6 scenarios) |
| [integration-test-https.js](integration-test-https.js) | Integration test (4 scenarios) |
| [HTTPS_CONFIGURATION.md](HTTPS_CONFIGURATION.md) | Detailed documentation |

---

## What Each Component Does

**app.set('trust proxy', 1)**
- Enables Express to read X-Forwarded-Proto header
- Critical for HTTPS detection behind proxies

**req.secure**
- True only for direct HTTPS connections
- False when behind proxy (proxy terminates HTTPS)

**req.headers['x-forwarded-proto']**
- Set by reverse proxy (Nginx, Cloudflare, etc.)
- Indicates original protocol (https or http)

**req.get('host')**
- Returns Host header from request
- Used to build correct domain in URL

---

## Testing Your Implementation

### Manual Test Steps
1. Upload an image via `/api/uploads/product` endpoint
2. Check returned `imageUrl` in response
3. Verify it has correct protocol:
   - Production: `https://amigosdelivery25.com/...`
   - Development: `http://localhost:5000/...`
4. Open URL in browser - image should load

### Example Response
```json
{
  "success": true,
  "imageUrl": "https://amigosdelivery25.com/uploads/product/uuid.jpg",
  "message": "Image uploadée avec succès"
}
```

---

## Production Best Practices

1. ✓ Always use HTTPS in production
2. ✓ Configure reverse proxy to forward headers
3. ✓ Use `app.set('trust proxy', 1)` when behind proxy
4. ✓ Test HTTPS detection before deploying
5. ✓ Enable HSTS headers on reverse proxy
6. ✓ Monitor for mixed content warnings
7. ✓ Document your reverse proxy configuration

---

## Support & Troubleshooting

For issues or questions:
1. Check the test output: `node test-https-urls.js`
2. Review [HTTPS_CONFIGURATION.md](HTTPS_CONFIGURATION.md)
3. Verify reverse proxy forwards X-Forwarded-Proto
4. Check browser console for HTTPS/mixed content errors
5. Monitor backend logs for upload activity

---

**Status:** ✅ FULLY IMPLEMENTED & TESTED
