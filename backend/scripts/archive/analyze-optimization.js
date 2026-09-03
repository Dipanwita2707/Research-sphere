/**
 * Database Optimization Analysis Script
 * 
 * Analyzes database queries, indexes, and performance bottlenecks
 * for the loan letter system and related modules.
 * 
 * Usage: node scripts/analyze-optimization.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const analysisResults = {
  indexes: [],
  slowQueries: [],
  recommendations: [],
  tableStats: [],
};

// ============================================================================
// Index Analysis
// ============================================================================

async function analyzeIndexes() {
  console.log('\n========================================');
  console.log('Index Analysis');
  console.log('========================================\n');
  
  const tables = [
    'loan_letter',
    'fee_structure',
    'fee_head',
    'program',
    'department',
    'school',
    'audit_log',
    'user_login',
  ];
  
  for (const table of tables) {
    try {
      const indexes = await prisma.$queryRawUnsafe(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = '${table}'
        ORDER BY indexname;
      `);
      
      console.log(`\nTable: ${table}`);
      console.log(`Indexes: ${indexes.length}`);
      
      indexes.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
        analysisResults.indexes.push({
          table,
          name: idx.indexname,
          definition: idx.indexdef,
        });
      });
      
      // Check for missing recommended indexes
      const recommendations = checkMissingIndexes(table, indexes);
      if (recommendations.length > 0) {
        console.log(`  ⚠ Recommended indexes:`);
        recommendations.forEach(rec => {
          console.log(`    ${rec}`);
          analysisResults.recommendations.push({ table, recommendation: rec });
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${table}:`, error.message);
    }
  }
}

function checkMissingIndexes(table, existingIndexes) {
  const recommendations = [];
  const indexNames = existingIndexes.map(idx => idx.indexname.toLowerCase());
  
  const requiredIndexes = {
    loan_letter: [
      { name: 'application_number', columns: ['LOWER(application_number)'], type: 'UNIQUE' },
      { name: 'program_id', columns: ['program_id'] },
      { name: 'printed_by_id', columns: ['printed_by_id'] },
      { name: 'issued_at', columns: ['issued_at DESC'] },
    ],
    fee_structure: [
      { name: 'program_id', columns: ['program_id'] },
      { name: 'type_active', columns: ['type', 'is_active'] },
      { name: 'batch_year', columns: ['batch_year DESC'] },
    ],
    program: [
      { name: 'department_id', columns: ['department_id'] },
      { name: 'program_code', columns: ['program_code'] },
    ],
    audit_log: [
      { name: 'target', columns: ['target_table', 'target_id'] },
      { name: 'created_at', columns: ['created_at DESC'] },
      { name: 'actor_id', columns: ['actor_id'] },
    ],
  };
  
  const required = requiredIndexes[table] || [];
  
  required.forEach(req => {
    const pattern = req.name.toLowerCase();
    const exists = indexNames.some(name => name.includes(pattern));
    
    if (!exists) {
      const indexType = req.type || 'INDEX';
      const sql = `CREATE ${indexType} idx_${table}_${req.name} ON ${table}(${req.columns.join(', ')});`;
      recommendations.push(sql);
    }
  });
  
  return recommendations;
}

// ============================================================================
// Table Statistics
// ============================================================================

async function analyzeTableStats() {
  console.log('\n========================================');
  console.log('Table Statistics');
  console.log('========================================\n');
  
  const tables = [
    'loan_letter',
    'fee_structure',
    'fee_head',
    'program',
    'department',
    'audit_log',
  ];
  
  for (const table of tables) {
    try {
      const stats = await prisma.$queryRawUnsafe(`
        SELECT
          schemaname,
          relname AS table_name,
          n_tup_ins AS inserts,
          n_tup_upd AS updates,
          n_tup_del AS deletes,
          n_live_tup AS live_rows,
          n_dead_tup AS dead_rows,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE relname = '${table}';
      `);
      
      if (stats.length > 0) {
        const stat = stats[0];
        console.log(`\nTable: ${table}`);
        console.log(`  Live rows: ${stat.live_rows}`);
        console.log(`  Dead rows: ${stat.dead_rows}`);
        console.log(`  Inserts: ${stat.inserts}`);
        console.log(`  Updates: ${stat.updates}`);
        console.log(`  Deletes: ${stat.deletes}`);
        console.log(`  Last analyze: ${stat.last_autoanalyze || stat.last_analyze || 'Never'}`);
        
        analysisResults.tableStats.push({
          table,
          liveRows: parseInt(stat.live_rows),
          deadRows: parseInt(stat.dead_rows),
          inserts: parseInt(stat.inserts),
          updates: parseInt(stat.updates),
          deletes: parseInt(stat.deletes),
        });
        
        // Check for bloat
        const deadRatio = stat.dead_rows / (stat.live_rows || 1);
        if (deadRatio > 0.2) {
          const recommendation = `Table ${table} has ${Math.round(deadRatio * 100)}% dead rows. Consider running VACUUM ANALYZE.`;
          console.log(`  ⚠ ${recommendation}`);
          analysisResults.recommendations.push({ table, recommendation });
        }
      }
    } catch (error) {
      console.error(`Error analyzing ${table}:`, error.message);
    }
  }
}

// ============================================================================
// Query Performance Analysis
// ============================================================================

async function analyzeQueryPerformance() {
  console.log('\n========================================');
  console.log('Query Performance Analysis');
  console.log('========================================\n');
  
  try {
    // Get slow queries from pg_stat_statements (if available)
    const slowQueries = await prisma.$queryRawUnsafe(`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time
      FROM pg_stat_statements
      WHERE query LIKE '%loan_letter%'
         OR query LIKE '%fee_structure%'
         OR query LIKE '%program%'
      ORDER BY mean_exec_time DESC
      LIMIT 10;
    `);
    
    console.log('Top 10 Slowest Queries:\n');
    slowQueries.forEach((q, i) => {
      console.log(`${i + 1}. Mean time: ${Math.round(q.mean_exec_time)}ms, Calls: ${q.calls}`);
      console.log(`   ${q.query.substring(0, 100)}...`);
      console.log('');
      
      analysisResults.slowQueries.push({
        query: q.query,
        calls: parseInt(q.calls),
        meanTime: parseFloat(q.mean_exec_time),
        maxTime: parseFloat(q.max_exec_time),
      });
    });
  } catch (error) {
    console.log('pg_stat_statements extension not available or not enabled');
    console.log('To enable: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
  }
}

// ============================================================================
// Specific Query Analysis
// ============================================================================

async function analyzeSpecificQueries() {
  console.log('\n========================================');
  console.log('Specific Query Analysis');
  console.log('========================================\n');
  
  // Test loan letter list query
  console.log('1. Loan Letter List Query (with own-only filter)');
  try {
    const explain = await prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      SELECT ll.id
      FROM "loan_letter" ll
      WHERE ll.printed_by_id = '00000000-0000-0000-0000-000000000000'::uuid
      ORDER BY ll.issued_at DESC
      LIMIT 50;
    `);
    
    console.log('Execution plan:');
    explain.forEach(row => console.log(`  ${row['QUERY PLAN']}`));
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test fee structure lookup
  console.log('\n2. Fee Structure Lookup Query');
  try {
    const explain = await prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      SELECT *
      FROM "fee_structure"
      WHERE type = 'ACADEMIC'
        AND is_active = true
        AND program_id IS NOT NULL
      ORDER BY batch_year DESC
      LIMIT 1;
    `);
    
    console.log('Execution plan:');
    explain.forEach(row => console.log(`  ${row['QUERY PLAN']}`));
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  
  // Test audit log query
  console.log('\n3. Audit Log Query');
  try {
    const explain = await prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      SELECT *
      FROM "audit_log"
      WHERE target_table = 'loan_letter'
        AND action = 'Loan letter reprinted'
      ORDER BY created_at DESC
      LIMIT 100;
    `);
    
    console.log('Execution plan:');
    explain.forEach(row => console.log(`  ${row['QUERY PLAN']}`));
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
}

// ============================================================================
// Connection Pool Analysis
// ============================================================================

async function analyzeConnectionPool() {
  console.log('\n========================================');
  console.log('Connection Pool Analysis');
  console.log('========================================\n');
  
  try {
    const connections = await prisma.$queryRawUnsafe(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE state = 'active') AS active,
        count(*) FILTER (WHERE state = 'idle') AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database();
    `);
    
    if (connections.length > 0) {
      const conn = connections[0];
      console.log(`Total connections: ${conn.total}`);
      console.log(`Active: ${conn.active}`);
      console.log(`Idle: ${conn.idle}`);
      console.log(`Idle in transaction: ${conn.idle_in_transaction}`);
      
      if (parseInt(conn.idle_in_transaction) > 0) {
        const recommendation = `${conn.idle_in_transaction} connections are idle in transaction. Check for long-running transactions.`;
        console.log(`⚠ ${recommendation}`);
        analysisResults.recommendations.push({ table: 'connections', recommendation });
      }
    }
  } catch (error) {
    console.error('Error analyzing connections:', error.message);
  }
}

// ============================================================================
// Cache Analysis
// ============================================================================

async function analyzeCacheEfficiency() {
  console.log('\n========================================');
  console.log('Cache Efficiency Analysis');
  console.log('========================================\n');
  
  try {
    const cacheStats = await prisma.$queryRawUnsafe(`
      SELECT
        sum(heap_blks_read) AS heap_read,
        sum(heap_blks_hit) AS heap_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
      FROM pg_statio_user_tables;
    `);
    
    if (cacheStats.length > 0) {
      const stats = cacheStats[0];
      const hitRatio = parseFloat(stats.cache_hit_ratio) * 100;
      console.log(`Cache hit ratio: ${hitRatio.toFixed(2)}%`);
      console.log(`Heap blocks read: ${stats.heap_read}`);
      console.log(`Heap blocks hit: ${stats.heap_hit}`);
      
      if (hitRatio < 90) {
        const recommendation = `Cache hit ratio is ${hitRatio.toFixed(2)}%. Consider increasing shared_buffers.`;
        console.log(`⚠ ${recommendation}`);
        analysisResults.recommendations.push({ table: 'cache', recommendation });
      } else {
        console.log('✓ Cache hit ratio is healthy');
      }
    }
  } catch (error) {
    console.error('Error analyzing cache:', error.message);
  }
}

// ============================================================================
// Generate Optimization Report
// ============================================================================

function generateReport() {
  console.log('\n========================================');
  console.log('Optimization Recommendations');
  console.log('========================================\n');
  
  if (analysisResults.recommendations.length === 0) {
    console.log('✓ No critical optimization issues found');
    return;
  }
  
  console.log(`Found ${analysisResults.recommendations.length} recommendations:\n`);
  
  analysisResults.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. [${rec.table}] ${rec.recommendation}`);
  });
  
  // Save report to file
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../optimization-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(analysisResults, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// ============================================================================
// Main Analysis Runner
// ============================================================================

async function runAnalysis() {
  console.log('\n========================================');
  console.log('Database Optimization Analysis');
  console.log('========================================');
  
  try {
    await analyzeIndexes();
    await analyzeTableStats();
    await analyzeQueryPerformance();
    await analyzeSpecificQueries();
    await analyzeConnectionPool();
    await analyzeCacheEfficiency();
    generateReport();
  } catch (error) {
    console.error('Fatal error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run analysis
if (require.main === module) {
  runAnalysis().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runAnalysis };
