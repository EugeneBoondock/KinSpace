# KinSpace AWS Architecture

## Overview
- **Hosting**: Amplify Hosting delivers the Next.js frontend with edge caching. Build command `npm run build` with SSG/ISR where possible to minimize SSR costs.
- **Authentication**: Cognito User Pool + Domain-hosted UI. App clients for web and future mobile. MFA optional but enabled for admins. User attributes kept minimal; extended profile lives in DynamoDB.
- **Authorization**: API Gateway REST API secured with Cognito authorizer. Fine-grained access enforced in Lambda and DynamoDB IAM policies.

## Core Stacks
- **AuthStack**
  - Cognito User Pool, User Pool Client, optional Identity Pool for future S3 direct uploads.
  - Amplify Hosting app connected via GitHub or manual CLI. Environment variables pulled from SSM.
  - Output values: User Pool ID, App Client ID, Amplify branch URL.
- **DataStack**
  - DynamoDB tables (on-demand pricing, auto scaling disabled to stay within free tier) for `Profiles`, `CommunityPosts`, `GroupActivities`, `RealtimeChat`, `Games`, `Angels`, `Mentors`.
  - S3 bucket `kinspace-user-content` with default encryption, public access block, lifecycle rules (IA after 30 days, Glacier after 90 for cold data).
  - Aurora Serverless v2 PostgreSQL (shared capacity, min ACU 0.5) used for relational reporting; schedule Lambda to pause during off-hours.
  - Outputs: table names, bucket name, DB secret ARN.
- **ApiStack**
  - API Gateway REST API with three main routes groups: `/profiles`, `/community`, `/games`.
  - Lambda functions (Node 20, 512 MB memory, 30s timeout) using AWS SDK v3. Layers shared for utilities.
  - EventBridge bus for async triggers (e.g., analytics). Dead-letter queues using SQS (free tier LQS) for resilience.
- **MonitoringStack**
  - CloudWatch dashboards for API/Lambda/DynamoDB metrics.
  - Alarms for 5XX or throttles with SNS notifications (email).
  - AWS Budgets alarm configured for $5 monthly threshold.

## Security & Compliance
- IAM least privilege per Lambda (table-scoped policies).
- Secrets stored in Secrets Manager (DB credentials) and Parameter Store (API endpoints, environment config).
- CloudFront + Shield Standard automatically applied; WAF optional stage.
- All logs centralized in CloudWatch; retain 30 days.

## Cost Management
- Prefer on-demand DynamoDB to leverage free tier 25 RCUs/WRUs.
- Keep Aurora paused when unused; monitor ACU usage.
- Lambda within free tier (1M invocations, 400k GB-seconds). Keep memory at 512 MB.
- S3 lifecycle to archive old uploads.
- CloudWatch metrics/dashboards in free tier; budgets notify before overruns.

## Migration Strategy
1. Export Supabase tables via SQL/CSV.
2. Transform datasets using a Node script to DynamoDB JSON and RDS insert statements.
3. Deploy `DataStack` first, then run migration Lambda to seed data.
4. Deploy `AuthStack` and `ApiStack`.
5. Update frontend environment with Cognito/App/Gateway outputs; replace Supabase usage with Amplify Auth & API calls.
6. Decommission Supabase after validation.

## Future Enhancements
- Add AppSync GraphQL for richer real-time interactions once budget allows.
- Integrate Amazon SES for transactional emails.
- Consider Step Functions for complex workflows (e.g., crisis escalation).
