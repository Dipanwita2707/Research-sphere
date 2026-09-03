const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => client.query(`
    ALTER TABLE loan_letter_template
      ADD COLUMN IF NOT EXISTS header_image_width INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS watermark_image_url VARCHAR(1024),
      ADD COLUMN IF NOT EXISTS watermark_opacity INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS watermark_width INTEGER DEFAULT 30;
  `))
  .then(() => { console.log('Migration OK: image fields added'); client.end(); })
  .catch(e => { console.error('Migration failed:', e.message); client.end(); process.exit(1); });
