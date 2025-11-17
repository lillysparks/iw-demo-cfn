import { executeSql } from '../db/sqlLoader';
import { Country } from '../types';

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
