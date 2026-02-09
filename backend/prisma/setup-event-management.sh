#!/bin/bash

# =====================================================
# EVENT MANAGEMENT MODULE - QUICK SETUP SCRIPT
# =====================================================
# This script helps you set up the Event Management module
# Run this from the backend directory
# =====================================================

set -e  # Exit on error

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Event Management Module - Database Setup            ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the backend directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    echo "   cd backend && ./prisma/setup-event-management.sh"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "   Please create .env with DATABASE_URL"
    exit 1
fi

# Load DATABASE_URL from .env
export $(grep -v '^#' .env | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in .env"
    exit 1
fi

echo "✓ Environment configured"
echo ""

# Extract database connection details from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_INFO=$(echo $DATABASE_URL | sed 's/postgresql:\/\/\([^:]*\):\([^@]*\)@\([^:]*\):\([^\/]*\)\/\(.*\)/\1 \2 \3 \4 \5/')
read DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<< "$DB_INFO"

echo "Database Information:"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with migration? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "Step 1: Executing database migration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Execute migration using psql
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f prisma/manual-migrations/event-management-module.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration executed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "Step 2: Regenerating Prisma Client..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npx prisma generate

if [ $? -eq 0 ]; then
    echo "✅ Prisma Client regenerated"
else
    echo "❌ Prisma generation failed"
    exit 1
fi

echo ""
echo "Step 3: Verifying setup..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tables exist
TABLE_COUNT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');")

if [ "$TABLE_COUNT" -eq 4 ]; then
    echo "✅ All 4 tables created successfully"
else
    echo "❌ Table creation incomplete (found $TABLE_COUNT/4 tables)"
    exit 1
fi

# Check if enums exist
ENUM_COUNT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_type WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 'RegistrationStatus', 'PaymentStatus', 'EntryType');")

if [ "$ENUM_COUNT" -eq 6 ]; then
    echo "✅ All 6 enums created successfully"
else
    echo "❌ Enum creation incomplete (found $ENUM_COUNT/6 enums)"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   ✅ Event Management Module Setup Complete!          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Database Tables Created:"
echo "  • Event"
echo "  • EventRegistration"
echo "  • EventVolunteer"
echo "  • EventEntry"
echo ""
echo "Enums Created:"
echo "  • EventType, EventPaymentType, EventStatus"
echo "  • RegistrationStatus, PaymentStatus, EntryType"
echo ""
echo "Next Steps:"
echo "  1. Start backend:  npm run dev"
echo "  2. Test endpoint:  curl http://localhost:5000/api/v1/events"
echo "  3. View database:  npx prisma studio"
echo ""
echo "Documentation:"
echo "  • Quick Start: prisma/manual-migrations/README.md"
echo "  • Full Guide:  prisma/migrations/EVENT_MANAGEMENT_MIGRATION_GUIDE.md"
echo "  • SQL Queries: prisma/manual-migrations/quick-reference-queries.sql"
echo ""
echo "Happy coding! 🚀"
echo ""
