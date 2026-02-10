# DSW System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you get the DSW system up and running quickly.

---

## Step 1: Run Database Migration (2 minutes)

Open PowerShell in your backend directory:

```powershell
cd backend
npx prisma migrate dev --name add_dsw_module
```

This creates all DSW tables, enums, and relations in your PostgreSQL database.

**Expected Output:**
```
✓ DSW schema added
✓ 5 new tables created
✓ 7 new enums created
✓ Relations established
```

---

## Step 2: Seed Club Categories (1 minute)

### Option A: Via API (Recommended)

1. Start your backend server:
   ```powershell
   npm run dev
   ```

2. Make a POST request (using Postman, Insomnia, or curl):
   ```bash
   POST http://localhost:5000/api/dsw/categories/seed/default
   Authorization: Bearer <your-admin-token>
   ```

### Option B: Via Prisma Seed

Add to `backend/prisma/seed.js` and run `npx prisma db seed`.

**Expected Result:**
9 categories created (Cultural, Technical, Sports, Literary, Social Service, Innovation/Research, Academic, Environment, Photography & Media)

---

## Step 3: Register DSW Routes (1 minute)

Open `backend/src/server.js` and add:

```javascript
// Import DSW module
const dswModule = require('./modules/dsw');

// Register DSW routes (after authentication middleware)
app.use('/api/dsw', dswModule.routes);
```

**Restart your server.**

---

## Step 4: Verify Installation (1 minute)

Test the health endpoint:

```bash
curl http://localhost:5000/api/dsw/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "DSW module is operational",
  "timestamp": "2026-02-09T..."
}
```

Test categories endpoint:
```bash
curl http://localhost:5000/api/dsw/categories \
  -H "Authorization: Bearer <your-token>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Cultural",
      "description": "Arts, music, dance, theater, and cultural activities",
      ...
    },
    ...
  ]
}
```

---

## Step 5: Integrate Noting Approval (Optional - for auto-club creation)

When a DSW noting is approved, add this to your Noting approval handler:

```javascript
const dswModule = require('./modules/dsw');

async function handleNotingApproval(notingId, approvedById) {
  const noting = await prisma.note.findUnique({ where: { id: notingId } });

  // Check if DSW club creation noting
  if (noting.category === 'administrative' && 
      noting.subcategory === 'DSW' &&
      noting.metadata?.dswModule === 'club_creation') {
    
    const club = await dswModule.services.notingIntegration
      .processApprovedClubCreationNoting(noting, approvedById);
    
    console.log('✅ Club created:', club.name);
  }
}
```

---

## 🧪 Quick Test

### Test 1: Create a Club Noting (as Faculty)

```bash
POST http://localhost:5000/api/dsw/noting/club-creation
Authorization: Bearer <faculty-token>
Content-Type: application/json

{
  "name": "Tech Innovation Club",
  "categoryId": "<technical-category-id>",
  "purpose": "To foster innovation and technical skills among students through hackathons, workshops, and collaborative projects focusing on emerging technologies.",
  "academicSession": "2025-2026",
  "viceChairpersonId": "<student-user-id>",
  "targetStudentGroup": "all",
  "expectedActivityTypes": ["Workshops", "Competitions"],
  "codeOfConductAccepted": true,
  "antiDiscriminationAccepted": true,
  "meetingFrequency": "monthly",
  "estimatedAnnualActivityCount": 12,
  "infrastructureRequirements": ["Lab"],
  "fundingRequired": true,
  "estimatedFundingAmount": 50000,
  "visibility": "public",
  "allowInternalCollaboration": true,
  "allowExternalCollaboration": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Club creation noting submitted successfully",
  "data": {
    "id": "...",
    "notingId": "DSW-CLB-2026-00001",
    "status": "pending",
    ...
  }
}
```

### Test 2: Approve the Noting

Use your existing Noting approval flow.

### Test 3: Verify Club Created

```bash
GET http://localhost:5000/api/dsw/clubs?search=Tech%20Innovation
Authorization: Bearer <token>
```

### Test 4: Add a Member

```bash
POST http://localhost:5000/api/dsw/clubs/<club-id>/members
Authorization: Bearer <vice-chair-or-faculty-token>
Content-Type: application/json

{
  "studentId": "<student-user-id>"
}
```

---

## 📂 Key Files

- **Backend Module**: `backend/src/modules/dsw/`
- **API Documentation**: `backend/src/modules/dsw/README.md`
- **Setup Guide**: `backend/src/modules/dsw/SETUP.md`
- **Schema**: `backend/prisma/schema.prisma` (DSW section at end)
- **Frontend Types**: `frontend/src/features/dsw/types/`
- **Frontend API**: `frontend/src/features/dsw/services/api.ts`

---

## 🐛 Troubleshooting

### Issue: Migration fails
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct.

### Issue: Categories not showing
**Solution**: Run the seed endpoint again.

### Issue: 403 Forbidden when creating noting
**Solution**: Ensure user has role 'faculty' in database.

### Issue: Club not created after noting approval
**Solution**: Check if approval handler integration (Step 5) is complete.

---

## 📞 Next Actions

1. ✅ **Migration** - Run Prisma migrate
2. ✅ **Seed** - Seed categories
3. ✅ **Register** - Add routes to server
4. ✅ **Test** - Test health and categories endpoints
5. ⏳ **Build UI** - Create frontend components
6. ⏳ **Integrate** - Connect to Noting approval flow
7. ⏳ **Deploy** - Deploy to staging/production

---

## 🎉 You're Ready!

The DSW backend is fully operational. You can now:
- Create club notings via API
- Manage club members
- Track audit logs
- View statistics

**Next**: Build the frontend UI components to complete the user experience.

---

**For detailed documentation, see:**
- [Complete Implementation Summary](../DSW_IMPLEMENTATION_SUMMARY.md)
- [Backend README](backend/src/modules/dsw/README.md)
- [Setup Guide](backend/src/modules/dsw/SETUP.md)
