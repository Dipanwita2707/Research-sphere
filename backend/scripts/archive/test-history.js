const axios = require('axios');

async function test() {
  const base = 'http://localhost:5001/api/v1/gate-entry';

  // Login
  const login = await axios.post('http://localhost:5001/api/v1/auth/login', { username: 'admin', password: 'admin123' });
  const tok = login.data.token;
  const h = { headers: { Authorization: 'Bearer ' + tok } };
  console.log('Login OK');

  // Create pass using frontend field names (fullName, not visitorName)
  const today = new Date().toISOString().split('T')[0];
  const cr = await axios.post(base + '/create-pass', {
    fullName: 'Test Visitor',
    mobileNumber: '9999999999',
    purposeOfVisit: 'Meeting',
    visitDate: today,
    expectedEntryTime: '00:00',
    expectedExitTime: '23:59',
    numberOfPersons: 1,
    bringingVehicle: false
  }, h).catch(e => { throw new Error('createPass: ' + JSON.stringify(e.response?.data || e.message)); });

  const passId = cr.data.data?.passId || cr.data.data?.pass?.passId;
  console.log('Created pass:', passId);

  // Verify pass (activates QR via real-time activation logic)
  const v0 = await axios.post(base + '/verify', { searchTerm: passId, searchType: 'pass_id' }, h)
    .catch(e => { throw new Error('verify0: ' + JSON.stringify(e.response?.data || e.message)); });
  console.log('QR status:', v0.data.data?.pass?.qr_status || 'unknown');

  // Allow Entry #1
  const e1 = await axios.post(base + '/allow-entry/' + passId, { gate: 'Main Gate' }, h)
    .catch(e => { throw new Error('entry1: ' + JSON.stringify(e.response?.data || e.message)); });
  console.log('Entry1:', e1.data.success ? 'SUCCESS' : 'FAILED', e1.data.message || '');

  // Check history after entry 1
  const v1 = await axios.post(base + '/verify', { searchTerm: passId, searchType: 'pass_id' }, h);
  const de1 = v1.data.data?.pass?.daily_entries;
  console.log('After Entry1: ' + de1?.length + ' records (expect 1)');

  // Record Exit #1
  const ex1 = await axios.post(base + '/record-exit/' + passId, { gate: 'Main Gate' }, h)
    .catch(e => { throw new Error('exit1: ' + JSON.stringify(e.response?.data || e.message)); });
  console.log('Exit1:', ex1.data.success ? 'SUCCESS' : 'FAILED');

  // Re-verify to reactivate QR for Entry #2
  await axios.post(base + '/verify', { searchTerm: passId, searchType: 'pass_id' }, h);

  // Allow Entry #2
  const e2 = await axios.post(base + '/allow-entry/' + passId, { gate: 'Main Gate' }, h)
    .catch(e => { throw new Error('entry2: ' + JSON.stringify(e.response?.data || e.message)); });
  console.log('Entry2:', e2.data.success ? 'SUCCESS' : 'FAILED', e2.data.message || '');

  // Check history after entry 2
  const v2 = await axios.post(base + '/verify', { searchTerm: passId, searchType: 'pass_id' }, h);
  const entries = v2.data.data?.pass?.daily_entries;
  console.log('After Entry2: ' + entries?.length + ' records (expect 2)');
  if (entries) {
    entries.forEach((e, i) => {
      console.log('  #' + (i+1) + ': in=' + (e.entry_time ? new Date(e.entry_time).toLocaleTimeString() : '-') + ' out=' + (e.exit_time ? new Date(e.exit_time).toLocaleTimeString() : 'INSIDE'));
    });
  }
  
  if (entries?.length >= 2) {
    console.log('\n✅ PASSED: Multiple check-in/check-out cycles tracked correctly');
  } else {
    console.log('\n❌ FAILED: Expected 2 entries, got', entries?.length || 0);
    process.exit(1);
  }
}

test().catch(e => { console.error('Error:', e.message); process.exit(1); });
