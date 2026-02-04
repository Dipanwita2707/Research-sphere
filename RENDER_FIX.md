# Render Deployment - Quick Fix Guide

## ✅ Changes Made

### 1. Backend CORS Configuration
Updated to allow your deployed frontend at `https://sgt-ums-2.onrender.com`

**File**: `backend/.env`
```env
CORS_ORIGIN=http://localhost:3000,https://sgt-ums-2.onrender.com
```

**File**: `backend/src/shared/config/app.config.js`
- Now supports multiple CORS origins separated by commas

### 2. Frontend Environment Variables
Created two environment files:

**`.env.local`** (for local development):
```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
```

**`.env.production`** (for Render deployment):
```env
NEXT_PUBLIC_API_URL=https://sgt-ums.onrender.com/api/v1
```

### 3. S3 Configuration Fixed
Updated backend `.env` to use correct S3 bucket name:
```env
S3_BUCKET_NAME=newtest-lms
```

## 🚀 What to Do Next

### Step 1: Update Render Backend Environment Variables

Go to your backend service on Render: https://dashboard.render.com

1. Navigate to your backend service (`sgt-ums`)
2. Go to "Environment" tab
3. Add/Update these environment variables:

```
CORS_ORIGIN=http://localhost:3000,https://sgt-ums-2.onrender.com
S3_BUCKET_NAME=newtest-lms
NODE_ENV=production
```

4. Click "Save Changes"
5. Render will automatically redeploy

### Step 2: Update Render Frontend Environment Variables

Go to your frontend service on Render: https://dashboard.render.com

1. Navigate to your frontend service (`sgt-ums-2`)
2. Go to "Environment" tab
3. Add/Update:

```
NEXT_PUBLIC_API_URL=https://sgt-ums.onrender.com/api/v1
NEXT_PUBLIC_APP_NAME=SGT UMS
```

4. Click "Save Changes"
5. Render will automatically redeploy

### Step 3: Test Locally First

Before deploying, test locally:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit http://localhost:3000 and try logging in.

### Step 4: Deploy to Render

Once local testing works:

```bash
git add .
git commit -m "Fix CORS and API URL configuration"
git push origin main
```

Render will auto-deploy both services.

## 🔍 Troubleshooting

### If you still see CORS errors:

1. **Check Render backend logs**:
   - Go to Render dashboard → Your backend service → Logs
   - Look for startup errors

2. **Verify environment variables**:
   ```bash
   # In Render backend service, check these are set:
   CORS_ORIGIN=http://localhost:3000,https://sgt-ums-2.onrender.com
   ```

3. **Check frontend is using correct API URL**:
   - Open browser DevTools → Network tab
   - Login request should go to: `https://sgt-ums.onrender.com/api/v1/auth/login`
   - NOT `localhost:5001`

### If backend won't start on Render:

1. Check database connection:
   ```env
   DATABASE_URL="postgres://avnadmin:...@sgt-research-...aivencloud.com:12543/defaultdb?sslmode=require"
   ```

2. Make sure Aiven database is running and accessible

3. Check Render logs for specific error messages

### If frontend can't connect:

1. Verify `NEXT_PUBLIC_API_URL` is set in Render frontend environment
2. Check browser console for the actual URL being called
3. Make sure it's `https://sgt-ums.onrender.com/api/v1/...` not `localhost`

## 📝 Important Notes

### CORS Origins Format
You can add multiple origins separated by commas:
```env
CORS_ORIGIN=http://localhost:3000,https://sgt-ums-2.onrender.com,https://custom-domain.com
```

### Environment Variables on Render
- Backend: Set in Render dashboard → Backend service → Environment
- Frontend: Set in Render dashboard → Frontend service → Environment
- Changes trigger automatic redeployment

### S3 File Downloads
File download URLs will be:
```
https://sgt-ums.onrender.com/api/v1/file-upload/download/{s3-key}
```

NOT the old format:
```
https://sgt-ums.onrender.com/uploads/{path}
```

## ✨ What's Fixed

- ✅ CORS policy now allows your deployed frontend
- ✅ Frontend knows to call your deployed backend (not localhost)
- ✅ S3 configuration properly set
- ✅ Multiple CORS origins supported
- ✅ Separate configs for development and production

## 🎯 Testing Checklist

After deployment:

- [ ] Visit https://sgt-ums-2.onrender.com
- [ ] Open DevTools → Network tab
- [ ] Try to login
- [ ] Verify requests go to `https://sgt-ums.onrender.com/api/v1/...`
- [ ] No CORS errors in console
- [ ] Login succeeds
- [ ] Try uploading a file (should upload to S3)
- [ ] Try downloading a file (should download from S3)

## 🚨 Common Mistakes to Avoid

1. ❌ Don't set `NEXT_PUBLIC_API_URL` in backend .env (it's for frontend only)
2. ❌ Don't forget the `/api/v1` suffix in the API URL
3. ❌ Don't mix up S3_BUCKET_NAME and AWS_BUCKET (use S3_BUCKET_NAME)
4. ❌ Don't commit `.env` files with real credentials to git
5. ❌ Don't use `localhost` URLs in production environment variables

## 📞 Still Having Issues?

1. Check Render service logs (both backend and frontend)
2. Verify all environment variables are set correctly
3. Make sure both services are actually running (not failed)
4. Check database is accessible from Render's network
5. Test API endpoint directly: `https://sgt-ums.onrender.com/health`
