import { ApolloServer } from "@apollo/server";
import { startServerAndCreateLambdaHandler, handlers } from "@as-integrations/aws-lambda";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { Pool } from "pg";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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

const typeDefs = `type Query { hello: String }`;
const resolvers = {
  Query: {
    hello: (_: any, __: any, ctx: any) =>
      `Hello ${ctx.user?.email || "guest"} from Aurora + Cognito!`,
  },
};

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
// Create a request handler for API Gateway v2 events and attach a custom error formatter.
const apiGatewayHandler = handlers.createAPIGatewayProxyEventV2RequestHandler();
const requestHandler = {
  fromEvent: apiGatewayHandler.fromEvent,
  toSuccessResult: apiGatewayHandler.toSuccessResult,
  toErrorResult: (error: unknown) => {
    console.error('GraphQL error (toErrorResult):', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  },
};

export const graphqlHandler = startServerAndCreateLambdaHandler(
  server,
  requestHandler,
  {
    context: async ({ event }: { event: APIGatewayProxyEventV2 }) => {
      const user = await verifyToken(event.headers?.authorization);
      return { user };
    },
  }
);


