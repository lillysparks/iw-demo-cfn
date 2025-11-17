import { getClient } from './connection';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load and execute a SQL file against the database.
 * Useful for populating tables from seed/sample data files.
 */
export async function loadSqlFile(filePath: string): Promise<void> {
  const client = await getClient();
  try {
    // Resolve file path (support relative paths from project root)
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    console.log(`Loading SQL file: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`SQL file not found: ${resolvedPath}`);
    }

    const sql = fs.readFileSync(resolvedPath, 'utf-8');
    await client.query(sql);

    console.log(`Successfully loaded SQL file: ${resolvedPath}`);
  } finally {
    client.release();
  }
}

/**
 * Execute a SQL string directly.
 */
export async function executeSql(sql: string): Promise<any> {
  const client = await getClient();
  try {
    const result = await client.query(sql);
    return result;
  } finally {
    client.release();
  }
}
