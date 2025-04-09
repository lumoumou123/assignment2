import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: SQSEvent) => {
  try {
    console.log("Received SQS event:", JSON.stringify(event));
    
    for (const record of event.Records) {
      // SQS 消息体是一个 JSON 字符串，需要解析
      const body = JSON.parse(record.body);
      
      // 从 SNS 消息中提取 S3 事件信息
      if (body.Message) {
        const message = JSON.parse(body.Message);
        
        // 处理 S3 事件
        if (message.Records && message.Records.length > 0) {
          for (const s3Record of message.Records) {
            if (s3Record.eventSource === 'aws:s3' && s3Record.eventName.startsWith('ObjectCreated')) {
              // 获取 S3 信息
              const s3 = s3Record.s3;
              const srcBucket = s3.bucket.name;
              const srcKey = decodeURIComponent(s3.object.key.replace(/\+/g, " "));
              
              // 检查文件扩展名
              if (!srcKey.toLowerCase().endsWith(".jpeg") && 
                  !srcKey.toLowerCase().endsWith(".jpg") && 
                  !srcKey.toLowerCase().endsWith(".png")) {
                console.log(`Skipping non-image file: ${srcKey}`);
                continue;
              }

              // 准备 DynamoDB 记录
              const item = {
                id: srcKey,
                uploadTime: new Date().toISOString(),
                size: s3.object.size,
                bucket: srcBucket
              };

              console.log("Writing to DynamoDB:", JSON.stringify(item));

              // 写入 DynamoDB
              await ddbDocClient.send(
                new PutCommand({
                  TableName: process.env.TABLE_NAME,
                  Item: item,
                })
              );

              console.log(`Successfully logged image: ${srcKey}`);
            }
          }
        } else {
          console.log("No S3 records found in the message");
        }
      } else {
        console.log("Not an SNS message or invalid format");
      }
    }
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}; 