# 15-Minute Interview Demo: GraphQL + PostGIS Architecture

**Target Role**: Lead Backend Engineer (GraphQL-focused company)  
**Demo Focus**: Production GraphQL API with geospatial capabilities

---

## Overview
**Duration**: 15 minutes  
**Focus**: GraphQL API Development with Apollo Server  
**Context**: Lead Backend Engineer role at GraphQL-focused company  
**Stack**: [CloudFormation Stack Console](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?stackId=iw-demo-cfn)

## Demo Structure (15 minutes)

- **Opening**: Hook + Context (1 min)
- **Act 0**: Architecture Overview (2 min)
- **Act 1**: GraphQL Schema Design & Type System (4 min)
- **Act 2**: GraphQL Query Optimization & Resolver Patterns (5 min)
- **Act 3**: GraphQL Schema Evolution & Testing (3 min)
- **Act 4**: GraphQL in Production - Live Demo (4 min)
- **Act 5**: GraphQL DevOps & CI/CD (2 min)
- **Closing**: Summary + Q&A (1 min)

**Total**: 15 minutes (with 2-minute buffer for questions)

---

### **Opening (1 min)**

**Hook**: "I built a production-ready GraphQL API that demonstrates real-world complexity: schema design, resolver optimization, type safety, and geospatial queries at scale."

**Setup Context**: 
- "Your stack is Node.js + GraphQL + MongoDB - mine is TypeScript + GraphQL + PostgreSQL/PostGIS"
- "The patterns translate directly: resolver architecture, query optimization, schema evolution, production deployment"

---

## Act 0: Architecture Overview (2 min)

### **Visual Architecture Walkthrough**

**Show the architecture diagram** (from README or `readme-mermaid-iw-demo-cfn.png`):

**Walk through the layers** (30 seconds each):

1. **Client → API Gateway**
   - "HTTP API receives GraphQL requests at a single `/graphql` endpoint"
   - "No REST routing complexity - GraphQL handles all query types in one POST"

2. **API Gateway → Lambda (Apollo Server 5)**
   - "Serverless compute with Apollo Server 5 running TypeScript"
   - "VPC integration for secure database access"
   - "Auto-scaling, pay-per-request model"

3. **Lambda → Aurora PostgreSQL + PostGIS**
   - "Multi-AZ Aurora Serverless v2 for high availability"
   - "PostGIS extension enables geospatial queries (ST_Distance)"
   - "Private subnets, no public internet exposure"

4. **Cross-Cutting Concerns**
   - "Cognito handles JWT authentication in Lambda context"
   - "Secrets Manager stores database credentials securely"
   - "NAT Gateway provides controlled outbound internet for Lambda"

**Key Architectural Decisions**:
- ✅ **Serverless** - No server management, automatic scaling
- ✅ **VPC Isolation** - Database in private subnets, Lambda acts as secure gateway
- ✅ **Infrastructure as Code** - Nested CloudFormation stacks for modularity
- ✅ **CI/CD Automation** - Tests block deployment, atomic stack updates

**Transition**: "Now let's dive into the GraphQL layer - this is where the real value is for your platform."

---

## Act 1: GraphQL Schema Design & Type System (4 min)

### **1. Schema Definition (1.5 min)**

Show `lambda/src/index.ts` - the type definitions:

```graphql
type Query {
  hello: String
  countries: [Country!]!
  nearestCountries(countryName: String!): [CountryWithDistance!]!
}

type Country {
  id: Int
  name: String!
}

type CountryWithDistance {
  id: Int
  name: String!
  distance: Float!
}
```

**Talk Points**:
- ✅ **Non-nullable returns** (`[Country!]!`) - "GraphQL lets you enforce contracts at the type level"
- ✅ **Specialized return types** - `CountryWithDistance` extends the base schema for specific use cases
- ✅ **Required arguments** - `countryName: String!` with type validation

**Connect to Role**: "In your platform, you have 14+ feature modules. This shows how I think about schema boundaries and return type specialization."

---

