# Club Category Migration & Seeding Script (PowerShell)
# Automates the migration process for hierarchical categories

Write-Host "🚀 Starting Club Category Migration Process..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Navigate to backend directory
Write-Host "📂 Step 1: Navigating to backend directory..." -ForegroundColor Yellow
try {
    Set-Location -Path ".\backend" -ErrorAction Stop
    Write-Host "✅ In backend directory" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to find backend directory" -ForegroundColor Red
    exit 1
}

# Step 2: Generate Prisma Client
Write-Host "🔧 Step 2: Generating Prisma Client with updated schema..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma generate failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

# Step 3: Create migration
Write-Host "📝 Step 3: Creating database migration..." -ForegroundColor Yellow
npx prisma migrate dev --name add_hierarchical_club_categories
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migration applied successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Run category seed script
Write-Host "🌱 Step 4: Seeding club categories..." -ForegroundColor Yellow
node prisma/seeds/seed-club-categories.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Categories seeded successfully" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ Club Category Migration Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   ✅ Schema updated with hierarchical structure"
Write-Host "   ✅ Migration applied to database"
Write-Host "   ✅ 9 Main Categories seeded"
Write-Host "   ✅ 59 Sub-Categories seeded"
Write-Host "   ✅ Total: 68 Categories"
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Update frontend ClubCreationForm component"
Write-Host "   2. Test category selection (Main → Sub)"
Write-Host "   3. Test direct club creation API"
Write-Host ""
Write-Host "📝 API Endpoints Ready:" -ForegroundColor Cyan
Write-Host "   GET /api/dsw/categories?hierarchical=true"
Write-Host "   POST /api/dsw/clubs"
Write-Host ""

# Return to original directory
Set-Location -Path ".."

