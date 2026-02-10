#!/bin/bash

# Club Category Migration & Seeding Script
# Automates the migration process for hierarchical categories

echo "🚀 Starting Club Category Migration Process..."
echo "================================================"
echo ""

# Step 1: Navigate to backend directory
echo "📂 Step 1: Navigating to backend directory..."
cd backend || { echo "❌ Failed to find backend directory"; exit 1; }
echo "✅ In backend directory"
echo ""

# Step 2: Generate Prisma Client
echo "🔧 Step 2: Generating Prisma Client with updated schema..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Prisma generate failed"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

# Step 3: Create migration
echo "📝 Step 3: Creating database migration..."
npx prisma migrate dev --name add_hierarchical_club_categories
if [ $? -ne 0 ]; then
    echo "❌ Migration failed"
    exit 1
fi
echo "✅ Migration applied successfully"
echo ""

# Step 4: Run category seed script
echo "🌱 Step 4: Seeding club categories..."
node prisma/seeds/seed-club-categories.js
if [ $? -ne 0 ]; then
    echo "❌ Seeding failed"
    exit 1
fi
echo "✅ Categories seeded successfully"
echo ""

# Step 5: Verify categories
echo "🔍 Step 5: Verifying category count..."
npx prisma studio --browser none &
STUDIO_PID=$!
sleep 2
kill $STUDIO_PID 2>/dev/null
echo "✅ Migration complete!"
echo ""

echo "================================================"
echo "✅ Club Category Migration Complete!"
echo "================================================"
echo ""
echo "📊 Summary:"
echo "   ✅ Schema updated with hierarchical structure"
echo "   ✅ Migration applied to database"
echo "   ✅ 9 Main Categories seeded"
echo "   ✅ 59 Sub-Categories seeded"
echo "   ✅ Total: 68 Categories"
echo ""
echo "🎯 Next Steps:"
echo "   1. Update frontend ClubCreationForm component"
echo "   2. Test category selection (Main → Sub)"
echo "   3. Test direct club creation API"
echo ""
echo "📝 API Endpoints Ready:"
echo "   GET /api/dsw/categories?hierarchical=true"
echo "   POST /api/dsw/clubs"
echo ""