### Code Walkthrough (2 min)
**File**: `lambda/src/resolvers/countries.ts`  
**Resources**: [Lambda Function](https://console.aws.amazon.com/lambda/home?region=us-east-1#/functions/iw-demo-cfn-GraphQLFunction) | [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fiw-demo-cfn-GraphQLFunction)

Open `lambda/src/types/index.ts`:

```typescript
export interface Country {
  id: number;
  name: string;
}

export interface CountryWithDistance extends Country {
  distance: number;
}
```

**Talk Points**:
- ✅ **End-to-end type safety**: GraphQL schema → TypeScript interfaces → Database results
- ✅ **No runtime type mismatches** - compile-time guarantees
- "This is critical when you have 14 modules - type errors caught before production"

**Show the resolver signature**:
```typescript
nearestCountries: async (
  _parent: any,
  { countryName }: { countryName: string },
  _context: any
): Promise<CountryWithDistance[]>
```

**Connect to Role**: "You mentioned Apollo Server v3+ - this is Apollo Server 5 with full TypeScript support. Same patterns, newer APIs."

---

### **3. Resolver Architecture & Context (1 min)**

Point out the `_context` parameter:
- "I have Cognito JWT verification in the context builder"
- Show `lambda/src/index.ts`:

```typescript
context: async ({ event }: { event: APIGatewayProxyEventV2 }) => {
  const user = await verifyToken(event.headers?.authorization);
  return { user };
}
```

**Talk Points**:
- ✅ **Authentication in context** - available to all resolvers
- ✅ **Middleware pattern** - centralized auth logic
- "This scales to multi-tenant: add `tenantId` to context, filter queries per tenant"

**Connect to Role**: "Your platform has multi-tenant project workflows - this is exactly the pattern you'd use."

---

## Act 2: GraphQL Query Optimization & Resolver Patterns (5 min)

### **1. Repository Pattern for Data Fetching (1.5 min)**

Show `lambda/src/db/sqlLoader.ts`:

```typescript
export async function executeSql(sql: string, params?: any[]): Promise<any> {
  const client = await getClient();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

**Talk Points**:
- ✅ **Data layer abstraction** - resolvers don't touch the database directly
- ✅ **Connection management** - automatic client release
- "In MongoDB, this would be your Mongoose service layer"

**Connect to Role**: "You mentioned repository patterns and service layer architecture - this is that pattern in action."

---

### **2. N+1 Query Problem Prevention (2 min)**

Open `lambda/src/resolvers/countries.ts` - show the `nearestCountries` resolver:

**The Problem**:
```typescript
// BAD: N+1 problem
const sourceCountry = await getCountry(countryName);
const allCountries = await getAllCountries();
for (const country of allCountries) {
  const distance = await calculateDistance(sourceCountry, country); // N queries!
}
```

**The Solution**:

Instead of N+1 queries, we use a CTE (Common Table Expression) to:
1. Calculate distance from reference point to ALL countries in one query
2. Filter and sort in the database ([Aurora PostgreSQL](https://console.aws.amazon.com/rds/home?region=us-east-1#database:id=iw-demo-cfn-database;is-cluster=true) + PostGIS)
3. Return top N results

**Talk Points**:
- ✅ **CTE (Common Table Expression)** - "Like a subquery with a name - cleaner than joins"
- ✅ **Single database round-trip** - prevents N+1
- ✅ **Parameterized queries** - SQL injection prevention
- "In MongoDB, this would be a $lookup aggregation pipeline to avoid multiple `find()` calls"

**Connect to Role**: "You mentioned 'N+1 problem solutions, dataloader patterns' - this shows both understanding and implementation."

---

### **3. DataLoader Pattern (Context) (0.5 min)**

**Talk Point**: "I didn't need DataLoader here because of the CTE, but I'd use it for batching. Example:"

```typescript
// Hypothetical with DataLoader
const countryLoader = new DataLoader(async (ids) => {
  const countries = await executeSql(
    'SELECT * FROM countries WHERE id = ANY($1)',
    [ids]
  );
  return ids.map(id => countries.find(c => c.id === id));
});

// In resolver
const country = await context.countryLoader.load(id);
```

"This batches individual ID lookups into a single query - same pattern in MongoDB."

---

### **4. Performance & Caching Considerations (1 min)**

**Talk Points**:
- "Countries data is relatively static - perfect for Redis caching"
- Show where you'd add it:

```typescript
nearestCountries: async (_parent, { countryName }, context) => {
  const cacheKey = `nearest:${countryName.toLowerCase()}`;
  
  // Check cache first
  const cached = await context.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Execute query
  const result = await executeSql(query, [countryName]);
  
  // Cache for 1 hour
  await context.redis.setex(cacheKey, 3600, JSON.stringify(result));
  
  return result;
}
```

**Connect to Role**: "You mentioned 2-3 years implementing multi-layer caching strategies - this is a practical example of query-level caching with Redis."

---

## Act 3: GraphQL Schema Evolution & Testing (3 min)

### **1. Schema Versioning & Evolution (1 min)**

**Talk Point**: "GraphQL's strength is backward-compatible evolution. Here's how I'd extend this:"

**Current Schema**:
```graphql
type Country {
  id: Int
  name: String!
}
```

**Evolution Example**:
```graphql
type Country {
  id: Int
  name: String!
  capital: String            # Add field - existing queries still work
  population: Int
  borders: [Country!]        # Nested resolver - demonstrate relationships
}
```

**Show how you'd implement the nested resolver**:
```typescript
Country: {
  borders: async (parent: Country, _args, _context) => {
    const result = await executeSql(`
      SELECT c2.id, c2.name
      FROM countries c1
      JOIN country_borders cb ON c1.id = cb.country_id
      JOIN countries c2 ON cb.border_country_id = c2.id
      WHERE c1.id = $1
    `, [parent.id]);
    return result.rows;
  }
}
```

**Connect to Role**: "Your platform needs to evolve - GraphQL lets you add fields without breaking existing clients. No versioning endpoints."

---

### **2. GraphQL Testing Strategy (2 min)**

Open `lambda/tests/unit/resolvers.test.ts`:

**Show Test Structure**:
```typescript
describe('nearestCountries query', () => {
  it('should return 5 nearest countries with distances', async () => {
    const mockResults = [
      { id: 2, name: 'Belgium', distance: '120.5' },
      // ...
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
    expect(result[0].distance).toBe(120.5); // String → Float conversion
  });
});
```

**Talk Points**:
- ✅ **Resolver unit tests** - test business logic without database
- ✅ **Mock data layer** - `executeSql` is mocked
- ✅ **Type transformation testing** - string distance → float
- ✅ **Edge cases covered**:
  - Country not found → empty array
  - Case-insensitive matching (ILIKE)
  - Source country excluded
  - Distance parsing

**Show edge case test**:
```typescript
it('should exclude the source country from results', async () => {
  // Verify query excludes source country
  const sqlQuery = (sqlLoader.executeSql as jest.Mock).mock.calls[0][0];
  expect(sqlQuery).toContain('NOT ILIKE');
});
```

**Connect to Role**: "You mentioned 'experience writing automated tests (Vitest, Jest)' - this is Jest with full resolver coverage."

---

## Act 4: GraphQL in Production - Live Demo (4 min)
**Endpoint**: [API Gateway Stage](https://console.aws.amazon.com/apigateway/main/apis/umurmhmr3h/stages/dev?api=umurmhmr3h&region=us-east-1)

### Live Query Execution (3 min)

Run the introspection query:
```bash
curl -X POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/dev/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ 
      __schema { 
        queryType { 
          name 
          fields { 
            name 
            args { name type { name } }
            type { name }
          } 
        } 
      } 
    }"
  }'
