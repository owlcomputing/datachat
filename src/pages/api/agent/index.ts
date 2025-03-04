import { createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor } from "langchain/agents";
// import { PineconeRetrieverTool } from "./agent_tools/pineconeRetrieverTool";
import { Tool } from "@langchain/core/tools";
import { NextApiRequest, NextApiResponse } from "next";
import { PostgresNLQTool } from "./tools/postgres-nlq-tool";
import { createClient } from '@supabase/supabase-js';

let agentExecutor: any;

// Initialize Supabase client
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabaseClient.from('database_connections').select('*').limit(1); // Select just the 'id' of one chat

    if (error) {
      console.error("Supabase connection check FAILED:", error);
      return false;
    }

    if (data) {
      console.log("Supabase connection check SUCCESSFUL. Sample data:", data);
      return true;
    }
    console.log("data is null")
    return false

  } catch (err) {
    console.error("Supabase connection check FAILED (exception):", err);
    return false;
  }
}

export async function initializeAgent(userId?: string, chatId?: string, connectionId?: string) {
  // Create a new agent executor for each request to ensure we use the correct connection
  const gemini = new ChatGoogleGenerativeAI({
    modelName: process.env.GEMINI_API_MODEL,
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY,
    streaming: true,
  });

  // Create the PostgresNLQTool with user and chat context
  const postgresNLQTool = new PostgresNLQTool(
    userId || null,
    chatId || null,
    connectionId || null
  );

  const tools: Tool[] = [postgresNLQTool];

  const prompt = ChatPromptTemplate.fromMessages([
    {
      type: "system",
      content:
        "You are a specialized database interaction and data visualization chatbot. Your primary purpose is to answer questions based on the data in the database and provide visualizations when appropriate. Assume all questions relate to the database. If you determine a question does not relate to the database, respond with 'I'm sorry, I don't know how to answer that.' You will: \n\n" +
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
        "Always format your response as clean markdown with proper indentation and line breaks, but keep the text portion extremely brief.",
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
    maxIterations: 3,
  });

  console.log("Agent initialized");
  return newAgentExecutor;
}

export async function handleQuestion(userInput: string, userId?: string, chatId?: string, connectionId?: string) {
  // Initialize a new agent executor for this request
  const agentExecutor = await initializeAgent(userId, chatId, connectionId);

  console.log("Processing question:", userInput);
  
  const result = await agentExecutor.invoke({
    input: userInput,
  });

  console.log("Raw agent response:", result);

  // Clean the output to make it more readable in markdown
  let cleanedOutput = result.output
    .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
    .replace(/\\"/g, '"');  // Replace escaped quotes with actual quotes
  
  // Limit the text response to just the first paragraph or first few sentences
  // This ensures the response is concise as requested
  const paragraphs = cleanedOutput.split('\n\n');
  if (paragraphs.length > 0) {
    // Take just the first paragraph
    let firstParagraph = paragraphs[0].trim();
    
    // If the first paragraph is too long, limit it to a few sentences
    const sentences = firstParagraph.split(/[.!?]+\s+/);
    if (sentences.length > 3) {
      firstParagraph = sentences.slice(0, 3).join('. ') + '.';
    }
    
    // Replace the full output with just the concise version
    cleanedOutput = firstParagraph;
  }
  
  // Get graph type suggestion from LLM
  const visualization = await suggestGraphType(result.output, userInput, agentExecutor);
  
  // Get table data suggestion from LLM
  const tableData = await suggestTableData(result.output, userInput, agentExecutor);
  
  const finalResponse = {
    answer: cleanedOutput,
    visualization: visualization,
    tableData: tableData
  };
  
  console.log("Final response:", JSON.stringify(finalResponse, null, 2));
  
  return finalResponse;
}

async function suggestGraphType(data: string, originalQuery: string, agentExecutor: any): Promise<any> {
  console.log("Suggesting graph type for data:", data.substring(0, 200) + "...");
  
  const prompt = `Given the following data and the original user query, analyze it and determine the best way to visualize it. 
  Choose the most appropriate chart type based on the data characteristics:
  
  1. For time series or trend data: Use a LINE CHART
  2. For comparing values across categories: Use a BAR CHART
  3. For part-to-whole relationships: Use a PIE CHART
  4. For showing a single metric against a goal: Use a RADIAL CHART
  5. For showing changes over time with cumulative values: Use an AREA CHART
  
  Original user query: "${originalQuery}"
  
  Return a complete visualization configuration in JSON format with the following structure:
  
  For LINE CHART:
  {
    "type": "line",
    "componentConfig": {
      "data": [array of data points with x and y values],
      "config": {key-value pairs for each line with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values (usually dates/categories)",
      "lineKeys": [array of keys to use for the lines],
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For BAR CHART:
  {
    "type": "bar",
    "componentConfig": {
      "data": [array of data points],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values (categories)",
      "barKeys": [array of keys to use for the bars],
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For AREA CHART:
  {
    "type": "area",
    "componentConfig": {
      "data": [array of data points],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values",
      "areaKey": "The key for the area values",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For PIE CHART:
  {
    "type": "pie",
    "componentConfig": {
      "data": [array of data points with name and value],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "dataKey": "The key for the values",
      "nameKey": "The key for the segment names",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For RADIAL CHART:
  {
    "type": "radial",
    "componentConfig": {
      "data": [array of numeric values],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "labelText": "Label for the central value",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  Here is the data to analyze: ${data}
  
  If the data is not suitable for visualization, return null.
  
  IMPORTANT: Ensure that the data structure matches exactly what the chart component expects. For example:
  - For pie charts, each data item should have 'name' and 'value' properties
  - For radial charts, provide numeric values that can be averaged
  - For line and area charts, ensure the xAxisKey exists in each data point
  - For bar charts, ensure the xAxisKey (category) exists in each data point
  
  IMPORTANT FOR COLORS:
  - For pie charts, make sure to include a color for each segment in the config using the segment name as the key
  - Use explicit HSL color values like "hsl(var(--chart-1))" through "hsl(var(--chart-5))" for consistent coloring
  - Do not use "var(--color-X)" format as it won't work properly
  `;

  try {
    console.log("Sending visualization suggestion prompt to LLM");
    
    const response = await agentExecutor.invoke({
      input: prompt
    });
    
    console.log("Raw visualization suggestion response:", response.output);
    
    // Clean the response by removing markdown code blocks
    let cleanedResponse = response.output;
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n|\n```/g, '');
    } else if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n|\n```/g, '');
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse the cleaned response as JSON
    try {
      // Check if the response is "null" or indicates no visualization
      if (cleanedResponse.toLowerCase() === 'null' || 
          cleanedResponse.toLowerCase().includes('not suitable') ||
          cleanedResponse.toLowerCase().includes('cannot be visualized')) {
        console.log("Data not suitable for visualization");
        return null;
      }
      
      const result = JSON.parse(cleanedResponse);
      
      // Validate the result has the required structure
      if (!result.type || !result.componentConfig) {
        console.error("Invalid visualization format:", result);
        return null;
      }
      
      // Additional validation based on chart type
      const config = result.componentConfig;
      
      if (!config.data || !Array.isArray(config.data) || config.data.length === 0) {
        console.error("Visualization data is empty or invalid");
        return null;
      }
      
      // Fix color format if needed
      if (config.config) {
        Object.entries(config.config).forEach(([key, value]) => {
          const configValue = value as any;
          if (configValue.color && configValue.color.startsWith('var(--color-')) {
            // Convert var(--color-X) to hsl(var(--chart-Y))
            const colorIndex = (Object.keys(config.config).indexOf(key) % 5) + 1;
            configValue.color = `hsl(var(--chart-${colorIndex}))`;
          }
        });
      }
      
      if (!config.config) {
        // Create a default config if none is provided
        config.config = {};
        
        // For pie charts, create config entries for each slice
        if (result.type.toLowerCase() === 'pie') {
          const nameKey = config.nameKey || 'name';
          config.data.forEach((item: Record<string, any>) => {
            const key = item[nameKey];
            if (key) {
              const colorIndex = (Object.keys(config.config).length % 5) + 1;
              config.config[key] = {
                label: key,
                color: `hsl(var(--chart-${colorIndex}))`
              };
            }
          });
        }
        // For other charts, create config entries for each data key
        else {
          const sampleItem = config.data[0];
          Object.keys(sampleItem).forEach((key, index) => {
            if (key !== config.xAxisKey && key !== 'name' && typeof sampleItem[key] === 'number') {
              config.config[key] = {
                label: key,
                color: `hsl(var(--chart-${index % 5 + 1}))`
              };
            }
          });
        }
      }
      
      console.log("Visualization suggestion:", JSON.stringify(result, null, 2));
      return result;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      console.error("Response content:", cleanedResponse);
      return null;
    }
  } catch (error) {
    console.error("Error getting graph type suggestion:", error);
    return null;
  }
}

async function suggestTableData(data: string, originalQuery: string, agentExecutor: any): Promise<any> {
  console.log("Suggesting table data for:", data.substring(0, 200) + "...");
  
  const prompt = `Given the following data and the original user query, analyze it and determine if it would be beneficial to display the data in a table format.
  
  Original user query: "${originalQuery}"
  
  Return a complete table configuration in JSON format with the following structure if the data is suitable for a table:
  
  {
    "type": "table",
    "componentConfig": {
      "data": [array of data objects where each object represents a row],
      "columns": [
        {
          "key": "column1",
          "header": "Column 1 Header",
          "isNumeric": false
        },
        {
          "key": "column2",
          "header": "Column 2 Header",
          "isNumeric": true
        }
        // Add more columns as needed
      ],
      "caption": "Optional table caption",
      "footerData": {
        "label": "Optional footer label (e.g., 'Total')",
        "value": "Optional footer value (e.g., sum of a column)",
        "colSpan": 3  // Optional, number of columns the label should span
      },
      "title": "Optional table title",
      "config": {
        // Optional color configuration for specific columns or values
        "column1": {
          "label": "Column 1",
          "color": "hsl(var(--chart-1))"
        }
      }
    }
  }
  
  Here is the data to analyze: ${data}
  
  If the data is not suitable for a table display, return null.
  
  IMPORTANT: 
  - The 'key' in each column must match a property name in the data objects
  - Set 'isNumeric' to true for columns containing numeric values to right-align them
  - Only include a footerData if there's a meaningful summary value (like a sum or average)
  - Make sure all data objects have consistent properties
  - If the data is already in a table format in the markdown, extract and structure it properly
  - Use explicit HSL color values like "hsl(var(--chart-1))" through "hsl(var(--chart-5))" for consistent coloring
  `;

  try {
    console.log("Sending table data suggestion prompt to LLM");
    
    const response = await agentExecutor.invoke({
      input: prompt
    });
    
    console.log("Raw table data suggestion response:", response.output);
    
    // Clean the response by removing markdown code blocks
    let cleanedResponse = response.output;
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n|\n```/g, '');
    } else if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n|\n```/g, '');
    }
    cleanedResponse = cleanedResponse.trim();

    // Parse the cleaned response as JSON
    try {
      // Check if the response is "null" or indicates no table data
      if (cleanedResponse.toLowerCase() === 'null' || 
          cleanedResponse.toLowerCase().includes('not suitable') ||
          cleanedResponse.toLowerCase().includes('cannot be displayed')) {
        console.log("Data not suitable for table display");
        return null;
      }
      
      const result = JSON.parse(cleanedResponse);
      
      // Validate the result has the required structure
      if (!result.type || !result.componentConfig) {
        console.error("Invalid table format:", result);
        return null;
      }
      
      // Additional validation for table data
      const config = result.componentConfig;
      
      if (!config.data || !Array.isArray(config.data) || config.data.length === 0) {
        console.error("Table data is empty or invalid");
        return null;
      }
      
      if (!config.columns || !Array.isArray(config.columns) || config.columns.length === 0) {
        console.error("Table columns are missing or invalid");
        
        // Try to auto-generate columns from the first data item
        const firstItem = config.data[0];
        if (firstItem && typeof firstItem === 'object') {
          config.columns = Object.keys(firstItem).map(key => ({
            key,
            header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
            isNumeric: typeof firstItem[key] === 'number'
          }));
          
          console.log("Auto-generated columns:", config.columns);
        } else {
          return null;
        }
      }
      
      // Ensure we have a config object for colors
      if (!config.config) {
        config.config = {};
        
        // Auto-generate colors for columns
        config.columns.forEach((column: any, index: number) => {
          config.config[column.key] = {
            label: column.header,
            color: `hsl(var(--chart-${(index % 5) + 1}))`
          };
        });
      } else {
        // Fix color format if needed
        Object.entries(config.config).forEach(([key, value]) => {
          const configValue = value as any;
          if (configValue.color && configValue.color.startsWith('var(--color-')) {
            // Convert var(--color-X) to hsl(var(--chart-Y))
            const colorIndex = (Object.keys(config.config).indexOf(key) % 5) + 1;
            configValue.color = `hsl(var(--chart-${colorIndex}))`;
          }
        });
      }
      
      console.log("Table data suggestion:", JSON.stringify(result, null, 2));
      return result;
    } catch (e) {
      console.error("Failed to parse JSON response for table data:", e);
      console.error("Response content:", cleanedResponse);
      return null;
    }
  } catch (error) {
    console.error("Error getting table data suggestion:", error);
    return null;
  }
}

