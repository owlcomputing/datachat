import { createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor } from "langchain/agents";
// import { PineconeRetrieverTool } from "./agent_tools/pineconeRetrieverTool";
import { Tool } from "@langchain/core/tools";
import { NextApiRequest, NextApiResponse } from "next";
import { PostgresNLQTool } from "./tools/postgres-nlq-tool";
import { MySQLNLQTool } from "./tools/mysql-nlq-tool";
import { SQLServerNLQTool } from "./tools/sqlserver-nlq-tool";
import {
  checkSupabaseConnection,
  getConnectionIdForChat,
  getDatabaseDialect,
  validateChatAccess,
  validateConnectionAccess,
} from "./utils/connection";
import { suggestGraphType, suggestTableData } from "./utils/visualization";

// Define the output structure type
interface AgentResponse {
  answer: string;
  visualization: string; // JSON string for chart configuration
  tableData?: Record<string, unknown> | null; // Can be refined further based on actual structure
  sqlQuery?: string;
}

export async function initializeAgent(
  userId?: string,
  chatId?: string,
  connectionId?: string,
) {
  // Create a new agent executor for each request to ensure we use the correct connection
  const gemini = new ChatGoogleGenerativeAI({
    modelName: process.env.GEMINI_API_MODEL,
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY,
    streaming: true,
  });

  let databaseTool: Tool;

  // If we have a connectionId, determine which tool to use based on the dialect
  if (connectionId) {
    try {
      const dialect = await getDatabaseDialect(connectionId);
      console.log(
        `Database dialect for connection ${connectionId}: ${dialect}`,
      );

      if (dialect === "mysql") {
        console.log("Using MySQL NLQ tool");
        databaseTool = new MySQLNLQTool(
          userId || null,
          chatId || null,
          connectionId,
        );
      } else if (dialect === "sqlserver") {
        console.log("Using SQL Server NLQ tool");
        databaseTool = new SQLServerNLQTool(
          userId || null,
          chatId || null,
          connectionId,
        );
      } else {
        // Default to Postgres for any other dialect
        console.log("Using Postgres NLQ tool");
        databaseTool = new PostgresNLQTool(
          userId || null,
          chatId || null,
          connectionId,
        );
      }
    } catch (error) {
      console.error("Error determining database dialect:", error);
      // Default to Postgres on error
      console.log("Defaulting to Postgres NLQ tool due to error");
      databaseTool = new PostgresNLQTool(
        userId || null,
        chatId || null,
        connectionId,
      );
    }
  } else {
    // If no connectionId, use the PostgresNLQTool as default
    console.log("No connectionId provided, using Postgres NLQ tool as default");
    databaseTool = new PostgresNLQTool(userId || null, chatId || null, null);
  }

  const tools: Tool[] = [databaseTool];


  // Base system prompt
  let systemPrompt = "You are a specialized database interaction and data visualization chatbot. Your primary purpose is to answer questions based on the data in the database and provide visualizations when appropriate. Assume all questions relate to the database. If you determine a question does not relate to the database, respond with 'I'm sorry, I don't know how to answer that.' You will: \n\n" +
    "- Query the database to retrieve relevant information.\n" +
    "- Perform calculations (e.g., averages, sums, counts) on the data as needed to answer the user's question.\n" +
    "- Present the results in an EXTREMELY concise manner - your text response should be no more than 1-3 simple sentences.\n" +
    "- Focus on providing the data in visual formats (charts and tables) rather than lengthy text explanations.\n" +
    "- When the data is suitable for visualization, structure your query to return data that can be effectively visualized.\n" +
    "- For time-series data, ensure you include date/time fields and relevant metrics.\n" +
    "- For categorical data, ensure you include category fields and corresponding values.\n" +
    "- When the data is tabular in nature, present it in a structured format that can be displayed in a table.\n" +
    "- Include both raw data (for tables) and processed data (for charts) when appropriate.\n" +
    "- For visualizations, always use the color format 'hsl(var(--chart-N))' where N is 1-5, not 'var(--color-X)'.\n" +
    "- If requested information isn't available, notify the user.\n\n" +
    "When accessing the database:\n" +
    "1. Use precise queries.\n" +
    "2. If needed, refine search parameters.\n" +
    "3. Always include fields that would be useful for visualization (dates, categories, metrics).\n" +
    "4. Structure your response to include a VERY BRIEF summary (1-3 sentences maximum), followed by data that can be presented in tables and/or charts.\n\n" +
    "Maintain a professional tone.\n" +
    "Always format your response as clean markdown with proper indentation and line breaks, but keep the text portion extremely brief.";


  const prompt = ChatPromptTemplate.fromMessages([
    {
      type: "system",
      content: systemPrompt,
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

  const newAgentExecutor = new AgentExecutor({
    agent,
    tools,
    maxIterations: 5,
  });

  console.log("Agent initialized");
  return newAgentExecutor;
}

export async function handleQuestion(
  userInput: string,
  userId?: string,
  chatId?: string,
  connectionId?: string,
  context: { isUser: boolean; content: string }[] = [],
) {
  // Initialize a new agent executor for this request
  const agentExecutor = await initializeAgent(userId, chatId, connectionId);

  console.log("Processing question:", userInput);
  console.log("With context:", context);

  // Format the context as a conversation history if available
  let formattedInput = userInput;
  if (context && context.length > 0) {
    const conversationHistory = context.map((msg) => {
      const role = msg.isUser ? "User" : "Assistant";
      return `${role}: ${msg.content}`;
    }).join("\n");

    formattedInput =
      `Previous conversation:\n${conversationHistory}\n\nCurrent question: ${userInput}`;
    console.log("Formatted input with context:", formattedInput);
  }

  const result = await agentExecutor.invoke({
    input: formattedInput,
  });

  console.log("Raw agent response:", result);

  // Clean the output to make it more readable in markdown
  let cleanedOutput = result.output
    .replace(/\\n/g, "\n") // Replace escaped newlines with actual newlines
    .replace(/\\"/g, '"'); // Replace escaped quotes with actual quotes

  // Limit the text response to just the first paragraph or first few sentences
  // This ensures the response is concise as requested
  const paragraphs = cleanedOutput.split("\n\n");
  if (paragraphs.length > 0) {
    // Take just the first paragraph
    let firstParagraph = paragraphs[0].trim();

    // If the first paragraph is too long, limit it to a few sentences
    const sentences = firstParagraph.split(/[.!?]+\s+/);
    if (sentences.length > 3) {
      firstParagraph = sentences.slice(0, 3).join(". ") + ".";
    }

    // Replace the full output with just the concise version
    cleanedOutput = firstParagraph;
  }

  // Extract SQL query from the tool response if available
  let sqlQuery = null;
  if (result.intermediateSteps && result.intermediateSteps.length > 0) {
    console.log("Checking intermediate steps for SQL query...");
    for (const step of result.intermediateSteps) {
      console.log("Step action tool:", step.action?.tool);
      if (
        step.action &&
        (step.action.tool === "postgres_natural_language_query" ||
          step.action.tool === "mysql_natural_language_query")
      ) {
        try {
          console.log("Found SQL tool, parsing observation:", step.observation);
          const toolResponse = JSON.parse(step.observation);
          console.log("Parsed tool response:", toolResponse);
          if (toolResponse && toolResponse.sqlQuery) {
            sqlQuery = toolResponse.sqlQuery;
            console.log("Extracted SQL query:", sqlQuery);
            break;
          }
        } catch (e) {
          console.error("Error parsing tool response:", e);
        }
      }
    }
  }

  // Get graph type suggestion from LLM
  const visualization = await suggestGraphType(
    result.output,
    userInput,
    agentExecutor,
  );

  // Get table data suggestion from LLM
  const tableData = await suggestTableData(
    result.output,
    userInput,
    agentExecutor,
  );

  // Parse the result
  const finalResponse: AgentResponse = {
    answer: cleanedOutput,
    visualization: JSON.stringify(visualization),
    tableData: tableData,
    sqlQuery: sqlQuery,
  };

  return finalResponse;
}

// API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    try {
      // Check Supabase connection first
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        return res.status(500).json({ error: "Failed to connect to Supabase" });
      }

      const { question, userId, chatId, context } = req.body;
      let connectionId = req.body.connectionId;

      console.log("API request received:", {
        question,
        userId,
        chatId,
        connectionId,
        contextLength: context ? context.length : 0,
        headers: req.headers,
      });

      if (!question) {
        console.error("Missing required parameter: question");
        return res.status(400).json({ error: "Question is required" });
      }

      if (!userId) {
        console.error("Missing required parameter: userId");
        return res.status(400).json({ error: "User ID is required" });
      }

      // Validate user and chat if provided
      if (userId && chatId) {
        const isValidChat = await validateChatAccess(userId, chatId);
        if (!isValidChat) {
          return res.status(403).json({
            error: "Unauthorized access to chat or chat not found",
          });
        }
      }

      // If connectionId is provided, verify the user has access to this connection
      if (userId && connectionId) {
        const isValidConnection = await validateConnectionAccess(
          userId,
          connectionId,
        );
        if (!isValidConnection) {
          return res.status(403).json({
            error: "Unauthorized access to connection or connection not found",
          });
        }
      }

      // If chatId is provided but connectionId is not, try to get the connection from the chat
      if (chatId && !connectionId) {
        connectionId = await getConnectionIdForChat(userId, chatId);
        if (!connectionId) {
          return res.status(400).json({
            error: "No database connection associated with this chat",
          });
        }
      }

      // Process the question with the agent
      console.log(
        `Processing question with agent: question="${question}", userId=${userId}, chatId=${chatId}, connectionId=${connectionId}, contextLength=${
          context ? context.length : 0
        }`,
      );
      const response = await handleQuestion(
        question,
        userId,
        chatId,
        connectionId,
        context || [],
      );

      return res.status(200).json(response);
    } catch (error) {
      console.error("Error processing question:", error);
      return res.status(500).json({ error: "Failed to process question" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
