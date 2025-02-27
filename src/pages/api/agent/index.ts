import { createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor } from "langchain/agents";
// import { PineconeRetrieverTool } from "./agent_tools/pineconeRetrieverTool";
import { Tool } from "@langchain/core/tools";
import { NextApiRequest, NextApiResponse } from "next";
import { PostgresNLQTool } from "./tools/postgres-nlq-tool";

let agentExecutor = null as AgentExecutor | null;

export async function initializeAgent() {
  if (agentExecutor) return agentExecutor;

  const gemini = new ChatGoogleGenerativeAI({
    modelName: process.env.GEMINI_API_MODEL,
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY,
    streaming: true,
  });

  const tools: Tool[] = [new PostgresNLQTool()];

  const prompt = ChatPromptTemplate.fromMessages([
    {
      type: "system",
      content:
        "You are a specialized database interaction chatbot. Your primary purpose is to help users explore and understand the information stored in the provided database. Assume all questions relate to the database. If you determine a question does not relate to the database, respond with 'I'm sorry, I don't know how to answer that.' You will: \n\n" +
        "- Query and display relevant database information based on user requests \n" +
        "- Explain database contents clearly and accurately \n" +
        "- Help users formulate effective queries to find the information they need \n" +
        "- Notify users if requested information isn't available in the database \n\n" +
        "When accessing the database: \n" +
        "1. Use precise queries to retrieve specific information \n" +
        "2. If initial results are insufficient, refine the search parameters \n" +
        "3. Present database information in a structured and readable format \n\n" +
        "Maintain a professional tone while helping users navigate and understand the database contents effectively.",
    },
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({
    llm: gemini,
    tools,
    prompt,
  });

  agentExecutor = new AgentExecutor({
    agent,
    tools,
    maxIterations: 3,
  });

  console.log("Agent initialized");
  return agentExecutor;
}

export async function handleQuestion(userInput: string) {
  if (!agentExecutor) {
    throw new Error("Agent not initialized - call initializeAgent() first");
  }

  const result = await agentExecutor.invoke({
    input: userInput,
  });

  return result.output;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { message, action } = req.body;

    if (action === "initialize") {
      await initializeAgent();
      return res.status(200).json({ message: "Agent initialized" });
    }

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const response = await handleQuestion(message);
    res.status(200).json({ response });
  } catch (error) {
    console.error("Handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.end();
    }
  }
}
