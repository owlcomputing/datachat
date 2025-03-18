import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import defaultSchema, { getSchemaForConnection } from "./schema";

export class MySQLNLQGenerator {
  private model: ChatGoogleGenerativeAI;
  private connectionId: string | null = null;

  constructor(connectionId: string | null = null) {
    this.model = new ChatGoogleGenerativeAI({
      modelName: process.env.GEMINI_API_MODEL,
      apiKey: process.env.GEMINI_API_KEY,
    });

    this.connectionId = connectionId;
  }

  async generateQuery(naturalLanguageQuery: string, errorContext?: string): Promise<string> {
    try {
      console.log("Generating MySQL SQL query for:", naturalLanguageQuery);
      
      // Build the prompt parts
      const basePrompt = `You are a SQL Expert. Generate only valid MySQL SQL statements in response to the user's prompt. Your responses should be purely in SQL, directly related to the user's prompt.`;

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

   NEVER SELECT EXCLUSIVELY ID FIELDS, ALWAYS SELECT AN ASSOCIATED FIELD THAT IS MORE READABLE AND MEANINGFUL.

Always return fields that would be relevant for the axes of charts.
Use clear, consistent naming for fields that will be used in visualizations.`;

      const mysqlSpecificGuidance = `
Remember to use MySQL-specific syntax:
- Use backticks (\`) for table and column names if they contain spaces or are reserved words
- Use LIMIT instead of FETCH FIRST ... ROWS ONLY
- Use DATE_FORMAT() for date formatting instead of TO_CHAR()
- Use CONCAT() for string concatenation instead of ||
- Use IFNULL() instead of COALESCE() when appropriate
- Use NOW() instead of CURRENT_TIMESTAMP when appropriate
- Use GROUP_CONCAT() instead of STRING_AGG()
- Use SUBSTRING() instead of SUBSTR() for better compatibility
- Use UNIX_TIMESTAMP() for working with Unix timestamps
- Use CAST() or CONVERT() for type conversions
- Use JSON_EXTRACT() for working with JSON data
- Remember that MySQL uses different window function syntax than PostgreSQL
- Use REGEXP instead of SIMILAR TO for pattern matching
- Use STRAIGHT_JOIN hint for optimizing complex joins when necessary`;

      const errorPrompt = errorContext
        ? `Previous attempt failed with error: ${errorContext}. Please generate a corrected SQL query that addresses this error.`
        : "";

      // Get schema information
      let schemaText = "";
      
      if (this.connectionId) {
        try {
          const schemaData = await getSchemaForConnection(this.connectionId);
          console.log(`Using schema for connection ID: ${this.connectionId}`);
          
          if (Array.isArray(schemaData) && schemaData.length > 0) {
            schemaText = JSON.stringify(schemaData, null, 2);
          } else {
            console.warn("Schema data is empty or invalid");
            schemaText = `
No schema information is available. Please generate a query based on common MySQL database patterns.
For "accounts" or "users", assume fields like id, name, email, created_at, etc.
For "orders" or "transactions", assume fields like id, user_id, amount, status, created_at, etc.
For "products", assume fields like id, name, price, category, etc.
Use your best judgment based on the query.`;
          }
        } catch (schemaError) {
          console.error("Error fetching schema:", schemaError);
          schemaText = `
No schema information is available. Please generate a query based on common MySQL database patterns.
For "accounts" or "users", assume fields like id, name, email, created_at, etc.
For "orders" or "transactions", assume fields like id, user_id, amount, status, created_at, etc.
For "products", assume fields like id, name, price, category, etc.
Use your best judgment based on the query.`;
        }
      } else {
        console.log("Using default schema");
        schemaText = `
No schema information is available. Please generate a query based on common MySQL database patterns.
For "accounts" or "users", assume fields like id, name, email, created_at, etc.
For "orders" or "transactions", assume fields like id, user_id, amount, status, created_at, etc.
For "products", assume fields like id, name, price, category, etc.
Use your best judgment based on the query.`;
      }

      // Combine all parts into a single prompt string
      const fullPrompt = `${basePrompt}

${visualizationGuidance}

${mysqlSpecificGuidance}

${errorPrompt}

Schema information:
${schemaText}

User Prompt: ${naturalLanguageQuery}

IMPORTANT: Format your response as a valid MySQL SQL query only. Do not include any explanations or markdown formatting.
If you don't have enough information to generate a specific query, make a reasonable guess based on the user's request.
For example, if the user asks for "top accounts", you might return "SELECT id, name, email FROM accounts ORDER BY created_at DESC LIMIT 5;"`;

      // Send the prompt to the model
      console.log("Sending MySQL SQL generation prompt to LLM");
      const response = await this.model.invoke(fullPrompt);
      const sql = this.extractSQL(response.content.toString());

      if (!sql) {
        throw new Error("Failed to generate valid MySQL SQL query");
      }

      console.log("Generated MySQL SQL query:", sql);
      return sql;
    } catch (error) {
      console.error("MySQL SQL generation error:", error);
      
      // Provide a fallback query for common requests when generation fails
      const query = naturalLanguageQuery.toLowerCase();
      
      // Account/customer related queries
      if ((query.includes("top") || query.includes("best") || query.includes("highest")) && 
          (query.includes("account") || query.includes("user"))) {
        const fallbackQuery = "SELECT id, name, email, created_at FROM accounts ORDER BY created_at DESC LIMIT 5;";
        console.log("Using fallback query:", fallbackQuery);
        return fallbackQuery;
      }
      
      // Customer with highest invoice/order value
      if ((query.includes("highest") || query.includes("top") || query.includes("most")) &&
          query.includes("customer") && 
          (query.includes("invoice") || query.includes("order") || query.includes("purchase") || query.includes("total"))) {
        const fallbackQuery = "SELECT c.id, c.name, c.email, SUM(i.amount) as total_amount FROM customers c JOIN invoices i ON c.id = i.customer_id GROUP BY c.id, c.name, c.email ORDER BY total_amount DESC LIMIT 5;";
        console.log("Using fallback query:", fallbackQuery);
        return fallbackQuery;
      }
      
      // Product related queries
      if ((query.includes("top") || query.includes("best") || query.includes("popular")) && 
          (query.includes("product") || query.includes("item"))) {
        const fallbackQuery = "SELECT id, name, price, SUM(quantity) as total_sold FROM products JOIN order_items ON products.id = order_items.product_id GROUP BY products.id, products.name, products.price ORDER BY total_sold DESC LIMIT 5;";
        console.log("Using fallback query:", fallbackQuery);
        return fallbackQuery;
      }
      
      // Sales/revenue related queries
      if (query.includes("sales") || query.includes("revenue") || query.includes("income")) {
        if (query.includes("month") || query.includes("monthly")) {
          const fallbackQuery = "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as total_sales FROM invoices GROUP BY month ORDER BY month DESC LIMIT 12;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
        
        if (query.includes("year") || query.includes("yearly") || query.includes("annual")) {
          const fallbackQuery = "SELECT YEAR(created_at) as year, SUM(amount) as total_sales FROM invoices GROUP BY year ORDER BY year DESC;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
        
        // Default sales query
        const fallbackQuery = "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, SUM(amount) as daily_sales FROM invoices GROUP BY date ORDER BY date DESC LIMIT 30;";
        console.log("Using fallback query:", fallbackQuery);
        return fallbackQuery;
      }
      
      // Count/total queries
      if (query.includes("how many") || query.includes("count") || query.includes("total number")) {
        if (query.includes("customer") || query.includes("client")) {
          const fallbackQuery = "SELECT COUNT(*) as total_customers FROM customers;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
        
        if (query.includes("product") || query.includes("item")) {
          const fallbackQuery = "SELECT COUNT(*) as total_products FROM products;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
        
        if (query.includes("order") || query.includes("invoice")) {
          const fallbackQuery = "SELECT COUNT(*) as total_orders FROM orders;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
      }
      
      // Recent activity queries
      if (query.includes("recent") || query.includes("latest") || query.includes("last")) {
        if (query.includes("order") || query.includes("purchase")) {
          const fallbackQuery = "SELECT id, customer_id, amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
        
        if (query.includes("customer") || query.includes("client")) {
          const fallbackQuery = "SELECT id, name, email, created_at FROM customers ORDER BY created_at DESC LIMIT 10;";
          console.log("Using fallback query:", fallbackQuery);
          return fallbackQuery;
        }
      }
      
      // Schema exploration queries
      if (query.includes("schema") || query.includes("table") || query.includes("column") || query.includes("field") || query.includes("structure")) {
        const fallbackQuery = "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position LIMIT 20;";
        console.log("Using fallback query:", fallbackQuery);
        return fallbackQuery;
      }
      
      // Generic fallback for when we can't determine a specific query
      const genericFallback = "SELECT 'Please provide more specific information about your database schema' as message;";
      console.log("Using generic fallback query:", genericFallback);
      return genericFallback;
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

  // Set the connection ID
  setConnectionId(connectionId: string | null) {
    this.connectionId = connectionId;
  }
} 