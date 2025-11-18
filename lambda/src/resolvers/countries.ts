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
};
