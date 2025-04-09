import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION});

export const handler: SQSHandler = async (event: any) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    try {
      // 检查 body 是否已经是对象
      const recordBody = typeof record.body === 'string' 
        ? JSON.parse(record.body) 
        : record.body;
      
      // 处理直接从 S3 到 SQS 的消息格式
      if (recordBody.Records && recordBody.Records[0].s3) {
        // 直接来自S3的事件通知
        handleS3Event(recordBody);
      } 
      // 处理 SNS 到 SQS 的消息格式
      else if (recordBody.Message) {
        const snsMessage = typeof recordBody.Message === 'string'
          ? JSON.parse(recordBody.Message)
          : recordBody.Message;
        
        if (snsMessage.Records) {
          handleS3Event(snsMessage);
        }
      }
    } catch (error) {
      console.error("Error processing record:", error);
    }
  }
};

async function handleS3Event(eventData: any) {
  console.log("Processing S3 event:", JSON.stringify(eventData));
  for (const messageRecord of eventData.Records) {
    const s3e = messageRecord.s3;
    const srcBucket = s3e.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
    try {
      const { name, email, message }: ContactDetails = {
        name: "The Photo Album",
        email: SES_EMAIL_FROM,
        message: `We received your Image. Its URL is s3://${srcBucket}/${srcKey}`,
      };
      const params = sendEmailParams({ name, email, message });
      await client.send(new SendEmailCommand(params));
      console.log("Email sent successfully for", srcKey);
    } catch (error: unknown) {
      console.log("ERROR sending email: ", error);
    }
  }
}

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
        // Text: {.           // For demo purposes
        //   Charset: "UTF-8",
        //   Data: getTextContent({ name, email, message }),
        // },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `New image Upload`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}

// For demo purposes - not used here.
function getTextContent({ name, email, message }: ContactDetails) {
  return `
    Received an Email. 📬
    Sent from:
        👤 ${name}
        ✉️ ${email}
    ${message}
  `;
}
