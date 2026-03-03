import { MongoClient } from 'mongodb';
import { getEnv } from './config';

let client: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;
  const { MONGODB_URI } = getEnv();
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}

export async function getDb() {
  const c = await getMongoClient();
  // default DB comes from URI path; if none provided Atlas will use "test".
  // For MVP we can explicitly use guardian_policy.
  return c.db(process.env.MONGODB_DB || 'guardian_policy');
}
