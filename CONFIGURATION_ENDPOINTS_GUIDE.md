# 📋 Configuration Endpoints Guide

## Overview

Complete API endpoints for managing city multiplicateurs and zone minimum guarantees in the AMIGOS delivery platform.

---

## 1. 🏙️ CITY CONFIGURATION ENDPOINTS

### 1.1 GET City Settings
**Retrieve current city configuration**

```
GET /api/cities/:id/settings
```

**Authentication:** Not required (public read)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "city-id-123",
    "name": "Tunis",
    "multiplicateur": 1.5,
    "isActive": true,
    "activeZones": ["zone-id-1", "zone-id-2"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 1.2 PUT Update City Multiplicateur
**Modify the city's multiplicateur (Multi_G/P)**

```
PUT /api/cities/:id/multiplicateur
```

**Authentication:** Required (Admin or SuperAdmin only)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "multiplicateur": 1.8
}
```

**Validation Rules:**
- multiplicateur must be a positive number (> 0)
- Typically between 0.5 and 3.0
- Decimal precision: 2 places

**Response (Success):**
```json
{
  "success": true,
  "message": "Multiplicateur mise à jour avec succès",
  "data": {
    "id": "city-id-123",
    "name": "Tunis",
    "multiplicateur": 1.8,
    "updatedAt": "2024-01-15T11:45:00Z"
  }
}
```

**Response (Error - Missing):**
```json
{
  "success": false,
  "message": "Le multiplicateur est requis"
}
```

**Response (Error - Invalid):**
```json
{
  "success": false,
  "message": "Le multiplicateur doit être un nombre positif (> 0)"
}
```

**Response (Error - Not Found):**
```json
{
  "success": false,
  "message": "Ville non trouvée"
}
```

---

## 2. 🎯 ZONE CONFIGURATION ENDPOINTS

### 2.1 GET Zone Guaranties
**Retrieve current zone minimum guarantees for all order types**

```
GET /api/zones/:id/garanties
```

**Authentication:** Not required (public read)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "zone-id-456",
    "number": 5,
    "minGarantieA1": 5.5,
    "minGarantieA2": 7.0,
    "minGarantieA3": 8.5,
    "minGarantieA4": 10.0,
    "price": 3.5,
    "minDistance": 0,
    "maxDistance": 5,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2.2 PUT Update Zone Garanties
**Modify minimum guarantees for one or more order types**

```
PUT /api/zones/:id/garanties
```

**Authentication:** Required (Admin or SuperAdmin only)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Update All):**
```json
{
  "minGarantieA1": 6.0,
  "minGarantieA2": 7.5,
  "minGarantieA3": 9.0,
  "minGarantieA4": 11.0
}
```

**Request Body (Update Partial):**
```json
{
  "minGarantieA1": 6.0,
  "minGarantieA3": 9.0
}
```

**Validation Rules:**
- All values must be >= 0
- At least one value must be provided
- Decimal precision: 2 places
- Order Type Mapping:
  - **A1**: Simple order (0 active orders)
  - **A2**: Dual order (1 active order)
  - **A3**: Triple order (2 active orders)
  - **A4**: Urgent/Priority order

**Response (Success):**
```json
{
  "success": true,
  "message": "Garanties mise à jour avec succès",
  "data": {
    "id": "zone-id-456",
    "number": 5,
    "minGarantieA1": 6.0,
    "minGarantieA2": 7.5,
    "minGarantieA3": 9.0,
    "minGarantieA4": 11.0,
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

**Response (Error - No Selection):**
```json
{
  "success": false,
  "message": "Veuillez sélectionner une zone"
}
```

**Response (Error - Invalid Value):**
```json
{
  "success": false,
  "message": "minGarantieA1 doit être un nombre positif ou zéro (>= 0)"
}
```

**Response (Error - Empty Request):**
```json
{
  "success": false,
  "message": "Au moins une garantie doit être fournie pour la mise à jour"
}
```

**Response (Error - Not Found):**
```json
{
  "success": false,
  "message": "Zone non trouvée"
}
```

---

## 3. 📐 Business Logic & Formulas

### Revenue Calculation Formula
```
Montant Course = Multiplicateur × Garantie Minimale
                = Multi_G/P × Min_G(Zone, OrderType)
```

### Examples

**City: Tunis (Multiplicateur = 1.5)**
**Zone 5 Guaranties:**
- A1: 5.5 TND → Revenue = 1.5 × 5.5 = **8.25 TND**
- A2: 7.0 TND → Revenue = 1.5 × 7.0 = **10.50 TND**
- A3: 8.5 TND → Revenue = 1.5 × 8.5 = **12.75 TND**
- A4: 10.0 TND → Revenue = 1.5 × 10.0 = **15.00 TND**

---

## 4. 🔐 Permission Requirements

| Endpoint | Method | Permission | Notes |
|----------|--------|-----------|-------|
| /api/cities/:id/settings | GET | Public | Read-only, no auth needed |
| /api/cities/:id/multiplicateur | PUT | Admin+ | Requires token + admin/superAdmin role |
| /api/zones/:id/garanties | GET | Public | Read-only, no auth needed |
| /api/zones/:id/garanties | PUT | Admin+ | Requires token + admin/superAdmin role |

**Roles with Update Permission:**
- ✅ SuperAdmin
- ✅ Admin
- ❌ Provider
- ❌ Deliverer
- ❌ Client

---

## 5. 📱 Frontend Integration (Configuration.tsx)

### Tab-Based Interface
The Configuration page includes three main sections:

1. **Paramètres Généraux** (General Settings)
   - App fees configuration
   - Currency selection

2. **Villes (Multiplicateur)** (Cities)
   - City selector dropdown
   - Multiplicateur input with validation
   - Save/Reset buttons

3. **Zones (Garanties)** (Zones)
   - Zone selector dropdown
   - Four guarantee inputs (A1, A2, A3, A4)
   - Validation for non-negative values
   - Save/Reset buttons

### Features
- Real-time validation feedback
- Success/Error notifications
- Unsaved changes badge
- Loading indicators
- Helpful tooltips with formulas
- French localization

---

## 6. 🧪 cURL Examples

### Get City Settings
```bash
curl -X GET "http://localhost:5000/api/cities/city-id-123/settings"
```

### Update City Multiplicateur (Admin)
```bash
curl -X PUT "http://localhost:5000/api/cities/city-id-123/multiplicateur" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"multiplicateur": 1.8}'
```

### Get Zone Guaranties
```bash
curl -X GET "http://localhost:5000/api/zones/zone-id-456/garanties"
```

### Update Zone Guaranties (Admin)
```bash
curl -X PUT "http://localhost:5000/api/zones/zone-id-456/garanties" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "minGarantieA1": 6.0,
    "minGarantieA2": 7.5,
    "minGarantieA3": 9.0,
    "minGarantieA4": 11.0
  }'
```

---

## 7. 🔍 Logging & Debugging

Controllers log configuration changes:

```
📊 City Tunis multiplicateur updated: 1.5 → 1.8
🎯 Zone 5 garanties updated: { minGarantieA1: 6, minGarantieA2: 7.5, ... }
```

---

## 8. 📝 Implementation Details

### City Configuration (cityController.js)
- **getCitySettings**: Fetches city by ID with all settings
- **updateCityMultiplicateur**: Validates (>0), updates, and returns updated city

### Zone Configuration (zoneController.js)
- **getZoneGaranties**: Fetches zone by ID with all guarantee values
- **updateZoneGaranties**: Validates (>=0), updates individual guaranties, returns updated zone

### Routes
- **cityRoutes.js**: Registers GET/:id/settings and PUT/:id/multiplicateur
- **zoneRoutes.js**: Registers GET/:id/garanties and PUT/:id/garanties

### Frontend
- **Configuration.tsx**: Three-tab interface with forms, validation, and real-time feedback

---

## 9. 🚀 Next Steps

1. **Testing**: Verify all endpoints with admin credentials
2. **Dashboard**: Monitor revenue changes after multiplicateur updates
3. **Documentation**: Create user guide for admin team
4. **Monitoring**: Set up alerts for unusual configuration changes
5. **Audit Trail**: Consider adding change history logging

---

## 10. 📞 Support

For issues or questions about these endpoints:
1. Check console logs in zoneController.js
2. Verify JWT token validity for admin operations
3. Ensure user has Admin or SuperAdmin role
4. Check request body format matches schema

---

**Last Updated:** 2024-01-15  
**Maintained By:** AMIGOS Development Team
