import { countriesResolvers } from '../../src/resolvers/countries';
import * as sqlLoader from '../../src/db/sqlLoader';

// Mock the sqlLoader module
jest.mock('../../src/db/sqlLoader');

describe('Countries Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('countries query', () => {
    it('should return list of countries from database', async () => {
      const mockCountries = [
        { id: 1, name: 'United States' },
        { id: 2, name: 'Canada' },
        { id: 3, name: 'Mexico' },
      ];

      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: mockCountries,
      });

      const result = await countriesResolvers.Query.countries(null, {}, {});

      expect(result).toEqual(mockCountries);
      expect(sqlLoader.executeSql).toHaveBeenCalledWith(
        'SELECT id, name FROM countries ORDER BY name ASC LIMIT 100'
      );
    });

    it('should return empty array on database error', async () => {
      (sqlLoader.executeSql as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await countriesResolvers.Query.countries(null, {}, {});

      expect(result).toEqual([]);
    });
  });

  describe('nearestCountries query', () => {
    it('should return 5 nearest countries with distances', async () => {
      const mockResults = [
        { id: 2, name: 'Belgium', distance: '120.5' },
        { id: 3, name: 'Germany', distance: '450.2' },
        { id: 4, name: 'Switzerland', distance: '520.8' },
        { id: 5, name: 'Spain', distance: '1050.3' },
        { id: 6, name: 'Italy', distance: '1100.7' },
      ];

      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: mockResults,
      });

      const result = await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'France' },
        {}
      );

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: 2,
        name: 'Belgium',
        distance: 120.5,
      });
      expect(result[4]).toEqual({
        id: 6,
        name: 'Italy',
        distance: 1100.7,
      });

      // Verify the SQL query was called with country name parameter
      expect(sqlLoader.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('ST_Distance'),
        ['France']
      );
    });

    it('should handle country not found gracefully', async () => {
      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: [],
      });

      const result = await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'Atlantis' },
        {}
      );

      expect(result).toEqual([]);
    });

    it('should be case-insensitive for country names', async () => {
      const mockResults = [
        { id: 2, name: 'Belgium', distance: '120.5' },
      ];

      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: mockResults,
      });

      await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'fRaNcE' },
        {}
      );

      // Verify ILIKE is used in the query (case-insensitive)
      const sqlQuery = (sqlLoader.executeSql as jest.Mock).mock.calls[0][0];
      expect(sqlQuery).toContain('ILIKE');
    });

    it('should return empty array on database error', async () => {
      (sqlLoader.executeSql as jest.Mock).mockRejectedValue(
        new Error('PostGIS function not available')
      );

      const result = await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'France' },
        {}
      );

      expect(result).toEqual([]);
    });

    it('should parse distance as float', async () => {
      const mockResults = [
        { id: 2, name: 'Belgium', distance: '120.567' },
      ];

      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: mockResults,
      });

      const result = await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'France' },
        {}
      );

      expect(typeof result[0].distance).toBe('number');
      expect(result[0].distance).toBe(120.567);
    });

    it('should exclude the source country from results', async () => {
      const mockResults = [
        { id: 2, name: 'Belgium', distance: '120.5' },
        { id: 3, name: 'Germany', distance: '450.2' },
      ];

      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: mockResults,
      });

      const result = await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'France' },
        {}
      );

      // Verify none of the results are 'France'
      expect(result.every(c => c.name !== 'France')).toBe(true);

      // Verify query excludes source country
      const sqlQuery = (sqlLoader.executeSql as jest.Mock).mock.calls[0][0];
      expect(sqlQuery).toContain('NOT ILIKE');
    });

    it('should limit results to 5 countries', async () => {
      const sqlQuery = expect.stringContaining('LIMIT 5');
      
      (sqlLoader.executeSql as jest.Mock).mockResolvedValue({
        rows: [],
      });

      await countriesResolvers.Query.nearestCountries(
        null,
        { countryName: 'France' },
        {}
      );

      expect(sqlLoader.executeSql).toHaveBeenCalledWith(
        sqlQuery,
        expect.any(Array)
      );
    });
  });
});
