# Event-Driven Architecture (EDA) Image Processing System

This project implements an event-driven architecture image processing system based on AWS cloud services, supporting image upload, logging, notification, and metadata management.

## Architecture Design

The system employs a fully decoupled event-driven architecture where components communicate through events, achieving high scalability and maintainability.


### Core Components:

- **S3 Bucket**: Stores image files
- **SNS Topic**: Central message publishing/subscription hub
- **SQS Queues**: Message buffering and processing
- **Lambda Functions**: Serverless business logic processing
- **DynamoDB Table**: NoSQL data storage

### Event Flows:

1. **Image Upload Flow**:
   - Photographer uploads images to S3 bucket
   - S3 triggers Object Created events sent to SNS topic

2. **Image Logging Flow (Implemented)**:
   - SNS topic filters messages to log-image-queue
   - Log Image Lambda receives messages from the queue
   - Lambda function records image information in DynamoDB table

3. **Email Notification Flow**:
   - SNS topic filters messages to mailer-queue
   - Mailer Lambda sends email notifications to photographers

4. **Image Processing Flow**:
   - SNS topic filters messages to image-process-queue
   - Process Image Lambda handles image processing

## Implemented Features

### Log New Images (Log Image)

When an image is uploaded to the S3 bucket, the system automatically:
1. Generates upload event notifications to the SNS topic
2. Filters messages to a dedicated SQS queue
3. Triggers the Log Image Lambda function
4. Validates the image format (supports .jpeg, .jpg, .png)
5. Records valid image information in the DynamoDB table

Recorded information includes:
- Image ID (filename)
- Upload time
- File size
- Bucket name

### Email Notifications

When an image is successfully uploaded, the system automatically sends an email notification to the photographer, including the image URL and upload confirmation.

## Technology Stack

- **AWS CDK**: Infrastructure as Code
- **TypeScript**: Development language
- **Node.js**: Runtime environment
- **AWS Services**:
  - S3 (Storage)
  - SNS (Messaging)
  - SQS (Queuing)
  - Lambda (Compute)
  - DynamoDB (Database)
  - SES (Email Service)

## Deployment and Testing

### Prerequisites

- AWS CLI configured
- Node.js environment (version ≥14)
- CDK installed (`npm install -g aws-cdk`)

### Deployment Steps

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd eda-lab
npm install
```

2. Deploy the CDK application:
```bash
npm run cdk deploy
```

### Testing Features

1. Upload an image to S3:
```bash
aws s3 cp test.jpg s3://<bucket-name>/
```

2. Check records in the DynamoDB table:
```bash
aws dynamodb scan --table-name <table-name>
```

3. Check CloudWatch logs to view Lambda execution details

## Extension Features

The system design supports implementing the following extension features:

1. **Metadata Management**: Add image metadata (title, date, photographer name) using SNS
2. **Status Updates**: Support for administrators to change image status
3. **Image Deletion**: Support for deleting images and related records


