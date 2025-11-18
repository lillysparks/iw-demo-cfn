import { getClient } from './connection';
import * as fs from 'fs';
import * as path from 'path';

let isSeeded = false;

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
        const sql = fs.readFileSync(seedFile, 'utf-8');
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