```

**Show Response**:
```json
{
  "data": {
    "__schema": {
      "queryType": {
        "name": "Query",
        "fields": [
          {
            "name": "nearestCountries",
            "args": [{ "name": "countryName", "type": { "name": "String" } }],
            "type": { "name": "[CountryWithDistance!]!" }
          }
        ]
      }
    }
  }
}
```

**Talk Points**:
- ✅ **Self-documenting API** - introspection gives you the full schema
- "This is what GraphiQL/Apollo Studio uses - your frontend devs can explore the API without docs"

---

### **2. Execute Real GraphQL Queries (2 min)**

**Simple Query**:
```bash
curl -X POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ countries { id name } }"}'
```

**Talk through response**:
- "200+ countries from PostGIS dataset"
- "GraphQL returns exactly what you asked for - no over-fetching"

**Complex Query with Arguments**:
```bash
curl -X POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/dev/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ 
      nearestCountries(countryName: \"United States\") { 
        id 
        name 
        distance 
      } 
    }"
  }'
```

**Expected Response**:
```json
{
  "data": {
    "nearestCountries": [
      { "id": 24, "name": "Canada", "distance": 2260.5 },
      { "id": 13, "name": "Bahamas", "distance": 2850.2 },
      { "id": 41, "name": "Cuba", "distance": 3100.7 },
      // ...
    ]
  }
}
```

**Talk Points**:
- ✅ **Calculated field** (`distance`) - not stored in DB, computed via PostGIS
- ✅ **Type coercion** - string → float in resolver
- ✅ **Ordered results** - closest countries first

---

### **3. Error Handling in GraphQL (0.5 min)**

Show what happens with invalid input:
```bash
curl -X POST https://${API_ID}.execute-api.us-east-1.amazonaws.com/dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ nearestCountries(countryName: \"Atlantis\") { id name distance } }"}'
```

**Response**:
```json
{
  "data": {
    "nearestCountries": []
  }
}
```

**Talk Point**: "Graceful degradation - returns empty array, not an error. Client can handle it."

---

### **4. GraphQL + CloudWatch Observability (0.5 min)**

Open CloudWatch logs, show:
- Request received
- Resolver execution
- Database query
- Response time

**Talk Point**: 
- "GraphQL operations are logged with query names"
- "You can track slow resolvers and optimize"
- "In production, I'd add Apollo Server plugins for tracing and metrics"

Example plugin:
```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      requestDidStart() {
        const start = Date.now();
        return {
          willSendResponse({ response }) {
            const duration = Date.now() - start;
            console.log(`GraphQL request took ${duration}ms`);
          }
        };
      }
    }
  ]
});
```

---

## Act 5: GraphQL DevOps & CI/CD (2 min)
**Pipeline**: [CodePipeline Console](https://console.aws.amazon.com/codesuite/codepipeline/pipelines/iw-demo-cfn-Pipeline/view?region=us-east-1)

### **1. GraphQL Schema in CI/CD (1 min)**

Show `buildspec.yml`:
- Tests run before deployment (including GraphQL resolver tests)
- "If resolvers break, deployment fails"

**Talk Point**: "In a larger setup, I'd add schema validation:"

```yaml
pre_build:
  commands:
    - npm ci
    - npm test
    - npm run schema:validate  # Check schema changes for breaking changes
    - npm run build
