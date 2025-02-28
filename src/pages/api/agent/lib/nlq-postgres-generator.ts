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
      const basePrompt = `You are a SQL Expert. Use the following data to generate only valid postgres SQL statements in response to any questions I ask. Your responses should be purely in SQL, directly related to the user's prompt.`;

      const errorPrompt = errorContext
        ? `
        Previous attempt failed with error: ${errorContext}
        Please generate a corrected SQL query that addresses this error.
        always return fields that would be relevant for the axes of charts as well.
      `
        : "";

      this.promptTemplate = PromptTemplate.fromTemplate(`
        ${basePrompt}
        ${errorPrompt}
        Here is the schema:
        {schema}
        
        User Prompt: {query}
      `);

      const formattedPrompt = await this.promptTemplate.format({
        schema: schema,
        query: naturalLanguageQuery,
      });

      const response = await this.model.invoke(formattedPrompt);
      const sql = this.extractSQL(response.content.toString());

      if (!sql) {
        throw new Error("Failed to generate valid SQL query");
      }

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
    const match = responseText.match(/```(?:sql)?\n([\s\S]*?)\n```/);
    return match ? match[1].trim() : responseText.trim();
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
