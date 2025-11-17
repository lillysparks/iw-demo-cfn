/**
 * GraphQL types for the API
 */

export interface Country {
  id?: number;
  name: string;
  geometry?: any; // PostGIS geometry (e.g., ST_AsGeoJSON result)
}

export interface QueryResolvers {
  hello: (parent: any, args: any, context: any) => string;
  countries: (parent: any, args: any, context: any) => Promise<Country[]>;
}
