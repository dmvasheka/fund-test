import { MongoClient, Collection, Document } from "mongodb";
import { MONGO_URL, DB_NAME, COLLECTION_NAME } from "./server.config.js";

let client: MongoClient;
let collection: Collection;
const pendingInserts = new Set<Promise<void>>();

export async function connect(): Promise<void> {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  collection = client.db(DB_NAME).collection(COLLECTION_NAME);
}

export function insertEvents(events: Document[]): void {
  const promise = collection.insertMany(events).then(
    () => {},
    (err) => console.error("Failed to insert events:", err),
  );
  pendingInserts.add(promise);
  promise.finally(() => pendingInserts.delete(promise));
}

export async function disconnect(): Promise<void> {
  await Promise.all(pendingInserts);
  await client?.close();
}
