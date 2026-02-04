# Deploying SGT UMS to Render

This guide will walk you through deploying the SGT University Management System to Render.

## Prerequisites

1. A GitHub account with your repository pushed
2. A Render account (sign up at https://render.com)
3. Your repository URL: https://github.com/Dipanwita2707/Sgt-Ums.git

## Deployment Steps

### Option 1: Using render.yaml (Recommended - Automated)

1. **Connect Your GitHub Repository**
   - Go to https://render.com/dashboard
   - Click "New +" → "Blueprint"
   - Connect your GitHub account if not already connected
   - Select the repository: `Dipanwita2707/Sgt-Ums`
   - Select the branch: `fresh-main`
   - Render will automatically detect the `render.yaml` file

2. **Configure Environment Variables**
   
   The following environment variables will be automatically set from render.yaml, but you need to manually add:
   
   **Backend Service (`sgt-ums-backend`):**
   - `EMAIL_USER`: Your Gmail address (e.g., sourav11092002@gmail.com)
   - `EMAIL_PASS`: Your Gmail app-specific password
   - `EMAIL_FROM_ADDRESS`: Your Gmail address
   
   All other variables are pre-configured in render.yaml.

3. **Deploy**
   - Click "Apply" to create all services
   - Render will:
     - Create a PostgreSQL database
     - Deploy the backend API
     - Deploy the frontend
   - Wait 5-10 minutes for initial deployment

4. **Update Frontend URL**
   - Backend URL: `https://sgt-ums.onrender.com`
   - Go to frontend service settings
   - Update `NEXT_PUBLIC_API_URL` to: `https://sgt-ums.onrender.com/api/v1`
   - Trigger a manual redeploy of the frontend

### Option 2: Manual Setup

#### Step 1: Create PostgreSQL Database

1. Go to Render Dashboard → New + → PostgreSQL
2. Configure:
   - **Name**: `sgt-ums-db`
   - **Database**: `sgt_university`
   - **User**: `sgt_user`
   - **Region**: Singapore (or closest to your users)
   - **Plan**: Starter (free)
3. Click "Create Database"
4. Copy the **Internal Database URL** (starts with `postgresql://`)

#### Step 2: Deploy Backend

1. Go to Render Dashboard → New + → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `sgt-ums-backend`
   - **Region**: Singapore
   - **Branch**: `fresh-main`
   - **Root Directory**: Leave empty
   - **Environment**: Node
   - **Build Command**: 
     ```bash
     cd backend && npm install && npx prisma generate && npx prisma migrate deploy
     ```
   - **Start Command**: 
     ```bash
     cd backend && npm start
     ```
   - **Plan**: Starter (free)

4. Add Environment Variables:
   ```env
   NODE_ENV=production
   PORT=5000
   API_VERSION=v1
   DATABASE_URL=<paste your PostgreSQL Internal Database URL>
   JWT_SECRET=<generate a random 64-character string>
   JWT_EXPIRE=7d
   JWT_COOKIE_EXPIRE=7
   BCRYPT_ROUNDS=10
   MAX_LOGIN_ATTEMPTS=5
   LOCKOUT_DURATION=15
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX_REQUESTS=100
   FRONTEND_URL=https://sgt-ums-frontend.onrender.com
   # Note: Backend is deployed at https://sgt-ums.onrender.com
   EMAIL_USER=sourav11092002@gmail.com
   EMAIL_PASS=<your Gmail app-specific password>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   EMAIL_FROM_NAME=SGT Research Portal
   EMAIL_FROM_ADDRESS=sourav11092002@gmail.com
   ```

5. Click "Create Web Service"

#### Step 3: Deploy Frontend

1. Go to Render Dashboard → New + → Web Service
2. Connect your GitHub repository (if not already)
3. Configure:
   - **Name**: `sgt-ums-frontend`
   - **Region**: Singapore
   - **Branch**: `fresh-main`
   - **Root Directory**: Leave empty
   - **Environment**: Node
   - **Build Command**: 
     ```bash
     cd frontend && npm install && npm run build
     ```
   - **Start Command**: 
     ```bash
     cd frontend && npm start
     ```
   - **Plan**: Starter (free)

4. Add Environment Variables:
   ```env
   NEXT_PUBLIC_API_URL=https://sgt-ums.onrender.com/api/v1
   NEXT_PUBLIC_APP_NAME=SGT UMS
   NODE_ENV=production
   ```

5. Click "Create Web Service"

## Post-Deployment Setup

### 1. Verify Deployment

- **Backend Health Check**: Visit `https://sgt-ums.onrender.com/api/v1/health`
  - Should return: `{"status":"ok","message":"API is running",...}`

- **Frontend**: Visit `https://sgt-ums-frontend.onrender.com`
  - Should load the login page

### 2. Run Database Migrations (If needed)

If migrations didn't run automatically:

1. Go to backend service → Shell
2. Run:
   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

### 3. Seed Initial Data (Optional)

If you need to seed initial data:

1. Go to backend service → Shell
2. Run:
   ```bash
   cd backend
   npm run seed
   ```

### 4. Configure Custom Domain (Optional)

1. Go to your service settings
2. Click "Custom Domain"
3. Add your domain and follow DNS instructions

## Important Notes

### Free Tier Limitations

- **Spin Down**: Free services spin down after 15 minutes of inactivity
- **Cold Start**: First request after spin down takes 30-60 seconds
- **Database**: Free PostgreSQL has 90-day expiration (backup regularly)
- **Storage**: Uploaded files are ephemeral on free tier

### File Uploads Issue

⚠️ **IMPORTANT**: Render's free tier doesn't support persistent file storage.

**Solutions:**
1. **Upgrade to Paid Plan**: Get persistent disk storage
2. **Use External Storage**: 
   - AWS S3
   - Cloudinary
   - Google Cloud Storage
   - Azure Blob Storage

To implement S3 storage:
```bash
cd backend
npm install @aws-sdk/client-s3 multer-s3
```

Then modify your file upload configuration to use S3.

### Environment Variables Security

- Never commit `.env` files
- Use Render's Environment Variables UI
- Rotate JWT secrets regularly
- Use app-specific passwords for Gmail

### Gmail Setup

To get an app-specific password:
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Use this password in `EMAIL_PASS`

## Monitoring

### View Logs

1. Go to your service in Render dashboard
2. Click "Logs" tab
3. View real-time logs

### Set Up Alerts

1. Go to service settings → Notifications
2. Add email/Slack for deploy failures
3. Configure health check alerts

## Scaling

When you outgrow free tier:

1. **Upgrade to Starter/Standard Plan**:
   - Better performance
   - No spin down
   - More memory/CPU

2. **Database Scaling**:
   - Upgrade PostgreSQL plan
   - Add read replicas
   - Enable connection pooling

3. **Add Redis**:
   - For caching and session management
   - Significantly improves performance

## Troubleshooting

### Build Fails

- Check build logs for errors
- Ensure all dependencies are in package.json
- Verify build commands are correct

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check if database is running
- Ensure migrations ran successfully

### Frontend Can't Connect to Backend

- Verify NEXT_PUBLIC_API_URL is correct
- Check CORS settings in backend
- Ensure backend is running

### Email Not Sending

- Verify EMAIL_PASS is app-specific password
- Check Gmail security settings
- Review email service logs

## Backup Strategy

### Database Backups

1. Go to database service → Backups
2. Enable automatic backups
3. Download manual backup:
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

### Code Backups

- Always push to GitHub
- Tag releases
- Keep production branch stable

## Cost Estimation

**Free Tier:**
- Backend: $0/month (with limitations)
- Frontend: $0/month (with limitations)
- Database: $0/month (90 days, then $7/month)
- **Total: $0-7/month**

**Starter Plan:**
- Backend: $7/month
- Frontend: $7/month
- Database: $7/month
- **Total: $21/month**

**With Redis:**
- Add $7/month for Redis

## Next Steps

1. ✅ Deploy using Blueprint or Manual setup
2. ✅ Verify all services are running
3. ✅ Test login functionality
4. ✅ Upload test files (note: ephemeral on free tier)
5. ✅ Set up monitoring and alerts
6. ⚠️ Plan for file storage solution
7. 📊 Monitor performance and costs

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- Your Project Issues: https://github.com/Dipanwita2707/Sgt-Ums/issues

---

**Last Updated**: February 2, 2026
**Author**: GitHub Copilot
**Version**: 1.0
