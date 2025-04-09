import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 创建 DynamoDB 表
    const imageTable = new dynamodb.Table(this, "ImageTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

    // Output
    
    new cdk.CfnOutput(this, "bucketName", {
      value: imagesBucket.bucketName,
    });

    // Integration infrastructure - 按照图上架构创建组件
    
    // 1. 中心 SNS Topic
    const newImageTopic = new sns.Topic(this, "NewImageTopic", {
      displayName: "New Image topic",
    });
    
    // 2. 三个 SQS 队列 - 分别用于三个不同的处理流程
    const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });
    
    const logImageQueue = new sqs.Queue(this, "log-image-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });
    
    const mailerQueue = new sqs.Queue(this, "mailer-queue", {
      receiveMessageWaitTime: cdk.Duration.seconds(10),
    });
  
    // 3. Lambda 函数
    const processImageFn = new lambdanode.NodejsFunction(
      this,
      "ProcessImageFn",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/processImage.ts`,
        timeout: cdk.Duration.seconds(15),
        memorySize: 128,
      }
    );
    
    const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      entry: `${__dirname}/../lambdas/mailer.ts`,
    });

    // 创建记录新图像的 Lambda 函数
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/logImage.ts`,
      timeout: cdk.Duration.seconds(15),
      environment: {
        TABLE_NAME: imageTable.tableName,
      },
    });

    // 授予 Lambda 访问 DynamoDB 的权限
    imageTable.grantWriteData(logImageFn);

    // 4. S3 事件配置 - 所有事件通过一个中心 SNS Topic
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SnsDestination(newImageTopic)
    );

    // 5. SNS 订阅配置 - Topic 分发到三个不同的 SQS 队列
    newImageTopic.addSubscription(new subs.SqsSubscription(mailerQueue));
    newImageTopic.addSubscription(new subs.SqsSubscription(imageProcessQueue));
    newImageTopic.addSubscription(new subs.SqsSubscription(logImageQueue));

    // 6. SQS 触发 Lambda
    const logImageEventSource = new events.SqsEventSource(logImageQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const processImageEventSource = new events.SqsEventSource(imageProcessQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    const mailerEventSource = new events.SqsEventSource(mailerQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    });

    logImageFn.addEventSource(logImageEventSource);
    processImageFn.addEventSource(processImageEventSource);
    mailerFn.addEventSource(mailerEventSource);

    // 7. 权限配置
    mailerFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
        ],
        resources: ["*"],
      })
    );

    imagesBucket.grantRead(processImageFn);
    imagesBucket.grantRead(logImageFn);

    // Output
    new cdk.CfnOutput(this, "imagesBucketNameOutput", {
      value: imagesBucket.bucketName,
    });
  }
}
