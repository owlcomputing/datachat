import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createClient } from "@supabase/supabase-js";

export class SQLServerNLQGenerator {
  private model: ChatGoogleGenerativeAI;
  private supabaseClient: any;
  private connectionId: string | null = null;

  constructor(connectionId: string | null = null) {
    this.connectionId = connectionId;
    this.model = new ChatGoogleGenerativeAI({
      modelName: process.env.GEMINI_API_MODEL,
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Initialize Supabase client
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }

  setConnectionId(connectionId: string) {
    this.connectionId = connectionId;
  }

  async generateSQLQuery(
    naturalLanguageQuery: string
  ): Promise<{ query: string; explanation: string }> {
    if (!this.connectionId) {
      throw new Error("Connection ID not set");
    }

    try {
      // Fetch schema for this connection
      const { data: schemaData, error } = await this.supabaseClient
        .from("database_schemas")
        .select("schema_data")
        .eq("connection_id", this.connectionId)
        .single();

      if (error || !schemaData || !schemaData.schema_data) {
        console.error("Error fetching schema:", error?.message || "Schema not found");
        throw new Error("Database schema not found");
      }

      // Format schema for the prompt
      const schema = schemaData.schema_data;
      let schemaText = "Database Schema:\n";

      // Group by table
      const tableMap = new Map();
      for (const item of schema) {
        if (!tableMap.has(item.table_name)) {
          tableMap.set(item.table_name, []);
        }
        tableMap.get(item.table_name).push(item);
      }

      // Format tables and columns
      for (const [tableName, columns] of tableMap.entries()) {
        schemaText += `Table: ${tableName}\n`;
        schemaText += "Columns:\n";
        for (const column of columns) {
          schemaText += `- ${column.column_name} (${column.data_type})\n`;
        }
        schemaText += "\n";
      }

      // Generate SQL query using LLM
      const prompt = `You are a SQL expert specializing in Microsoft SQL Server. 
Your task is to convert natural language questions into valid SQL Server queries.

${schemaText}

Based on the schema above, write a SQL Server query to answer this question: "${naturalLanguageQuery}"

Important guidelines:
1. Use only tables and columns that exist in the schema.
2. Use SQL Server syntax (not MySQL or PostgreSQL).
3. Use proper SQL Server date/time functions if needed.
4. For pagination, use OFFSET-FETCH instead of LIMIT.
5. For string concatenation, use + operator or CONCAT() function.
6. For date/time operations, use DATEADD(), DATEDIFF(), etc.
7. For aggregations, make sure to include GROUP BY for all non-aggregated columns.
8. For TOP N queries, use TOP syntax.
9. For common table expressions, use WITH syntax.
10. For string comparisons, use LIKE with appropriate wildcards.
11. For NULL handling, use IS NULL or IS NOT NULL.
12. For CASE expressions, follow SQL Server syntax.
13. ALWAYS include descriptive and human-readable fields alongside ID fields in your SELECT statements. For example:
    - When selecting a customer ID, also include the customer name
    - When selecting a product ID, also include the product name or description
    - When selecting an order ID, include relevant details like date, status, or associated entity names
    - For any ID field, identify and include at least one descriptive field that helps users understand what the ID represents
    - Never return only ID fields in your results without accompanying descriptive fields

Return your response in this format:
SQL Query: <your SQL query>
Explanation: <brief explanation of what the query does>

If you cannot generate a valid query, explain why and provide guidance on what information would be needed.`;

      const response = await this.model.invoke(prompt);
      const responseText = response.content.toString();

      // Extract SQL query and explanation
      let query = "";
      let explanation = "";

      const sqlMatch = responseText.match(/SQL Query:([\s\S]+?)(?=Explanation:|$)/i);
      if (sqlMatch && sqlMatch[1]) {
        query = sqlMatch[1].trim();
        
        // Clean up markdown code blocks if present
        query = query.replace(/```sql\s*|\s*```/gi, '');
      }

      const explanationMatch = responseText.match(/Explanation:([\s\S]+?)(?=$)/i);
      if (explanationMatch && explanationMatch[1]) {
        explanation = explanationMatch[1].trim();
      }

      // If no query was extracted, use a fallback approach
      if (!query) {
        // Try to extract anything that looks like SQL - including markdown code blocks
        const codeBlockMatch = responseText.match(/```sql\s*([\s\S]+?)\s*```/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          query = codeBlockMatch[1].trim();
          explanation = "Generated query based on your request.";
        } else {
          // Try to find a SELECT statement
          const sqlPattern = /SELECT[\s\S]+?FROM[\s\S]+?/i;
          const fallbackMatch = responseText.match(sqlPattern);
          if (fallbackMatch) {
            query = fallbackMatch[0].trim();
            explanation = "Generated query based on your request.";
          } else {
            // If still no query, return an error message
            query = "-- Could not generate a valid SQL query";
            explanation = responseText || "Could not generate a valid SQL query for your request.";
          }
        }
      }

      return { query, explanation };
    } catch (error) {
      console.error("Error generating SQL query:", error);
      return {
        query: "-- Error generating SQL query",
        explanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
} 