# ⚡ Configuration Endpoints - Quick Reference

## API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cities/:id/settings` | GET | ❌ | Get city config |
| `/api/cities/:id/multiplicateur` | PUT | ✅ Admin | Update multiplicateur |
| `/api/zones/:id/garanties` | GET | ❌ | Get zone guaranties |
| `/api/zones/:id/garanties` | PUT | ✅ Admin | Update guaranties |

---

## Request/Response Samples

### 1️⃣ Get City Settings
```bash
GET /api/cities/city-123/settings
```
```json
→ { "multiplicateur": 1.5, "name": "Tunis" }
```

### 2️⃣ Update City Multiplicateur
```bash
PUT /api/cities/city-123/multiplicateur
{ "multiplicateur": 1.8 }
```
```json
→ { "multiplicateur": 1.8, "message": "success" }
```

### 3️⃣ Get Zone Guaranties
```bash
GET /api/zones/zone-456/garanties
```
```json
→ {
  "minGarantieA1": 5.5,
  "minGarantieA2": 7.0,
  "minGarantieA3": 8.5,
  "minGarantieA4": 10.0
}
```

### 4️⃣ Update Zone Guaranties
```bash
PUT /api/zones/zone-456/garanties
{
  "minGarantieA1": 6.0,
  "minGarantieA2": 7.5,
  "minGarantieA3": 9.0,
  "minGarantieA4": 11.0
}
```

---

## Validation Rules

### Multiplicateur
- ✅ Must be > 0
- ✅ Typical range: 0.5 - 3.0
- ✅ 2 decimal places

### Guaranties
- ✅ Must be >= 0
- ✅ Decimal precision: 2 places
- ✅ Can update partially

---

## Formula
```
Revenue = Multiplicateur × Guarantee
        = 1.5 × 7.0 = 10.50 TND (for A2)
```

---

## Frontend Components
- **Configuration.tsx**: 3-tab admin interface
- Tab 1: General Settings
- Tab 2: City Multiplicateurs
- Tab 3: Zone Guaranties

---

## Error Codes

| Error | Cause | Fix |
|-------|-------|-----|
| "Multiplicateur > 0" | Invalid value | Use positive number |
| "Garantie >= 0" | Negative value | Use non-negative |
| "Zone not found" | Wrong ID | Verify zone ID |
| "Unauthorized" | No admin token | Login as admin |

---

**All endpoints return JSON responses with success flag and data/message fields.**
