# inkwell-demo-cfn
CFN for the inkwell-demo GQL API and related resources

## Architecture

This project uses a modular nested CloudFormation stack structure:

- **infrastructure/** - VPC, subnets, NAT Gateway, security groups, Aurora database
- **auth/** - Cognito User Pool for authentication
- **application/** - Lambda function and API Gateway
- **pipeline/** - CI/CD pipeline (CodePipeline + CodeBuild)

The main `template.yaml` orchestrates these nested stacks with proper dependency management.

### Lambda Function

The Lambda function (`lambda/`) is a TypeScript-based GraphQL API server using Apollo Server 5. It connects to Aurora PostgreSQL via VPC networking, verifies JWT tokens from Cognito, and provides a GraphQL endpoint for querying country data. The function includes automatic database seeding with PostGIS sample data on cold starts.

## Deployment

### Initial Bootstrap

The CI/CD pipeline is self-referential (it deploys itself), so it needs to be bootstrapped manually once:

1. **Create the S3 artifact bucket** (if not exists):
   ```bash
   aws s3 mb s3://iw-demo-cfn-artifacts-us-east-1
   ```

2. **Create Aurora credentials secret** (if not exists):
   ```bash
   aws secretsmanager create-secret \
     --name AuroraSecret \
     --secret-string '{"username":"dbadmin","password":"YourSecurePassword123!"}'
   ```

3. **Deploy the pipeline stack manually**:
   ```bash
   aws cloudformation create-stack \
     --stack-name iw-demo-cfn-pipeline \
     --template-body file://pipeline/cicd.yaml \
     --parameters \
       ParameterKey=PipelineBucketName,ParameterValue=iw-demo-cfn-artifacts-us-east-1 \
       ParameterKey=GitHubConnectionArn,ParameterValue=arn:aws:codeconnections:us-east-1:920671455518:connection/3d4db5bf-d87c-47bb-83d8-3faf92ba204e \
       ParameterKey=GitHubRepository,ParameterValue=lillysparks/iw-demo-cfn \
       ParameterKey=GitHubBranch,ParameterValue=main \
       ParameterKey=MainStackName,ParameterValue=iw-demo-cfn \
       ParameterKey=AuroraSecretArn,ParameterValue=<secret-arn> \
     --capabilities CAPABILITY_IAM
   ```

4. **Push to main branch** - The pipeline will automatically build and deploy the main stack

### Continuous Deployment

After bootstrap, every push to the `main` branch triggers:
1. **Source** - CodePipeline pulls latest code from GitHub
2. **Build** - CodeBuild compiles Lambda, uploads nested templates to S3
3. **Deploy** - CloudFormation updates the main stack and all nested stacks

## Development

### Local Testing

```bash
cd lambda
npm ci
npm run build
npm test
```

### GraphQL Endpoint

After deployment, the API is available at:
```
https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/graphql
```

Health check:
```bash
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/health
```

Query example:
```bash
curl -X POST https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ countries { id name } }"}'
```

## Database Seeding

The Lambda function automatically seeds the Aurora database with PostGIS country data on first invocation (cold start). The seed file is downloaded during the build process from the [PostGIS sample dataset](https://github.com/adityatoshniwal/postgis-sample-dataset).
