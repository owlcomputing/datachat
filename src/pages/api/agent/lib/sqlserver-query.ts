import { ConnectionPool, Request } from 'mssql';
import { createClient } from '@supabase/supabase-js';

interface ConnectionConfig {
  database: string;
  user: string;
  password: string;
  server: string;
  port: number;
  options?: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export class SQLServerQuery {
  private pool: ConnectionPool | null = null;
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
    console.log(`Initializing SQL Server connection: userId=${userId}, connectionId=${connectionId}`);
    
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

      // Verify this is a SQL Server connection
      if (connectionData.dialect !== 'sqlserver') {
        throw new Error(`Connection is not SQL Server: ${connectionData.dialect}`);
      }

      // Store database name for later use
      this.databaseName = connectionData.dbname;

      // Create connection config
      const config: ConnectionConfig = {
        database: connectionData.dbname,
        user: connectionData.username,
        password: connectionData.password,
        server: connectionData.host,
        port: connectionData.port || 1433, // Default SQL Server port
        options: {
          encrypt: true, // For Azure
          trustServerCertificate: process.env.NODE_ENV === "development" // For local dev / self-signed certs
        }
      };

      console.log("Creating SQL Server connection pool with config:", {
        database: config.database,
        user: config.user,
        server: config.server,
        port: config.port,
      });

      // Create new pool with the connection details
      this.pool = new ConnectionPool(config);
      this.connectionId = connectionId;

      // Test the connection
      console.log("Testing SQL Server database connection");
      try {
        await this.pool.connect();
        console.log("SQL Server connection test successful");
      } catch (testError) {
        console.error("SQL Server connection test failed:", testError);
        throw new Error(`Failed to connect to SQL Server database: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      console.log(`Successfully initialized connection to SQL Server database: ${connectionData.display_name}`);

      // Check if we need to fetch the schema
      await this.ensureSchemaExists(userId, connectionId);
    } catch (error) {
      console.error("Error initializing SQL Server connection:", error);
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
        console.log("Schema not found, fetching from SQL Server database...");
        
        if (!this.pool || !this.databaseName) {
          throw new Error("Database connection not initialized or database name not available");
        }
        
        // Execute schema query - SQL Server version
        const schemaQuery = `
          SELECT 
            TABLE_NAME as table_name, 
            COLUMN_NAME as column_name, 
            DATA_TYPE as data_type,
            CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as is_nullable,
            CASE WHEN COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA + '.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') = 1 THEN 1 ELSE 0 END as is_identity,
            CHARACTER_MAXIMUM_LENGTH as max_length
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_CATALOG = @dbName
            AND TABLE_SCHEMA = 'dbo'  -- Default schema, can be parameterized if needed
          ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `;
        
        // Use the stored database name
        const schemaResult = await this.executeQuery(schemaQuery, [this.databaseName]);
        
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
      throw new Error("SQL Server database connection not initialized");
    }

    try {
      // Check if the query is a comment-only query (which happens when the LLM can't generate a proper query)
      if (query.trim().startsWith('--') && !query.includes('SELECT') && !query.includes('select')) {
        console.warn("Query appears to be comment-only, returning empty result:", query);
        return [] as T[];
      }

      // Clean up the query - remove markdown code blocks and backticks
      query = query.replace(/```sql\s*|\s*```/gi, ''); // Remove ```sql and ``` markers
      query = query.replace(/`/g, ''); // Remove any remaining backticks

      console.log("Cleaned SQL query:", query);

      // Connect to the pool
      await this.pool.connect();
      
      // Create a request
      const request = this.pool.request();
      
      // Add parameters if provided
      if (params && params.length > 0) {
        // Check if the query uses named parameters (like @dbName)
        if (query.includes('@dbName') && params.length === 1) {
          request.input('dbName', params[0]);
        } else {
          // Otherwise add parameters with generated names
          params.forEach((param, index) => {
            request.input(`param${index}`, param);
          });
          
          // Replace any ? placeholders with named parameters
          let paramIndex = 0;
          query = query.replace(/\?/g, () => `@param${paramIndex++}`);
        }
      }
      
      // Execute the query
      const result = await request.query(query);
      return result.recordset as T[];
    } catch (error) {
      console.error("SQL Server database query error:", error);
      // Return empty array instead of throwing to match other implementations
      return [] as T[];
    }
  }

  // Close the connection pool
  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        this.pool = null;
        this.connectionId = null;
        this.databaseName = null; // Clear the database name
        console.log("SQL Server connection pool closed");
      } catch (error) {
        console.error("Error closing SQL Server connection pool:", error);
      }
    }
  }
} 