import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import fs from 'fs';
import path from 'path';

function loadCredentials() {
  const credPath = 'C:\\Users\\Alfa\\.aws\\credentials';
  const configPath = 'C:\\Users\\Alfa\\.aws\\config';

  let accessKeyId = '';
  let secretAccessKey = '';
  let region = 'eu-north-1';

  try {
    if (fs.existsSync(credPath)) {
      const content = fs.readFileSync(credPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('aws_access_key_id')) {
          accessKeyId = line.split('=')[1].trim();
        }
        if (line.includes('aws_secret_access_key')) {
          secretAccessKey = line.split('=')[1].trim();
        }
      }
    }
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('region')) {
          region = line.split('=')[1].trim();
        }
      }
    }
  } catch (err) {
    console.error('Error reading credentials:', err);
  }

  return { accessKeyId, secretAccessKey, region };
}

async function run() {
  const creds = loadCredentials();
  if (!creds.accessKeyId || !creds.secretAccessKey) {
    console.error('Failed to load credentials from C:\\Users\\Alfa\\.aws\\credentials');
    return;
  }

  console.log(`Connecting to AWS EC2 in region: ${creds.region}...`);

  const client = new EC2Client({
    region: creds.region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    }
  });

  try {
    const { AuthorizeSecurityGroupIngressCommand } = await import("@aws-sdk/client-ec2");
    console.log('Adding inbound rule for port 3001...');
    const response = await client.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: 'sg-0994a421fbcccca03',
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 3001,
          ToPort: 3001,
          IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'Vercel frontend access' }]
        }
      ]
    }));
    console.log('Successfully opened port 3001 on EC2 Security Group!');

  } catch (err) {
    console.error('Error opening port 3001:', err);
  }
}

run();
