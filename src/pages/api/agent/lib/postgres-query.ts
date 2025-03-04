import pg from "pg";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

export class PostgresQuery {
  private pool: pg.Pool | null = null;
  private connectionId: string | null = null;
  private supabaseClient: any;
  private encryptionKey: string = '12345678901234567890123456789012';

  constructor() {
    // Initialize Supabase client
    this.supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }

  // Function to decrypt the password
  private async decryptPassword(encryptedPassword: string): Promise<string> {
    try {
      // Base64 decode the encrypted data
      const encryptedBuffer = Buffer.from(encryptedPassword, 'base64');
      
      // Extract IV (first 16 bytes) and ciphertext
      const iv = encryptedBuffer.slice(0, 16);
      const ciphertext = encryptedBuffer.slice(16);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.encryptionKey),
        iv
      );

      // Decrypt the data
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString();
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt password");
    }
  }

  // Initialize connection based on connection ID
  async initializeConnection(userId: string, connectionId: string): Promise<void> {
    console.log(`Initializing connection: userId=${userId}, connectionId=${connectionId}`);
    
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
        // Don't log the password, even if encrypted
      });

      // Use the password directly without decryption
      console.log("Using password directly without decryption");
      const password = connectionData.password;

      // Create connection config
      const config: pg.PoolConfig = {
        database: connectionData.dbname,
        user: connectionData.username,
        password: password,
        host: connectionData.host,
        port: connectionData.port,
        // Pool configuration
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

      // Only add SSL if not in development
      if (process.env.NODE_ENV !== "development") {
        config.ssl = {
          rejectUnauthorized: false,
        };
        console.log("Added SSL configuration for non-development environment");
      }

      console.log("Creating connection pool with config:", {
        database: config.database,
        user: config.user,
        host: config.host,
        port: config.port,
        // Don't log the password
      });

      // Create new pool with the connection details
      this.pool = new pg.Pool(config);
      this.connectionId = connectionId;

      // Handle pool errors
      this.pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
      });

      // Test the connection
      console.log("Testing database connection");
      try {
        const client = await this.pool.connect();
        console.log("Connection test successful");
        client.release();
      } catch (testError) {
        console.error("Connection test failed:", testError);
        throw new Error(`Failed to connect to database: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      console.log(`Successfully initialized connection to database: ${connectionData.display_name}`);

      // Check if we need to fetch the schema
      await this.ensureSchemaExists(userId, connectionId);
    } catch (error) {
      console.error("Error initializing connection:", error);
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
        console.log("Schema not found, fetching from database...");
        
        // Execute schema query
        const schemaQuery = `
          SELECT 
            table_name, 
            column_name, 
            data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position;
        `;
        
        const schemaResult = await this.executeQuery(schemaQuery);
        
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
  async executeQuery<T>(query: string, params?: string[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error("Database connection not initialized");
    }

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

  // Close the connection
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connectionId = null;
    }
  }
}

// // Manual testing
// if (import.meta.url === new URL(import.meta.url).href) {
//   const query = new PostgresQuery();
//   const result = await query.executeQuery("SELECT * FROM players LIMIT 10");
//   console.log(result);
// }
