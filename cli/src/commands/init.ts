import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb'
import { SESClient, VerifyEmailAddressCommand } from '@aws-sdk/client-ses'
import * as fs from 'fs'
import * as path from 'path'

interface InitOptions {
  regions: string
  primary: string
}

export async function init(options: InitOptions) {
  const regions = options.regions.split(',').map(r => r.trim())
  const primaryRegion = options.primary

  console.log('\n🔒 Fortis init\n')
  console.log(`Primary region:  ${primaryRegion}`)
  console.log(`All regions:     ${regions.join(', ')}\n`)

  // Create users table as Global Table in primary region with replicas
  console.log(`Creating users Global Table in ${primaryRegion} with replicas in ${regions.filter(r => r !== primaryRegion).join(', ')}...`)
  await createUsersGlobalTable(primaryRegion, regions)

  // Create regional token tables
  for (const region of regions) {
    const shortName = region.split('-')[0]
    const tableName = `fortis-tokens-${shortName}`
    console.log(`Creating token table ${tableName} in ${region}...`)
    await createTable(region, tableName)
  }

  console.log('\nAll tables created.\n')

  // Output env template
  const envLines = [
    `PRIMARY_REGION=${primaryRegion}`,
    `USERS_TABLE=fortis-users`,
    regions.map(r => {
      const short = r.split('-')[0]
      return `TOKENS_TABLE_${short.toUpperCase()}=fortis-tokens-${short}`
    }).join('\n'),
    `JWT_SECRET=<generate with: openssl rand -hex 32>`,
    `BASE_URL=https://yourdomain.com`,
    `FROM_EMAIL=auth@yourdomain.com`,
  ].join('\n')

  fs.writeFileSync('.env.fortis', envLines)
  console.log('✓ .env.fortis written\n')
  console.log('Next steps:')
  console.log('  1. Fill in JWT_SECRET and FROM_EMAIL in .env.fortis')
  console.log('  2. Verify your FROM_EMAIL in SES: npx fortis init --verify-email')
  console.log('  3. Deploy Lambdas: cd infra/terraform/aws && terraform apply\n')
}

async function createUsersGlobalTable(primaryRegion: string, allRegions: string[]) {
  const client = new DynamoDBClient({ region: primaryRegion })
  const tableName = 'fortis-users'
  const replicaRegions = allRegions.filter(r => r !== primaryRegion)

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
    console.log(`  ⚠ ${tableName} already exists — skipping`)
    return
  } catch {}

  await client.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES',  // required for Global Tables
    },
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'userId-index',
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
    ReplicaUpdates: replicaRegions.map(r => ({
      Create: { RegionName: r },
    })),
  }))

  console.log(`  ✓ ${tableName} created as Global Table`)
  console.log(`  ✓ Replicas added: ${replicaRegions.join(', ')}`)
}


  const client = new DynamoDBClient({ region })

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
    console.log(`  ⚠ ${tableName} already exists — skipping`)
    return
  } catch {}

  await client.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'userId-index',
      KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  }))

  console.log(`  ✓ ${tableName} created`)
}
