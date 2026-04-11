import path from 'path';

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export interface BaseStackProps extends cdk.StackProps {
  readonly stage: string;
}

export interface AuthStackProps extends BaseStackProps {
  readonly domainPrefix?: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'KinSpaceUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: true, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('KinSpaceWebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      disableOAuth: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/api/auth/callback/cognito'],
        logoutUrls: ['http://localhost:3000/'],
      },
    });

    const domainPrefix = props.domainPrefix ?? this.node.tryGetContext('cognitoDomainPrefix');
    if (domainPrefix) {
      this.userPool.addDomain('KinSpaceDomain', {
        cognitoDomain: { domainPrefix },
      });
    }

    new ssm.StringParameter(this, 'UserPoolIdParam', {
      parameterName: `/kinspace/${props.stage}/cognito/userPoolId`,
      stringValue: this.userPool.userPoolId,
    });

    new ssm.StringParameter(this, 'UserPoolClientIdParam', {
      parameterName: `/kinspace/${props.stage}/cognito/userPoolClientId`,
      stringValue: this.userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `KinSpace-${props.stage}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `KinSpace-${props.stage}-UserPoolClientId`,
    });
  }
}

export interface DataStackProps extends BaseStackProps {}

export class DataStack extends cdk.Stack {
  public readonly profilesTable: dynamodb.Table;
  public readonly communityPostsTable: dynamodb.Table;
  public readonly groupActivitiesTable: dynamodb.Table;
  public readonly chatMessagesTable: dynamodb.Table;
  public readonly gamesTable: dynamodb.Table;
  public readonly angelsTable: dynamodb.Table;
  public readonly mentorsTable: dynamodb.Table;
  public readonly userUploadsBucket: s3.Bucket;
  public readonly vpc: ec2.Vpc;
  public readonly auroraCluster: rds.ServerlessCluster;
  public readonly auroraSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const createTable = (
      idSuffix: string,
      partitionKey: dynamodb.Attribute,
      options?: Partial<dynamodb.TableProps>,
    ) =>
      new dynamodb.Table(this, `KinSpace${idSuffix}Table`, {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecovery: true,
        partitionKey,
        ...options,
      });

    this.profilesTable = createTable('Profiles', { name: 'id', type: dynamodb.AttributeType.STRING });
    this.communityPostsTable = createTable('CommunityPosts', { name: 'id', type: dynamodb.AttributeType.STRING }, {
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
    this.groupActivitiesTable = createTable('GroupActivities', { name: 'id', type: dynamodb.AttributeType.STRING }, {
      sortKey: { name: 'scheduledAt', type: dynamodb.AttributeType.STRING },
    });
    this.chatMessagesTable = createTable('ChatMessages', { name: 'roomId', type: dynamodb.AttributeType.STRING }, {
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
    });
    this.gamesTable = createTable('Games', { name: 'id', type: dynamodb.AttributeType.STRING });
    this.angelsTable = createTable('Angels', { name: 'id', type: dynamodb.AttributeType.STRING });
    this.mentorsTable = createTable('Mentors', { name: 'id', type: dynamodb.AttributeType.STRING });

    this.userUploadsBucket = new s3.Bucket(this, 'KinSpaceUserContentBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) },
          ],
        },
      ],
    });

    this.vpc = new ec2.Vpc(this, 'KinSpaceVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'KinSpaceDbSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    this.auroraCluster = new rds.ServerlessCluster(this, 'KinSpaceAuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_15_3 }),
      vpc: this.vpc,
      defaultDatabaseName: 'kinspace',
      securityGroups: [dbSecurityGroup],
      enableDataApi: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      credentials: rds.Credentials.fromGeneratedSecret('kinspace_admin'),
      scaling: {
        autoPause: cdk.Duration.minutes(10),
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_2,
      },
    });

    if (!this.auroraCluster.secret) {
      throw new Error('Aurora cluster secret was not generated.');
    }
    this.auroraSecret = this.auroraCluster.secret;

    const tableParams: Array<[string, dynamodb.Table]> = [
      ['profiles', this.profilesTable],
      ['communityPosts', this.communityPostsTable],
      ['groupActivities', this.groupActivitiesTable],
      ['chatMessages', this.chatMessagesTable],
      ['games', this.gamesTable],
      ['angels', this.angelsTable],
      ['mentors', this.mentorsTable],
    ];

    tableParams.forEach(([name, table]) => {
      new ssm.StringParameter(this, `TableNameParam-${name}`, {
        parameterName: `/kinspace/${props.stage}/dynamodb/${name}`,
        stringValue: table.tableName,
      });
    });

    new ssm.StringParameter(this, 'UserBucketParam', {
      parameterName: `/kinspace/${props.stage}/storage/userUploadsBucket`,
      stringValue: this.userUploadsBucket.bucketName,
    });

    new ssm.StringParameter(this, 'AuroraSecretParam', {
      parameterName: `/kinspace/${props.stage}/aurora/secretArn`,
      stringValue: this.auroraSecret.secretArn,
    });

    new ssm.StringParameter(this, 'AuroraClusterArnParam', {
      parameterName: `/kinspace/${props.stage}/aurora/clusterArn`,
      stringValue: this.auroraCluster.clusterArn,
    });

    new cdk.CfnOutput(this, 'UserUploadsBucketName', {
      value: this.userUploadsBucket.bucketName,
      exportName: `KinSpace-${props.stage}-UserUploadsBucket`,
    });

    new cdk.CfnOutput(this, 'AuroraClusterArn', {
      value: this.auroraCluster.clusterArn,
      exportName: `KinSpace-${props.stage}-AuroraClusterArn`,
    });
  }
}

export interface ApiStackProps extends BaseStackProps {
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
  readonly dataResources: {
    profilesTable: dynamodb.ITable;
    communityPostsTable: dynamodb.ITable;
    groupActivitiesTable: dynamodb.ITable;
    chatMessagesTable: dynamodb.ITable;
    gamesTable: dynamodb.ITable;
  };
  readonly userUploadsBucket: s3.IBucket;
  readonly auroraCluster: rds.IServerlessCluster;
  readonly auroraSecret: secretsmanager.ISecret;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const defaultLambdaProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        minify: true,
        externalModules: ['aws-sdk'],
        target: 'node20',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        STAGE: props.stage,
        USER_UPLOADS_BUCKET: props.userUploadsBucket.bucketName,
        AURORA_CLUSTER_ARN: props.auroraCluster.clusterArn,
        AURORA_SECRET_ARN: props.auroraSecret.secretArn,
      },
    };

    const profilesFunction = new lambdaNodejs.NodejsFunction(this, 'ProfilesHandler', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../services/profiles.ts'),
      environment: {
        ...defaultLambdaProps.environment,
        PROFILES_TABLE_NAME: props.dataResources.profilesTable.tableName,
      },
    });

    const communityFunction = new lambdaNodejs.NodejsFunction(this, 'CommunityHandler', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../services/community.ts'),
      environment: {
        ...defaultLambdaProps.environment,
        COMMUNITY_TABLE_NAME: props.dataResources.communityPostsTable.tableName,
        GROUP_ACTIVITIES_TABLE_NAME: props.dataResources.groupActivitiesTable.tableName,
        CHAT_MESSAGES_TABLE_NAME: props.dataResources.chatMessagesTable.tableName,
      },
    });

    const gamesFunction = new lambdaNodejs.NodejsFunction(this, 'GamesHandler', {
      ...defaultLambdaProps,
      entry: path.join(__dirname, '../services/games.ts'),
      environment: {
        ...defaultLambdaProps.environment,
        GAMES_TABLE_NAME: props.dataResources.gamesTable.tableName,
      },
    });

    props.dataResources.profilesTable.grantReadWriteData(profilesFunction);
    props.dataResources.communityPostsTable.grantReadWriteData(communityFunction);
    props.dataResources.groupActivitiesTable.grantReadWriteData(communityFunction);
    props.dataResources.chatMessagesTable.grantReadWriteData(communityFunction);
    props.dataResources.gamesTable.grantReadWriteData(gamesFunction);

    props.userUploadsBucket.grantReadWrite(profilesFunction);
    props.userUploadsBucket.grantReadWrite(communityFunction);

    props.auroraCluster.grantDataApiAccess(profilesFunction);
    props.auroraCluster.grantDataApiAccess(communityFunction);
    props.auroraCluster.grantDataApiAccess(gamesFunction);

    this.api = new apigateway.RestApi(this, 'KinSpaceRestApi', {
      restApiName: `KinSpace-${props.stage}`,
      deployOptions: {
        stageName: props.stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'KinSpaceAuthorizer', {
      cognitoUserPools: [props.userPool],
    });

    const attachLambda = (
      resource: apigateway.IResource,
      fn: lambda.IFunction,
      methods: string[] = ['GET', 'POST'],
    ) => {
      const integration = new apigateway.LambdaIntegration(fn);
      methods.forEach((method) => {
        resource.addMethod(method, integration, {
          authorizer,
          authorizationType: apigateway.AuthorizationType.COGNITO,
        });
      });
    };

    const profilesResource = this.api.root.addResource('profiles');
    attachLambda(profilesResource, profilesFunction, ['GET', 'POST', 'PATCH']);

    const communityResource = this.api.root.addResource('community');
    attachLambda(communityResource, communityFunction, ['GET', 'POST']);

    const gamesResource = this.api.root.addResource('games');
    attachLambda(gamesResource, gamesFunction, ['GET', 'POST']);

    this.lambdaFunctions = [profilesFunction, communityFunction, gamesFunction];

    new ssm.StringParameter(this, 'RestApiUrlParam', {
      parameterName: `/kinspace/${props.stage}/api/url`,
      stringValue: this.api.url,
    });

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.api.url,
      exportName: `KinSpace-${props.stage}-ApiUrl`,
    });
  }
}

export interface MonitoringStackProps extends BaseStackProps {
  readonly api: apigateway.RestApi;
  readonly functions: lambda.Function[];
  readonly budgetEmail?: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'KinSpaceDashboard', {
      dashboardName: `KinSpace-${props.stage}`,
    });

    const apiStage = props.api.deploymentStage.stageName;

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API 5XX Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              ApiName: props.api.restApiName,
              Stage: apiStage,
            },
          }),
        ],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (p95)',
        left: props.functions.map((fn) => fn.metricDuration({ statistic: 'p95' })),
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: props.functions.map((fn) => fn.metricErrors()),
      }),
    );

    const budgetEmail = props.budgetEmail ?? this.node.tryGetContext('budgetEmail') ?? process.env.BUDGET_EMAIL;
    if (budgetEmail) {
      const budgetTopic = new sns.Topic(this, 'BudgetAlertTopic', {
        displayName: 'KinSpace Budget Alerts',
      });
      budgetTopic.addSubscription(new snsSubscriptions.EmailSubscription(budgetEmail));

      new budgets.CfnBudget(this, 'KinSpaceBudget', {
        budget: {
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetName: `KinSpace-${props.stage}-Budget`,
          budgetLimit: {
            amount: 5,
            unit: 'USD',
          },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: 'GREATER_THAN',
              notificationType: 'ACTUAL',
              threshold: 80,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [
              {
                address: budgetEmail,
                subscriptionType: 'EMAIL',
              },
            ],
          },
        ],
      });
    }

    new cdk.CfnOutput(this, 'DashboardName', {
      value: dashboard.dashboardName,
      exportName: `KinSpace-${props.stage}-Dashboard`,
    });
  }
}
