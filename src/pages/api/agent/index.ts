import { createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor } from "langchain/agents";
// import { PineconeRetrieverTool } from "./agent_tools/pineconeRetrieverTool";
import { Tool } from "@langchain/core/tools";
import { NextApiRequest, NextApiResponse } from "next";
import { PostgresNLQTool } from "./tools/postgres-nlq-tool";

let agentExecutor: any;

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
        "You are a specialized database interaction chatbot. Your primary purpose is to answer questions based on the data in the database. Assume all questions relate to the database. If you determine a question does not relate to the database, respond with 'I'm sorry, I don't know how to answer that.' You will: \n\n" +
        "- Query the database to retrieve relevant information.\n" +
        "- Perform calculations (e.g., averages, sums, counts) on the data as needed to answer the user's question.\n" +
        "- Present the results clearly and concisely.\n" +
        "- If requested information isn't available, notify the user.\n\n" +
        "When accessing the database:\n" +
        "1. Use precise queries.\n" +
        "2. If needed, refine search parameters.\n\n" +
        "Maintain a professional tone.\n" +
        "always format your response as beautiful markdown with proper indentation and line breaks.",
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

  const cleanedOutput = result.output.replace(/["'\n]/g, '');
  
  // Get graph type suggestion from LLM
  const visualization = await suggestGraphType(cleanedOutput);
  
  return {
    answer: cleanedOutput,
    visualization: visualization
  };
}

async function suggestGraphType(data: string): Promise<any> {
  const prompt = `Given the following data, analyze it and determine the best way to visualize it. 
  If the data is suitable for a line chart, return a complete React component configuration in JSON format that includes:
  - data: array of objects with x-axis values and corresponding y-axis values
  - config: color and label configuration for each line
  - title: appropriate chart title
  - description: optional description
  - xAxisKey: always use 'game_date' for the x-axis key if the data contains dates
  - lineKeys: array of keys to use for the lines
  - footerText: optional footer text
  - trendText: optional trend text

  Here is the data: ${data}

  Example response for line chart data:
  {
    "type": "line",
    "componentConfig": {
      "data": [
        {"game_date": "2025-02-05", "points": 38},
        {"game_date": "2025-02-09", "points": 19},
        {"game_date": "2025-02-11", "points": 20}
      ],
      "config": {
        "points": {"label": "Points", "color": "hsl(var(--chart-1))"}
      },
      "title": "Player Performance Over Time",
      "xAxisKey": "game_date",
      "lineKeys": ["points"],
      "footerText": "Summary of the trends of the data presented."
    }
  }
  `;

  try {
    const response = await agentExecutor.invoke({
      input: prompt
    });
    
    // Clean the response by removing markdown code blocks
    let cleanedResponse = response.output;
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.slice(7); // Remove ```json
    }
    if (cleanedResponse.endsWith('```')) {
      cleanedResponse = cleanedResponse.slice(0, -3); // Remove ```
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse the cleaned response as JSON
    try {
      const result = JSON.parse(cleanedResponse);
      
      
      return result;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      console.error("Response content:", cleanedResponse);
      return { type: 'bar' }; // Fallback option
    }
  } catch (error) {
    console.error("Error getting graph type suggestion:", error);
    return { type: 'bar' }; // Fallback option
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { message, userId, displayName } = req.body;

    if (!agentExecutor) {
      await initializeAgent();
    }

    try {
      const result = await handleQuestion(message);
      res.status(200).json(result);
    } catch (error) {
      console.error("Handler error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal server error" });
      } else {
        res.end();
      }
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
