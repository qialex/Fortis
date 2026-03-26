import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { DatabaseAdapter, User } from '@fortis/core'
import type { RefreshToken } from '@fortis/core'

export interface DynamoDBAdapterConfig {
  usersTable: string
  tokensTable: string
  emailTokensTable?: string
  region: string
  // Global Table write routing — all user writes go to primary region
  // to prevent duplicate email race conditions on concurrent registration.
  // Reads still hit the local replica for low latency.
  usersWriteRegion?: string
  endpoint?: string  // for local dev with DynamoDB Local
}

export function dynamodbAdapter(config: DynamoDBAdapterConfig): DatabaseAdapter {
  // Read client — local region, hits Global Table replica
  const readClient = new DynamoDBClient({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  })

  // Write client — primary region only, prevents duplicate email on concurrent register
  const writeClient = config.usersWriteRegion
    ? new DynamoDBClient({
        region: config.usersWriteRegion,
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      })
    : readClient

  const emailTokensTable = config.emailTokensTable ?? `${config.tokensTable}-email`

  return {
    async createUser(user) {
      const now = Date.now()
      const item = { ...user, createdAt: now, updatedAt: now }
      // Always write to primary region — prevents duplicate email race condition
      await writeClient.send(new PutItemCommand({
        TableName: config.usersTable,
        Item: marshall({ PK: `USER#${user.email}`, SK: 'PROFILE', ...item }),
        ConditionExpression: 'attribute_not_exists(PK)',
      }))
      return item as User
    },

    async getUserByEmail(email) {
      // Read from local replica — fast
      const res = await readClient.send(new GetItemCommand({
        TableName: config.usersTable,
        Key: marshall({ PK: `USER#${email}`, SK: 'PROFILE' }),
      }))
      return res.Item ? (unmarshall(res.Item) as User) : null
    },

    async getUserById(userId) {
      const res = await readClient.send(new QueryCommand({
        TableName: config.usersTable,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: marshall({ ':uid': userId }),
        Limit: 1,
      }))
      return res.Items?.[0] ? (unmarshall(res.Items[0]) as User) : null
    },

    async updateUser(userId, data) {
      const user = await this.getUserById(userId)
      if (!user) throw new Error('User not found')
      const updated = { ...user, ...data, updatedAt: Date.now() }
      // Writes always go to primary
      await writeClient.send(new PutItemCommand({
        TableName: config.usersTable,
        Item: marshall({ PK: `USER#${user.email}`, SK: 'PROFILE', ...updated }),
      }))
      return updated as User
    },

    async deleteUser(userId) {
      const user = await this.getUserById(userId)
      if (!user) return
      await writeClient.send(new DeleteItemCommand({
        TableName: config.usersTable,
        Key: marshall({ PK: `USER#${user.email}`, SK: 'PROFILE' }),
      }))
    },

    async listUsers({ limit = 50, cursor } = {}) {
      const res = await readClient.send(new ScanCommand({
        TableName: config.usersTable,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: marshall({ ':sk': 'PROFILE' }),
        Limit: limit,
        ...(cursor ? { ExclusiveStartKey: JSON.parse(Buffer.from(cursor, 'base64').toString()) } : {}),
      }))
      return {
        users: (res.Items ?? []).map(i => unmarshall(i) as User),
        cursor: res.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
          : undefined,
      }
    },

    // Token ops — always local region (regional table, not Global Table)
    async createRefreshToken(token) {
      await readClient.send(new PutItemCommand({
        TableName: config.tokensTable,
        Item: marshall({ PK: `TOKEN#${token.token}`, SK: 'SESSION', ...token }),
      }))
    },

    async getRefreshToken(token) {
      const res = await readClient.send(new GetItemCommand({
        TableName: config.tokensTable,
        Key: marshall({ PK: `TOKEN#${token}`, SK: 'SESSION' }),
      }))
      return res.Item ? (unmarshall(res.Item) as RefreshToken) : null
    },

    async deleteRefreshToken(token) {
      await readClient.send(new DeleteItemCommand({
        TableName: config.tokensTable,
        Key: marshall({ PK: `TOKEN#${token}`, SK: 'SESSION' }),
      }))
    },

    async deleteAllRefreshTokens(userId) {
      const tokens = await this.listRefreshTokens(userId)
      await Promise.all(tokens.map(t => this.deleteRefreshToken(t.token)))
    },

    async listRefreshTokens(userId) {
      const res = await readClient.send(new QueryCommand({
        TableName: config.tokensTable,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: marshall({ ':uid': userId }),
      }))
      return (res.Items ?? []).map(i => unmarshall(i) as RefreshToken)
    },

    async createEmailToken({ token, userId, email, type, expiresAt }) {
      await writeClient.send(new PutItemCommand({
        TableName: emailTokensTable,
        Item: marshall({
          PK: `EMAIL_TOKEN#${token}`,
          SK: type.toUpperCase(),
          token, userId, email, type, expiresAt,
        }),
      }))
    },

    async getEmailToken(token, type) {
      const res = await readClient.send(new GetItemCommand({
        TableName: emailTokensTable,
        Key: marshall({ PK: `EMAIL_TOKEN#${token}`, SK: type.toUpperCase() }),
      }))
      if (!res.Item) return null
      const item = unmarshall(res.Item)
      return { userId: item.userId, email: item.email, expiresAt: item.expiresAt }
    },

    async deleteEmailToken(token) {
      await writeClient.send(new DeleteItemCommand({
        TableName: emailTokensTable,
        Key: marshall({ PK: `EMAIL_TOKEN#${token}`, SK: 'VERIFY' }),
      }))
    },

    async incrementLoginAttempts(key) {
      const res = await readClient.send(new UpdateItemCommand({
        TableName: config.tokensTable,
        Key: marshall({ PK: `RL#${key}`, SK: 'ATTEMPTS' }),
        UpdateExpression: 'ADD attempts :inc SET expiresAt = if_not_exists(expiresAt, :exp)',
        ExpressionAttributeValues: marshall({
          ':inc': 1,
          ':exp': Math.floor(Date.now() / 1000) + 900,
        }),
        ReturnValues: 'UPDATED_NEW',
      }))
      return Number(unmarshall(res.Attributes ?? {}).attempts ?? 0)
    },

    async resetLoginAttempts(key) {
      await readClient.send(new DeleteItemCommand({
        TableName: config.tokensTable,
        Key: marshall({ PK: `RL#${key}`, SK: 'ATTEMPTS' }),
      }))
    },
  }
}
