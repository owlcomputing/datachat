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
        "You are a specialized database interaction and data visualization chatbot. Your primary purpose is to answer questions based on the data in the database and provide visualizations when appropriate. Assume all questions relate to the database. If you determine a question does not relate to the database, respond with 'I'm sorry, I don't know how to answer that.' You will: \n\n" +
        "- Query the database to retrieve relevant information.\n" +
        "- Perform calculations (e.g., averages, sums, counts) on the data as needed to answer the user's question.\n" +
        "- Present the results clearly and concisely.\n" +
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
        "4. Structure your response to include a summary, followed by detailed data that can be presented in tables and/or charts.\n\n" +
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

  console.log("Processing question:", userInput);
  
  const result = await agentExecutor.invoke({
    input: userInput,
  });

  console.log("Raw agent response:", result);

  // Clean the output to make it more readable in markdown
  const cleanedOutput = result.output
    .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
    .replace(/\\"/g, '"');  // Replace escaped quotes with actual quotes
  
  // Get graph type suggestion from LLM
  const visualization = await suggestGraphType(cleanedOutput, userInput);
  
  // Get table data suggestion from LLM
  const tableData = await suggestTableData(cleanedOutput, userInput);
  
  const finalResponse = {
    answer: cleanedOutput,
    visualization: visualization,
    tableData: tableData
  };
  
  console.log("Final response:", JSON.stringify(finalResponse, null, 2));
  
  return finalResponse;
}

async function suggestGraphType(data: string, originalQuery: string): Promise<any> {
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

async function suggestTableData(data: string, originalQuery: string): Promise<any> {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { message, userId, displayName } = req.body;
    console.log(`Received request from user ${userId} (${displayName}): "${message}"`);

    if (!agentExecutor) {
      console.log("Initializing agent...");
      await initializeAgent();
    }

    try {
      const result = await handleQuestion(message);
      console.log("Sending response to client");
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
