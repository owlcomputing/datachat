import { Tool } from "@langchain/core/tools";
import { SQLServerNLQGenerator } from "../lib/nlq-sqlserver-generator";
import { SQLServerQuery } from "../lib/sqlserver-query";

export class SQLServerNLQTool extends Tool {
  name = "sqlserver_natural_language_query";
  description =
    "Useful for querying SQL Server databases using natural language. Input should be a clear question or statement about the data.";

  private nlqGenerator: SQLServerNLQGenerator;
  private queryExecutor: SQLServerQuery;
  private userId: string | null = null;
  private chatId: string | null = null;
  private connectionId: string | null = null;

  constructor(userId: string | null = null, chatId: string | null = null, connectionId: string | null = null) {
    super();
    this.userId = userId;
    this.chatId = chatId;
    this.connectionId = connectionId;
    this.nlqGenerator = new SQLServerNLQGenerator(connectionId);
    this.queryExecutor = new SQLServerQuery();
  }

  private async _executeWithRetry(
    input: string,
    retryCount = 0
  ): Promise<string> {
    const MAX_RETRIES = 2;

    try {
      // Initialize the database connection if needed
      if (this.userId && (this.chatId || this.connectionId)) {
        try {
          // If connectionId is provided, use it directly
          if (this.connectionId) {
            await this.queryExecutor.initializeConnection(this.userId, this.connectionId);
            this.nlqGenerator.setConnectionId(this.connectionId);
          } 
          // Otherwise, try to get the connection from the chat
          else if (this.chatId) {
            const connectionId = await this.queryExecutor.getConnectionForChat(this.userId, this.chatId);
            if (connectionId) {
              await this.queryExecutor.initializeConnection(this.userId, connectionId);
              this.nlqGenerator.setConnectionId(connectionId);
              this.connectionId = connectionId;
            } else {
              console.error("No connection found for this chat");
              return "No SQL Server database connection found for this chat. Please set up a connection first.";
            }
          }
        } catch (error) {
          console.error("Error initializing database connection:", error);
          return `Error connecting to SQL Server database: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        console.error("Missing userId or connectionId/chatId");
        return "Missing user information or database connection details.";
      }

      // Generate SQL query from natural language
      console.log(`Generating SQL Server query for: "${input}"`);
      const { query, explanation } = await this.nlqGenerator.generateSQLQuery(input);
      
      if (!query || query.startsWith('--')) {
        console.error("Failed to generate SQL query:", query);
        return `I couldn't generate a SQL Server query for your question. ${explanation}`;
      }

      // Clean up the query - remove any remaining markdown formatting
      const cleanedQuery = query.replace(/```sql\s*|\s*```/gi, '').replace(/`/g, '');
      
      console.log("Generated SQL Server query:", cleanedQuery);
      console.log("Query explanation:", explanation);

      // Execute the query
      console.log("Executing SQL Server query...");
      const results = await this.queryExecutor.executeQuery(cleanedQuery);
      
      // Format the results
      let formattedResults: string;
      
      if (!results || results.length === 0) {
        formattedResults = "No results found.";
      } else {
        // Convert results to string with proper formatting
        try {
          formattedResults = JSON.stringify(results, null, 2);
        } catch (error) {
          console.error("Error stringifying results:", error);
          formattedResults = "Error formatting results.";
        }
      }

      // Combine everything into a response
      const response = {
        query: cleanedQuery,
        explanation,
        results: formattedResults,
      };

      return JSON.stringify(response);
    } catch (error) {
      console.error(`Error in SQL Server NLQ tool (attempt ${retryCount + 1}):`, error);
      
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        return this._executeWithRetry(input, retryCount + 1);
      }
      
      return `Error processing your request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async _call(input: string): Promise<string> {
    return this._executeWithRetry(input);
  }

  setContext(userId: string, chatId: string) {
    this.userId = userId;
    this.chatId = chatId;
  }

  setConnectionId(connectionId: string) {
    this.connectionId = connectionId;
    this.nlqGenerator.setConnectionId(connectionId);
  }
} 