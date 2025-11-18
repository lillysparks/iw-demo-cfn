import { executeSql } from '../db/sqlLoader';
import { Country } from '../types';
import { getPool } from '../db/connection';
import * as net from 'net';

export const countriesResolvers = {
  Query: {
    /**
     * Fetch all countries from the database.
     * Expects a 'countries' table with at least 'id' and 'name' columns.
     */
    countries: async (_parent: any, _args: any, _context: any): Promise<Country[]> => {
      try {
        const result = await executeSql(
          'SELECT id, name FROM countries ORDER BY name ASC LIMIT 100'
        );
        return result.rows as Country[];
      } catch (error) {
        console.error('Error fetching countries:', error);
        return [];
      }
    },
  },

  Mutation: {
    /**
     * Test TCP connectivity to Aurora
     */
    testDbConnection: async (_parent: any, _args: any, _context: any): Promise<{ success: boolean; message: string }> => {
      const host = process.env.DB_HOST || '';
      const port = Number(process.env.DB_PORT) || 5432;
      
      return new Promise((resolve) => {
        console.log(`Testing TCP connection to ${host}:${port}...`);
        const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
          console.log('TCP connection successful!');
          socket.end();
          resolve({ success: true, message: `TCP connection to ${host}:${port} successful` });
        });
        
        socket.on('timeout', () => {
          console.log('TCP connection timed out');
          socket.destroy();
          resolve({ success: false, message: `TCP connection timed out after 5s` });
        });
        
        socket.on('error', (err) => {
          console.error('TCP connection error:', err);
          resolve({ success: false, message: `TCP error: ${err.message}` });
        });
      });
    },

    /**
     * Test mutation: create the countries table manually
     */
    initCountriesTable: async (_parent: any, _args: any, _context: any): Promise<{ success: boolean; message: string }> => {
      try {
        await executeSql(`
          CREATE TABLE IF NOT EXISTS countries (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL
          )
        `);
        
        // Insert a few test countries
        await executeSql(`
          INSERT INTO countries (name) VALUES 
            ('United States'),
            ('Canada'),
            ('Mexico')
          ON CONFLICT DO NOTHING
        `);
        
        return { success: true, message: 'Countries table initialized with test data' };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Error initializing countries table:', error);
        return { success: false, message: `Failed: ${errorMsg}` };
      }
    },
  },
};
