import pg from "pg";

export class PostgresQuery {
  private pool: pg.Pool;

  constructor() {
    const config: pg.PoolConfig = {
      database: process.env.POSTGRES_DBNAME,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || "5432"),
      // Pool configuration
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

    // Only add SSL if not in development
    if (process.env.NODE_ENV !== "development") {
      config.ssl = {
        rejectUnauthorized: false,
      };
    }

    this.pool = new pg.Pool(config);

    // Handle pool errors
    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  async executeQuery<T>(query: string, params?: string[]): Promise<T[]> {
    let client;
    try {
      client = await this.pool.connect();
      const result = await client.query(query, params);
      return result.rows as T[];
    } catch (error) {
      console.error("Database query error:", error);
      // Return empty array instead of throwing
      return [] as T[];
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// // Manual testing
// if (import.meta.url === new URL(import.meta.url).href) {
//   const query = new PostgresQuery();
//   const result = await query.executeQuery("SELECT * FROM players LIMIT 10");
//   console.log(result);
// }
