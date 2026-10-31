import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;

// Each test file gets its own throwaway in-memory MongoDB.
export async function startTestDB() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri('studymate-test'));
  await mongoose.connection.syncIndexes();
}

export async function stopTestDB() {
  await mongoose.disconnect();
  await server.stop();
}

export async function clearDB() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
