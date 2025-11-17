import { getClient } from './connection';
import * as fs from 'fs';
import * as path from 'path';

let isSeeded = false;

/**
 * Seed the database on first Lambda invocation.
 * Checks if countries table exists; if not, loads seed data.
 */
export async function seedDatabaseIfNeeded(): Promise<void> {
  if (isSeeded) {
    console.log('Database already seeded in this Lambda execution.');
    return;
  }

  const client = await getClient();
  try {
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
    // Don't re-throw; let the Lambda continue (seeding is optional for queries)
    isSeeded = true;
  } finally {
    client.release();
  }
}
