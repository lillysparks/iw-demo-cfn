import { getPool } from './connection';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load and execute a SQL file against the database.
 * Useful for populating tables from seed/sample data files.
 */
export async function loadSqlFile(filePath: string): Promise<void> {
  const pool = getPool();
  
  // Resolve file path (support relative paths from project root)
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  console.log(`Loading SQL file: ${resolvedPath}`);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`SQL file not found: ${resolvedPath}`);
  }

  const sql = fs.readFileSync(resolvedPath, 'utf-8');
  await pool.query(sql);

  console.log(`Successfully loaded SQL file: ${resolvedPath}`);
}

/**
 * Execute a SQL string directly using the pool.
 */
export async function executeSql(sql: string): Promise<any> {
  console.log('executeSql: getting pool and running query...');
  const pool = getPool();
  try {
    const result = await pool.query(sql);
    console.log('executeSql: query completed successfully');
    return result;
  } catch (error) {
    console.error('executeSql: query failed', error);
    throw error;
  }
}
