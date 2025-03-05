import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

interface ConnectionConfig {
  database: string;
  user: string;
  password: string;
  host: string;
  port: number;
  ssl?: {
    rejectUnauthorized: boolean;
  };
}

export class MySQLQuery {
  private pool: mysql.Pool | null = null;
  private connectionId: string | null = null;
  private supabaseClient: any;
  private databaseName: string | null = null; // Store database name separately

  constructor() {
    // Initialize Supabase client
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }

  // Initialize connection based on connection ID
  async initializeConnection(userId: string, connectionId: string): Promise<void> {
    console.log(`Initializing MySQL connection: userId=${userId}, connectionId=${connectionId}`);
    
    // Close existing connection if it exists
    if (this.pool) {
      console.log("Closing existing connection pool");
      await this.close();
    }

    try {
      // Fetch connection details from database_connections table
      console.log("Fetching connection details from database");
      const { data: connectionData, error } = await this.supabaseClient
        .from('database_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error("Error fetching connection details:", error);
        throw new Error(`Connection not found: ${error.message}`);
      }
      
      if (!connectionData) {
        console.error(`No connection found with id=${connectionId} for user=${userId}`);
        throw new Error("Connection not found for this user");
      }

      console.log("Connection details retrieved:", {
        id: connectionData.id,
        name: connectionData.display_name,
        host: connectionData.host,
        database: connectionData.dbname,
        username: connectionData.username,
        dialect: connectionData.dialect,
      });

      // Verify this is a MySQL connection
      if (connectionData.dialect !== 'mysql') {
        throw new Error(`Connection is not MySQL: ${connectionData.dialect}`);
      }

      // Store database name for later use
      this.databaseName = connectionData.dbname;

      // Create connection config
      const config: mysql.PoolOptions = {
        database: connectionData.dbname,
        user: connectionData.username,
        password: connectionData.password,
        host: connectionData.host,
        port: connectionData.port,
        // Pool configuration
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };

      // Only add SSL if not in development
      if (process.env.NODE_ENV !== "development") {
        config.ssl = {
          rejectUnauthorized: false,
        };
        console.log("Added SSL configuration for non-development environment");
      }

      console.log("Creating MySQL connection pool with config:", {
        database: config.database,
        user: config.user,
        host: config.host,
        port: config.port,
      });

      // Create new pool with the connection details
      this.pool = mysql.createPool(config);
      this.connectionId = connectionId;

      // Test the connection
      console.log("Testing MySQL database connection");
      try {
        const [rows] = await this.pool.query('SELECT 1');
        console.log("MySQL connection test successful");
      } catch (testError) {
        console.error("MySQL connection test failed:", testError);
        throw new Error(`Failed to connect to MySQL database: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      console.log(`Successfully initialized connection to MySQL database: ${connectionData.display_name}`);

      // Check if we need to fetch the schema
      await this.ensureSchemaExists(userId, connectionId);
    } catch (error) {
      console.error("Error initializing MySQL connection:", error);
      throw error;
    }
  }

  // Ensure schema exists for this connection
  private async ensureSchemaExists(userId: string, connectionId: string): Promise<void> {
    try {
      // Check if schema exists
      const { data: schemaData, error } = await this.supabaseClient
        .from('database_schemas')
        .select('*')
        .eq('connection_id', connectionId)
        .single();

      // If schema doesn't exist, fetch it
      if (error || !schemaData) {
        console.log("Schema not found, fetching from MySQL database...");
        
        if (!this.pool || !this.databaseName) {
          throw new Error("Database connection not initialized or database name not available");
        }
        
        // Execute schema query - MySQL version
        const schemaQuery = `
          SELECT 
            TABLE_NAME as table_name, 
            COLUMN_NAME as column_name, 
            DATA_TYPE as data_type 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `;
        
        // Use the stored database name instead of trying to access it through pool.config
        const [schemaResult] = await this.pool.query(schemaQuery, [this.databaseName]);
        
        // Store schema in database_schemas table
        const { error: insertError } = await this.supabaseClient
          .from('database_schemas')
          .insert([{
            connection_id: connectionId,
            schema: schemaResult,
            schema_data: schemaResult,
            user_id: userId
          }]);

        if (insertError) {
          console.error("Error storing schema:", insertError);
        } else {
          console.log("Schema stored successfully");
        }
      } else {
        console.log("Schema already exists for this connection");
      }
    } catch (error) {
      console.error("Error ensuring schema exists:", error);
    }
  }

  // Get connection ID for a chat
  async getConnectionForChat(userId: string, chatId: string): Promise<string | null> {
    try {
      // Fetch connection ID from chat_connections table
      const { data, error } = await this.supabaseClient
        .from('chat_connections')
        .select('connection_id')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        console.error("Error fetching connection for chat:", error?.message || 'No connection found');
        return null;
      }

      return data.connection_id;
    } catch (error) {
      console.error("Error getting connection for chat:", error);
      return null;
    }
  }

  // Execute query with the current connection
  async executeQuery<T>(query: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error("MySQL database connection not initialized");
    }

    try {
      // Check if the query is a comment-only query (which happens when the LLM can't generate a proper query)
      if (query.trim().startsWith('--') && !query.includes('SELECT') && !query.includes('select')) {
        console.warn("Query appears to be comment-only, returning empty result:", query);
        return [] as T[];
      }

      const [rows] = await this.pool.query(query, params || []);
      return rows as T[];
    } catch (error) {
      console.error("MySQL database query error:", error);
      // Return empty array instead of throwing to match PostgresQuery behavior
      return [] as T[];
    }
  }

  // Close the connection pool
  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        this.connectionId = null;
        this.databaseName = null; // Clear the database name
        console.log("MySQL connection pool closed");
      } catch (error) {
        console.error("Error closing MySQL connection pool:", error);
      }
    }
  }
} 