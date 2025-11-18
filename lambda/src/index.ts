import { ApolloServer } from "@apollo/server";
import { startServerAndCreateLambdaHandler, handlers } from "@as-integrations/aws-lambda";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { mergeResolvers } from "./resolvers";
import { seedDatabaseIfNeeded } from "./db/seeder";


const client = jwksClient({
  jwksUri: `${process.env.COGNITO_ISSUER}/.well-known/jwks.json`,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

async function verifyToken(authHeader?: string) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  return new Promise((resolve) =>
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        audience: process.env.COGNITO_CLIENT_ID,
        issuer: process.env.COGNITO_ISSUER,
      },
      (err, decoded) => resolve(err ? null : decoded)
    )
  );
}

const typeDefs = `
  type Query {
    hello: String
    countries: [Country!]!
  }

  type Country {
    id: Int
    name: String!
  }
`;

const resolvers = mergeResolvers();

const server = new ApolloServer({ typeDefs, resolvers });

// Health check handler (no DB/Cognito required)
export const healthHandler = async (
  event: APIGatewayProxyEventV2
): Promise<{
  statusCode: number;
  body: string;
}> => {
  console.log("Health check invoked via path:", event.rawPath);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "OK",
      timestamp: new Date().toISOString(),
      path: event.rawPath,
    }),
  };
};

// GraphQL handler
const apiGatewayHandler = handlers.createAPIGatewayProxyEventV2RequestHandler();

const apolloHandler = startServerAndCreateLambdaHandler(
  server,
  {
    ...apiGatewayHandler,
    toErrorResult: (error: unknown) => {
      console.error('GraphQL error (toErrorResult):', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      };
    },
  },
  {
    context: async ({ event }: { event: APIGatewayProxyEventV2 }) => {
      const user = await verifyToken(event.headers?.authorization);
      return { user };
    },
  }
);

// Dispatch wrapper: route GET /health to healthHandler, everything else to Apollo
export const graphqlHandler = async (event: any, context: any, callback?: any) => {
  // Seed database on first Lambda invocation (cold start)
  await seedDatabaseIfNeeded();

  const method = event?.requestContext?.http?.method || event?.httpMethod || '';
  const path = event?.rawPath || event?.requestContext?.http?.path || event?.path || '';

  if (method === 'GET' && path.endsWith('/health')) {
    return healthHandler(event);
  }

  return apolloHandler(event, context, callback);
};


