/**
 * Barrel export for resolvers.
 * Combine all resolvers here for easy import in main server setup.
 */

import { countriesResolvers } from './countries';

export function mergeResolvers() {
  return {
    Query: {
      hello: (_: any, __: any, ctx: any) =>
        `Hello ${ctx.user?.email || "guest"} from Aurora + Cognito!`,
      ...countriesResolvers.Query,
    },
  };
}
