/**
 * GraphQL types for the API
 */

export interface Country {
  id?: number;
  name: string;
  geometry?: any; // PostGIS geometry (e.g., ST_AsGeoJSON result)
}

export interface CountryWithDistance {
  id?: number;
  name: string;
  distance: number; // distance in kilometers
}

export interface QueryResolvers {
  hello: (parent: any, args: any, context: any) => string;
  countries: (parent: any, args: any, context: any) => Promise<Country[]>;
  nearestCountries: (parent: any, args: { countryName: string }, context: any) => Promise<CountryWithDistance[]>;
}
