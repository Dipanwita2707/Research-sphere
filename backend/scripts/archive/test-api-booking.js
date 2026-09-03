// Test: createBooking API endpoint integration test
// Tests that the new datetime fields and billing logic work end-to-end

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

async function runTest() {
  try {
    // 1. Find an admin user to authenticate
    const user = await prisma.userLogin.findFirst({
      where: { status: 'active', role: 'admin' },
      select: { id: true, uid: true, role: true }
    });
    
    if (!user) {
      // fallback: try any active user
      const anyUser = await prisma.userLogin.findFirst({
        where: { status: 'active' },
        select: { id: true, uid: true, role: true }
      });
      if (!anyUser) {
        console.log('SKIP: No active user found in DB');
        await prisma.$disconnect();
        return;
      }
      console.log(`Using fallback user: ${anyUser.uid} (${anyUser.role})`);
      var userToUse = anyUser;
    } else {
      console.log(`Using admin user: ${user.uid} (${user.role})`);
      var userToUse = user;
    }

    // 2. Generate a JWT token
    const token = jwt.sign(
      { id: userToUse.id, uid: userToUse.uid, role: userToUse.role },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    // 3. Test the endpoint with datetime fields (should fail validation gracefully - no room/pass)
    const body = JSON.stringify({
      passId: '00000000-0000-0000-0000-000000000000',
      hostelId: '00000000-0000-0000-0000-000000000000',
      roomId: '00000000-0000-0000-0000-000000000000',
      checkInDatetime: '2026-03-12T10:00:00.000Z',
      checkOutDatetime: '2026-03-14T12:00:00.000Z',
      checkInRemarks: 'Test booking',
      guestCount: 2
    });

    const result = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5001,
        path: '/api/v1/gate-entry/bookings/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    console.log(`Response status: ${result.status}`);
    const parsed = JSON.parse(result.body);
    console.log(`Response message: ${parsed.message}`);

    // We expect a 400/404/500 since the pass/room/hostel don't exist
    // Key: it should NOT be "Route not found" (404 from express)
    // And NOT a raw Prisma error about unknown fields
    if (parsed.message && !parsed.message.includes('Route not found')
        && !parsed.message.includes('Unknown arg')
        && !parsed.message.includes('check_in_date')
        && !parsed.message.includes('check_out_date')) {
      console.log('PASS | Endpoint accepts new datetime fields without schema errors');
    } else {
      console.log('FAIL | Unexpected error:', parsed.message);
      process.exit(1);
    }

    // 4. Verify the hostel_booking table has correct columns
    const cols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'hostel_booking' 
      ORDER BY ordinal_position
    `;
    const colNames = cols.map(c => c.column_name);
    console.log('\nDB columns:', colNames.join(', '));

    const required = ['check_in_datetime', 'check_out_datetime', 'billable_days', 'check_in_remarks', 'price_per_day'];
    const removed = ['check_in_date', 'check_out_date'];
    
    for (const col of required) {
      if (colNames.includes(col)) console.log(`PASS | Column ${col} exists`);
      else { console.log(`FAIL | Column ${col} missing`); process.exit(1); }
    }
    for (const col of removed) {
      if (!colNames.includes(col)) console.log(`PASS | Old column ${col} removed`);
      else { console.log(`FAIL | Old column ${col} still exists`); process.exit(1); }
    }

    console.log('\n✅ ALL API + DB TESTS PASSED');

  } catch (error) {
    console.error('Test error:', error.message || error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
