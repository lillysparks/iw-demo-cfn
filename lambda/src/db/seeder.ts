import { getClient } from './connection';
import * as fs from 'fs';
import * as path from 'path';

let isSeeded = false;

/**
 * Convert PostgreSQL COPY ... FROM stdin format to INSERT statements
 */
function convertCopyToInsert(sql: string): string {
  const lines = sql.split('\n');
  const result: string[] = [];
  let inCopyBlock = false;
  let tableName = '';
  let columns = '';
  
  for (const line of lines) {
    const copyMatch = line.match(/^COPY\s+(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin;/i);
    
    if (copyMatch) {
      // Start of COPY block
      inCopyBlock = true;
      tableName = copyMatch[1];
      columns = copyMatch[2];
      console.log(`Converting COPY for table: ${tableName}`);
      continue;
    }
    
    if (line === '\\.' || line.trim() === '\\.') {
      // End of COPY block
      inCopyBlock = false;
      tableName = '';
      columns = '';
      continue;
    }
    
    if (inCopyBlock && line.trim()) {
      // Convert data line to INSERT
      const values = line.split('\t').map(v => {
        if (!v || v === '\\N') return 'NULL';
        // Escape single quotes and wrap in quotes
        return `'${v.replace(/'/g, "''")}'`;
      }).join(', ');
      
      result.push(`INSERT INTO ${tableName} (${columns}) VALUES (${values});`);
    } else if (!inCopyBlock) {
      // Keep non-COPY statements as-is
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Seed the database on first Lambda invocation.
 * Checks if countries table exists; if not, loads seed data.
 */
export async function seedDatabaseIfNeeded(): Promise<void> {
  console.log('seedDatabaseIfNeeded: starting, isSeeded =', isSeeded);
  console.log('Environment vars:', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
    hasPassword: !!process.env.DB_PASSWORD,
  });

  if (isSeeded) {
    console.log('Database already seeded in this Lambda execution.');
    return;
  }

  let client;
  try {
    console.log('Attempting to get DB client...');
    client = await getClient();
    console.log('DB client acquired successfully');
    
    // Simple connection test
    console.log('Testing connection with SELECT 1...');
    await client.query('SELECT 1');
    console.log('Connection test successful');
    
    // Check if countries table exists
    const result = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'countries'
      )`
    );

    const tableExists = result.rows[0].exists;

    if (!tableExists) {
      console.log('Countries table not found, seeding database...');
      
      // Enable PostGIS extension first
      console.log('Enabling PostGIS extension...');
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
      console.log('PostGIS extension enabled');
      
      // Path to seed file bundled in Lambda
      const seedFile = path.join(process.cwd(), 'seed-data', 'countries.sql');

      if (fs.existsSync(seedFile)) {
        let sql = fs.readFileSync(seedFile, 'utf-8');
        
        // Convert COPY ... FROM stdin format to INSERT statements
        console.log('Parsing and converting COPY statements to INSERTs...');
        sql = convertCopyToInsert(sql);
        
        // Execute the converted SQL
        await client.query(sql);
        console.log('Successfully seeded countries table.');
      } else {
        console.warn(`Seed file not found at ${seedFile}. Skipping seeding.`);
      }
    } else {
      console.log('Countries table already exists, skipping seed.');
    }

    isSeeded = true;
  } catch (error) {
    console.error('Error during database seeding:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      errno: (error as any)?.errno,
    });
    // Mark as seeded to avoid retry loop, but log the failure
    isSeeded = true;
    console.warn('Seeding failed but marked as complete to prevent retry loop');
  } finally {
    if (client) {
      client.release();
    }
  }
}