```

**Example schema validation script**:
```typescript
// scripts/validate-schema.ts
import { printSchema } from 'graphql';
import { typeDefs } from './src/index';

// Compare with previous schema from git
// Detect breaking changes (field removals, type changes)
// Fail if breaking changes detected
```

**Connect to Role**: "You need schema evolution management across 14 modules - this prevents breaking changes."

---

### **2. GraphQL Deployment Strategy (1 min)**

**Infrastructure**: [Nested CloudFormation Stacks](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringText=iw-demo-cfn&filteringStatus=active&viewNested=true)

**Talk Points**:
- "Lambda + API Gateway = serverless GraphQL"
- "Each deployment is atomic - no downtime"
- "In your GCP environment, this would be Cloud Run with similar patterns"

**Show the deployment flow** ([CodeBuild History](https://console.aws.amazon.com/codesuite/codebuild/projects/iw-demo-cfn-BuildProject/history?region=us-east-1)):
1. Code push → CodePipeline trigger
2. Tests run (including GraphQL resolver tests)
3. SAM builds Lambda package
4. CloudFormation deploys
5. Health check validates GraphQL endpoint

**Monitoring GraphQL in Production**:
- CloudWatch for logs
- "I'd add Sentry for GraphQL errors" (mentioned in your JD)
- "Apollo Studio for query performance tracking"

---

## Closing (1 min)

### **Summary: GraphQL Skills Demonstrated**

✅ **Schema Design**
- Type system design with non-nullables and specialized return types
- Schema evolution strategies (backward compatibility)
- Introspection and self-documentation

✅ **Resolver Architecture**
- Repository pattern for data abstraction
- N+1 prevention with CTEs
- DataLoader pattern (discussed)
- Context for authentication and multi-tenancy

✅ **Performance & Optimization**
- Single-query optimization (avoiding N+1)
- Caching strategy discussion (Redis)
- Type transformation and data normalization

✅ **Testing**
- Resolver unit tests with mocked data layer
- Edge case coverage
- Type safety validation

✅ **Production Operations**
- CI/CD with schema validation
- Error handling and graceful degradation
- Logging and observability
- Deployment automation

---

### **Connect to Your Tech Stack**

"You're using:"
- ✅ Node.js + TypeScript → **Same** (just showed it)
- ✅ GraphQL + Apollo Server → **Same** (v5, same patterns as v3+)
- ✅ MongoDB + Mongoose → **PostgreSQL + direct SQL** (patterns translate)
- ✅ Redis caching → **Discussed implementation**
- ✅ Docker + GCP → **Lambda + AWS** (same serverless concepts)

"The GraphQL patterns are identical - resolver architecture, schema design, testing, and optimization transfer directly."

---

### **AI Tool Integration**

"I built this with GitHub Copilot Edits in 3 hours:"
- Architecture scaffolding
- Test generation (the 8 seeder tests took 10 minutes)
- Debugging the PostGIS COPY format issue
- "AI accelerated development but I owned the architecture decisions"

**Key Point**: "For a GraphQL platform company, using AI to iterate faster on schema design and resolver patterns is exactly what you'd want in a Lead Engineer."

---

## Backup Topics (if time permits or questions arise)

### **GraphQL Subscriptions**
"I didn't implement real-time here, but I'd use WebSockets with Apollo subscriptions for live updates:"

```typescript
const typeDefs = `
  type Subscription {
    countryUpdated: Country!
  }
`;

