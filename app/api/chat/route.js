import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { MongoClient } from "mongodb";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.MONGODB_DB);
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const { messages } = await req.json();

    const latestMessage = messages[messages?.length - 1]?.content;
    let docContext = "";

    // Generate Embeddings
    const { data } = await openai.embeddings.create({
      input: latestMessage,
      model: "text-embedding-3-small",
    });

    const collection = db.collection("portfolio");

    // Find top 5 relevant documents based on vector similarity (requires precomputed embeddings)
    const documents = await collection
      .find({}, { limit: 5 }) // Adjust filtering logic if using vector search
      .toArray();

    docContext = `
          START CONTEXT
          ${documents?.map((doc) => doc.description).join("\n")}
          END CONTEXT
          `;

    const ragPrompt = [
      {
        role: "system",
        content: `
              You are an AI assistant answering questions as Piyush Agarwal in his Portfolio App. 
              Format responses using markdown where applicable.
              ${docContext}
              If the answer is not provided in the context, the AI assistant will say, 
              "I'm sorry, I do not know the answer".
              `,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [...ragPrompt, ...messages],
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);
  } catch (e) {
    console.error("Error:", e);
    throw e;
  }
}
