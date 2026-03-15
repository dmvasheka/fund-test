import { MongoClient, Collection, Document } from "mongodb";
import { MONGO_URL, DB_NAME, COLLECTION_NAME } from "./server.config.js";

let client: MongoClient;
let collection: Collection;

export async function connect(): Promise<void> {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  collection = client.db(DB_NAME).collection(COLLECTION_NAME);
}

export async function insertEvents(events: Document[]): Promise<void> {
  try {
    await collection.insertMany(events);
  } catch (err) {
    console.error("Failed to insert events:", err);
  }
}

export async function disconnect(): Promise<void> {
  await client?.close();
}
