import { Tool } from "@langchain/core/tools";
import { PostgresNLQGenerator } from "../lib/nlq-postgres-generator";
import { PostgresQuery } from "../lib/postgres-query";

export class PostgresNLQTool extends Tool {
  name = "postgres_natural_language_query";
  description =
    "Useful for querying the database using natural language. Input should be a clear question or statement about the data.";

  private nlqGenerator: InstanceType<typeof PostgresNLQGenerator>;
  private queryExecutor: InstanceType<typeof PostgresQuery>;

  constructor() {
    super();
    this.nlqGenerator = new PostgresNLQGenerator();
    this.queryExecutor = new PostgresQuery();
  }

  private async _executeWithRetry(
    input: string,
    retryCount = 0
  ): Promise<string> {
    const MAX_RETRIES = 2;

    try {
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

      return `I encountered an error while processing your request: ${errorMessage}. Please try rephrasing your question.`;
    }
  }

  async _call(input: string): Promise<string> {
    return this._executeWithRetry(input);
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
