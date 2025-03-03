import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import schema from "./schema";

export const PostgresNLQGenerator = class {
  private model: ChatGoogleGenerativeAI;
  private promptTemplate: PromptTemplate;

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      modelName: process.env.GEMINI_API_MODEL,
      apiKey: process.env.GEMINI_API_KEY,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(`
      You are a SQL Expert. Use the following data to generate only valid postgres SQL statements in response to any questions I ask. Your responses should be purely in SQL, directly related to the user's prompt. Here is the user's prompt:
      
      {schema}
      
      User Prompt: {query}

    `);
  }

  async generateQuery(naturalLanguageQuery: string, errorContext?: string) {
    try {
      console.log("Generating SQL query for:", naturalLanguageQuery);
      
      const basePrompt = `You are a SQL Expert. Use the following data to generate only valid postgres SQL statements in response to any questions I ask. Your responses should be purely in SQL, directly related to the user's prompt.`;

      const visualizationGuidance = `
        When generating SQL queries, consider how the data will be visualized:
        
        1. For time-series data (LINE or AREA charts):
           - Include date/time fields (formatted consistently)
           - Include relevant metrics that change over time
           - Limit to a reasonable number of data points (e.g., 10-20)
           - Order by date/time
           - Format dates consistently (e.g., YYYY-MM-DD)
           - Ensure date fields are named clearly (e.g., game_date, month, year)
        
        2. For categorical comparisons (BAR charts):
           - Include category names and corresponding values
           - Limit to top N categories if there are many
           - Order by values for better visualization
           - Use descriptive names for categories
           - Ensure category fields are named clearly (e.g., team_name, player_name)
        
        3. For aggregated data:
           - Group by relevant dimensions
           - Calculate appropriate aggregates (sum, avg, count, etc.)
           - Include both the dimension and the measure
           - Use aliases for calculated fields (e.g., AVG(points) AS avg_points)
        
        4. For part-to-whole relationships (PIE charts):
           - Include category names and their proportions
           - Calculate percentages if appropriate
           - Limit to major categories (group small ones as "Other")
           - Ensure data has 'name' and 'value' fields for pie charts
           - Example: SELECT team_name AS name, COUNT(*) AS value FROM ...
        
        5. For single metrics (RADIAL charts):
           - Calculate a single important metric
           - Include context (e.g., compared to average, goal, etc.)
           - Format as numeric values
           - Example: SELECT AVG(field_goal_percentage) AS value FROM ...
        
        Always return fields that would be relevant for the axes of charts.
        Use clear, consistent naming for fields that will be used in visualizations.
      `;

      const errorPrompt = errorContext
        ? `
        Previous attempt failed with error: ${errorContext}
        Please generate a corrected SQL query that addresses this error.
        always return fields that would be relevant for the axes of charts as well.
      `
        : "";

      this.promptTemplate = PromptTemplate.fromTemplate(`
        ${basePrompt}
        ${visualizationGuidance}
        ${errorPrompt}
        Here is the schema:
        {schema}
        
        User Prompt: {query}
        
        IMPORTANT: Format your response as a valid SQL query only. Do not include any explanations or markdown formatting.
      `);

      const formattedPrompt = await this.promptTemplate.format({
        schema: schema,
        query: naturalLanguageQuery,
      });

      console.log("Sending SQL generation prompt to LLM");
      const response = await this.model.invoke(formattedPrompt);
      const sql = this.extractSQL(response.content.toString());

      if (!sql) {
        throw new Error("Failed to generate valid SQL query");
      }

      console.log("Generated SQL query:", sql);
      return sql;
    } catch (error) {
      console.error("SQL generation error:", error);
      throw new Error(
        `Failed to generate SQL query: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private extractSQL(responseText: string): string {
    // First try to extract SQL from code blocks
    const match = responseText.match(/```(?:sql)?\n([\s\S]*?)\n```/);
    if (match) {
      return match[1].trim();
    }
    
    // If no code blocks, try to extract just the SQL statement
    // Look for common SQL keywords at the beginning of lines
    const sqlKeywords = ['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
    const lines = responseText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      for (const keyword of sqlKeywords) {
        if (trimmedLine.toUpperCase().startsWith(keyword)) {
          // Found a line that starts with an SQL keyword
          return responseText.trim();
        }
      }
    }
    
    // If we can't find any SQL keywords, just return the trimmed text
    return responseText.trim();
  }
};

// // Manual testing
// if (import.meta.url === new URL(import.meta.url).href) {
//   console.log("Environment variables:", {
//     GEMINI_API_KEY: process.env.GEMINI_API_KEY,
//     GEMINI_API_MODEL: process.env.GEMINI_API_MODEL,
//   });

//   (async () => {
//     const nlq = new PostgresNLQGenerator();

//     // Test different queries
//     const queries = ["Who is the tallest player?"];

//     for (const query of queries) {
//       console.log("\n-------------------");
//       console.log("Input:", query);
//       const result = await nlq.generateQuery(query);
//       console.log(result);
//     }
//   })();
// }
