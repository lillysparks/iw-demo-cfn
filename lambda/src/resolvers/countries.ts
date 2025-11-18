import { executeSql } from '../db/sqlLoader';
import { Country, CountryWithDistance } from '../types';

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

    /**
     * Find the 5 nearest countries to a given country using PostGIS.
     * Uses ST_Distance with geography type for accurate spherical distance calculation.
     */
    nearestCountries: async (
      _parent: any,
      { countryName }: { countryName: string },
      _context: any
    ): Promise<CountryWithDistance[]> => {
      try {
        const query = `
          WITH source AS (
            SELECT ST_Centroid(geom) as center
            FROM countries
            WHERE name ILIKE $1
            LIMIT 1
          )
          SELECT 
            c.id,
            c.name,
            ST_Distance(
              source.center::geography,
              ST_Centroid(c.geom)::geography
            ) / 1000 AS distance
          FROM countries c, source
          WHERE c.name NOT ILIKE $1
          ORDER BY ST_Distance(source.center, ST_Centroid(c.geom))
          LIMIT 5
        `;
        
        const result = await executeSql(query, [countryName]);
        
        if (result.rows.length === 0) {
          console.warn(`No countries found near: ${countryName}`);
          return [];
        }
        
        return result.rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          distance: parseFloat(row.distance)
        }));
      } catch (error) {
        console.error('Error fetching nearest countries:', error);
        return [];
      }
    },
  },
};
