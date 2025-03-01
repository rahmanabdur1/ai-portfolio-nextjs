import { MongoClient } from "mongodb";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";
import OpenAI from "openai";
import sampleData from "./sample-data.json" with { type: "json" };

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
const dbName = process.env.MONGODB_DB;
const collectionName = "portfolio";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Create Collection (if not exists)
const createCollection = async () => {
  try {
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();

    if (!collections.some((c) => c.name === collectionName)) {
      await db.createCollection(collectionName);
      console.log(`Collection '${collectionName}' created.`);
    } else {
      console.log("Collection already exists.");
    }
  } catch (error) {
    console.error("Error creating collection:", error);
  }
};

// Load Data into MongoDB
const loadData = async () => {
  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    for await (const { id, info, description } of sampleData) {
      const chunks = await splitter.splitText(description);

      for await (const chunk of chunks) {
        const { data } = await openai.embeddings.create({
          input: chunk,
          model: "text-embedding-3-small",
        });

        await collection.insertOne({
          document_id: id,
          embedding: data[0]?.embedding, // Store as "embedding" instead of "$vector"
          info,
          description: chunk,
        });
      }
    }
    console.log("Data added successfully.");
  } catch (error) {
    console.error("Error loading data:", error);
  }
};

// Connect to MongoDB and execute functions
client.connect().then(async () => {
  console.log("Connected to MongoDB.");
  await createCollection();
  await loadData();
  client.close();
});