// API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        return res.status(500).json({ error: 'Failed to connect to Supabase' });
      }

      const { question, userId, chatId } = req.body;
      let connectionId = req.body.connectionId;

      console.log("API request received:", {
        question,
        userId,
        chatId,
        connectionId,
        headers: req.headers,
      });

      if (!question) {
        console.error("Missing required parameter: question");
        return res.status(400).json({ error: 'Question is required' });
      }

      if (!userId) {
        console.error("Missing required parameter: userId");
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Validate user and chat if provided
      if (userId && chatId) {
        console.log(`Validating chat access: userId=${userId}, chatId=${chatId}`);

        //log every record in the chats table first
        const { data: chats, error: chatsError } = await supabaseClient
          .from('chats')
          .select('*');

        console.log("All chats:", chats);

    
        
        // Verify the user has access to this chat
        const { data: chatData, error: chatError } = await supabaseClient
          .from('chats')
          .select('*')
          .eq('id', chatId)
          .eq('user_id', userId)
          .single();

        if (chatError) {
          console.error('Chat validation error:', chatError);
          return res.status(403).json({ error: 'Unauthorized access to chat' });
        }
        
        if (!chatData) {
          console.error(`No chat found with id=${chatId} for user=${userId}`);
          return res.status(403).json({ error: 'Chat not found for this user' });
        }
        
        console.log("Chat validation successful:", chatData);
      }

      // If connectionId is provided, verify the user has access to this connection
      if (userId && connectionId) {
        console.log(`Validating connection access: userId=${userId}, connectionId=${connectionId}`);
        
        const { data: connectionData, error: connectionError } = await supabaseClient
          .from('database_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', userId)
          .single();

        if (connectionError) {
          console.error('Connection validation error:', connectionError);
          return res.status(403).json({ error: 'Unauthorized access to connection' });
        }
        
        if (!connectionData) {
          console.error(`No connection found with id=${connectionId} for user=${userId}`);
          return res.status(403).json({ error: 'Connection not found for this user' });
        }
        
        console.log("Connection validation successful:", {
          id: connectionData.id,
          name: connectionData.display_name,
          host: connectionData.host,
          database: connectionData.dbname,
          username: connectionData.username,
          // Don't log the password, even if encrypted
        });
      }

      // If chatId is provided but connectionId is not, try to get the connection from the chat
      if (chatId && !connectionId) {
        console.log(`Fetching connection for chat: chatId=${chatId}`);
        
        const { data: chatConnectionData, error: chatConnectionError } = await supabaseClient
          .from('chat_connections')
          .select('connection_id')
          .eq('chat_id', chatId)
          .eq('user_id', userId)
          .single();

        if (chatConnectionError) {
          console.error('Error fetching connection for chat:', chatConnectionError);
        } else if (chatConnectionData) {
          console.log(`Found connection ${chatConnectionData.connection_id} for chat ${chatId}`);
          // Use let instead of const so that connectionId can be updated
          connectionId = chatConnectionData.connection_id;
        } else {
          console.error(`No connection found for chat ${chatId}`);
          return res.status(400).json({ error: 'No database connection associated with this chat' });
        }
      }

      // Process the question with the agent
      console.log(`Processing question with agent: question="${question}", userId=${userId}, chatId=${chatId}, connectionId=${connectionId}`);
      const response = await handleQuestion(question, userId, chatId, connectionId);
      
      return res.status(200).json(response);
    } catch (error) {
      console.error('Error processing question:', error);
      return res.status(500).json({ error: 'Failed to process question' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
