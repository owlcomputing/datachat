import { Tool } from "@langchain/core/tools";
import { PostgresNLQGenerator } from "../lib/nlq-postgres-generator";
import { PostgresQuery } from "../lib/postgres-query";

export class PostgresNLQTool extends Tool {
  name = "postgres_natural_language_query";
  description =
    "Useful for querying the database using natural language. Input should be a clear question or statement about the data.";

  private nlqGenerator: InstanceType<typeof PostgresNLQGenerator>;
  private queryExecutor: InstanceType<typeof PostgresQuery>;
  private userId: string | null = null;
  private chatId: string | null = null;
  private connectionId: string | null = null;

  constructor(userId: string | null = null, chatId: string | null = null, connectionId: string | null = null) {
    super();
    this.userId = userId;
    this.chatId = chatId;
    this.connectionId = connectionId;
    this.nlqGenerator = new PostgresNLQGenerator(connectionId);
    this.queryExecutor = new PostgresQuery();
  }

  private async _executeWithRetry(
    input: string,
    retryCount = 0
  ): Promise<string> {
    const MAX_RETRIES = 2;

    try {
      // Initialize the database connection if needed
      if (this.userId && (this.chatId || this.connectionId)) {
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
            return "No database connection found for this chat. Please set up a connection first.";
          }
        }
      }

      // Generate SQL query from natural language
      const sqlQuery = await this.nlqGenerator.generateQuery(
        input,
        retryCount > 0
          ? `Previous query failed. Please try a different approach.`
          : undefined
      );
      console.log(`SQL Query (attempt ${retryCount + 1}):`, sqlQuery);

      // Execute the query
      const results = await this.queryExecutor.executeQuery(sqlQuery);
      console.log("Postgres results:", results);

      if (!results || results.length === 0) {
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying query (attempt ${retryCount + 1})`);
          return this._executeWithRetry(input, retryCount + 1);
        }
        return "No results found for your query. Please try rephrasing your question or check if the data you're looking for exists in the database.";
      }

      // Convert results to a readable string and include the SQL query
      const response = {
        results,
        sqlQuery
      };
      console.log("Returning response with SQL query:", response);
      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Tool execution error:", errorMessage);

      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying after error (attempt ${retryCount + 1})`);
        return this._executeWithRetry(input, retryCount + 1);
      }

      return `I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question.`;
    }
  }

  async _call(input: string): Promise<string> {
    return this._executeWithRetry(input);
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

// // Manual testing
// if (import.meta.url === new URL(import.meta.url).href) {
//   const tool = new PostgresNLQTool();

//   (async () => {
//     try {
//       const prompt = "Who is the tallest player?";
//       console.log("Prompt:", prompt);
//       const result = await tool._call(prompt);
//       console.log("Result:", result);
//     } catch (error) {
//       console.error("Error:", error);
//     }
//   })();
// }
