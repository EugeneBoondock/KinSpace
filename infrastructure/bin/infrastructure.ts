#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import {
  AuthStack,
  DataStack,
  ApiStack,
  MonitoringStack,
} from '../lib/infrastructure-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') || process.env.DEPLOY_STAGE || 'dev';
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const dataStack = new DataStack(app, `KinSpace-${stage}-DataStack`, {
  stage,
  env,
});

const authStack = new AuthStack(app, `KinSpace-${stage}-AuthStack`, {
  stage,
  env,
});

const apiStack = new ApiStack(app, `KinSpace-${stage}-ApiStack`, {
  stage,
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  dataResources: {
    profilesTable: dataStack.profilesTable,
    communityPostsTable: dataStack.communityPostsTable,
    groupActivitiesTable: dataStack.groupActivitiesTable,
    chatMessagesTable: dataStack.chatMessagesTable,
    gamesTable: dataStack.gamesTable,
  },
  userUploadsBucket: dataStack.userUploadsBucket,
  auroraCluster: dataStack.auroraCluster,
  auroraSecret: dataStack.auroraSecret,
});

new MonitoringStack(app, `KinSpace-${stage}-MonitoringStack`, {
  stage,
  env,
  api: apiStack.api,
  functions: apiStack.lambdaFunctions,
});