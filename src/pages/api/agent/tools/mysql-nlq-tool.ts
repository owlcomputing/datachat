import { Tool } from "@langchain/core/tools";
import { MySQLNLQGenerator } from "../lib/nlq-mysql-generator";
import { MySQLQuery } from "../lib/mysql-query";

export class MySQLNLQTool extends Tool {
  name = "mysql_natural_language_query";
  description =
    "Useful for querying MySQL databases using natural language. Input should be a clear question or statement about the data.";

  private nlqGenerator: MySQLNLQGenerator;
  private queryExecutor: MySQLQuery;
  private userId: string | null = null;
  private chatId: string | null = null;
  private connectionId: string | null = null;

  constructor(userId: string | null = null, chatId: string | null = null, connectionId: string | null = null) {
    super();
    this.userId = userId;
    this.chatId = chatId;
    this.connectionId = connectionId;
    this.nlqGenerator = new MySQLNLQGenerator(connectionId);
    this.queryExecutor = new MySQLQuery();
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
              return "No MySQL database connection found for this chat. Please set up a connection first.";
            }
          }
        } catch (connectionError) {
          console.error("Error initializing MySQL connection:", connectionError);
          return `Failed to connect to the MySQL database: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`;
        }
      }

      // Generate SQL query from natural language
      let sqlQuery;
      try {
        sqlQuery = await this.nlqGenerator.generateQuery(
          input,
          retryCount > 0
            ? `Previous query failed. Please try a different approach.`
            : undefined
        );
        console.log(`MySQL SQL Query (attempt ${retryCount + 1}):`, sqlQuery);
      } catch (queryGenError) {
        console.error("Error generating MySQL query:", queryGenError);
        
        // If we're already retrying, give up and return an error
        if (retryCount > 0) {
          return `I couldn't generate a valid MySQL query: ${queryGenError instanceof Error ? queryGenError.message : String(queryGenError)}`;
        }
        
        // Otherwise, try again with a more generic approach
        console.log("Retrying with a more generic approach");
        return this._executeWithRetry(`Get information about ${input}`, retryCount + 1);
      }

      // Execute the query
      let results;
      try {
        results = await this.queryExecutor.executeQuery(sqlQuery);
        console.log("MySQL results:", results);
      } catch (queryExecError) {
        console.error("Error executing MySQL query:", queryExecError);
        
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying after query execution error (attempt ${retryCount + 1})`);
          return this._executeWithRetry(input, retryCount + 1);
        }
        
        return `I encountered an error executing the MySQL query: ${queryExecError instanceof Error ? queryExecError.message : String(queryExecError)}`;
      }

      if (!results || results.length === 0) {
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying query due to empty results (attempt ${retryCount + 1})`);
          return this._executeWithRetry(input, retryCount + 1);
        }
        return "No results found for your query. Please try rephrasing your question or check if the data you're looking for exists in the database.";
      }

      // Convert results to a readable string
      return JSON.stringify(results, null, 2);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Tool execution error:", errorMessage);

      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying after error (attempt ${retryCount + 1})`);
        return this._executeWithRetry(input, retryCount + 1);
      }

      return `I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question or check your database connection.`;
    }
  }

  async _call(input: string): Promise<string> {
    try {
      return await this._executeWithRetry(input);
    } catch (error) {
      console.error("MySQL NLQ tool error:", error);
      
      // Provide a helpful response when the tool fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a query generation error
      if (errorMessage.includes("Failed to generate MySQL SQL query")) {
        return `I'm having trouble generating a SQL query for your question. This might be because I don't have enough information about your database schema. Could you try asking a more specific question about your data?`;
      }
      
      // Check if this is a connection error
      if (errorMessage.includes("Failed to connect") || errorMessage.includes("connection not initialized")) {
        return `I'm having trouble connecting to your MySQL database. Please check your database connection settings and try again.`;
      }
      
      // Generic error response
      return `I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question or check your database connection.`;
    }
  }

  // Set user and chat IDs
  setContext(userId: string, chatId: string) {
    this.userId = userId;
    this.chatId = chatId;
  }

  // Set connection ID directly
  setConnectionId(connectionId: string) {
    this.connectionId = connectionId;
    this.nlqGenerator.setConnectionId(connectionId);
  }
} 