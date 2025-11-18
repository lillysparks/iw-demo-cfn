# Lambda Tests

This directory contains unit tests for the GraphQL Lambda function.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
  unit/
    resolvers.test.ts    # Unit tests for GraphQL resolvers
```

## Test Coverage

### Countries Resolver (`countries` query)
- ✅ Returns list of countries from database
- ✅ Handles database errors gracefully

### Nearest Countries Resolver (`nearestCountries` query)
- ✅ Returns 5 nearest countries with distances in kilometers
- ✅ Handles country not found (returns empty array)
- ✅ Case-insensitive country name matching
- ✅ Handles database/PostGIS errors gracefully
- ✅ Parses distance as float (not string)
- ✅ Excludes source country from results
- ✅ Limits results to exactly 5 countries

## Testing Approach

**Unit Tests**: Use Jest mocks to isolate resolver logic from database layer. The `executeSql` function from `sqlLoader` is mocked to return controlled test data, allowing us to test:
- Happy path scenarios
- Error handling
- Edge cases (empty results, missing data)
- Data type transformations
- SQL query structure validation

This approach ensures fast, reliable tests that don't require a real database connection.

## Adding New Tests

1. Create a new test file in `tests/unit/`
2. Mock dependencies using `jest.mock()`
3. Follow the existing test patterns for consistency
4. Run `npm test` to verify

## CI/CD Integration

Tests can be integrated into the CodeBuild pipeline by adding to `buildspec.yml`:

```yaml
pre_build:
  commands:
    - cd lambda
    - npm ci
    - npm test  # Run tests before build
```