const resolvers = {
  Subscription: {
    countryUpdated: {
      subscribe: () => pubsub.asyncIterator(['COUNTRY_UPDATED'])
    }
  }
};
```

### **GraphQL Federation**
"For 14+ modules, I'd consider Apollo Federation:"
- Each module owns its schema
- Gateway stitches them together
- Avoids monolithic GraphQL layer

### **GraphQL Complexity & Rate Limiting**
```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  validationRules: [createComplexityLimitRule(1000)]
});
```

"Prevents expensive nested queries from overwhelming the database."

---

## Pre-Interview Checklist

- [ ] All code pushed to `main` branch
- [ ] CloudWatch logs accessible
- [ ] Test all curl commands work
- [ ] Files open in VS Code:
  - `lambda/src/index.ts` (schema)
  - `lambda/src/resolvers/countries.ts` (resolvers)
  - `lambda/src/types/index.ts` (TypeScript types)
  - `lambda/tests/unit/resolvers.test.ts` (tests)
  - `buildspec.yml` (CI/CD)
- [ ] Terminal ready with `API_ID` variable set
- [ ] Practice timing: 3-4 min per Act

**Total time budget**: 15 minutes (1+2+4+5+3+4+2 = 21, compressed to fit)

---

## Key Differentiators for This Role

1. **GraphQL-Native Thinking**: Schema-first design, resolver optimization, type safety
2. **Production Experience**: CI/CD, testing, observability, error handling
3. **Scalability Mindset**: N+1 prevention, caching strategies, query optimization
4. **Technical Leadership**: Architecture decisions, pattern selection, team enablement (through tests/docs)
5. **Tool Pragmatism**: AI-assisted development while owning architecture

This positions you as someone who can lead GraphQL API development at scale.
