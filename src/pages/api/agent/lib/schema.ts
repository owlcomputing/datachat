import { createClient } from '@supabase/supabase-js';

// Default empty schema
const defaultSchema: any[] = [];

// Function to fetch schema for a specific connection
export async function getSchemaForConnection(connectionId: string): Promise<any[]> {
  try {
    if (!connectionId) {
      console.log("No connection ID provided, using default schema");
      return defaultSchema;
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Fetch schema from database_schemas table
    const { data, error } = await supabaseClient
      .from('database_schemas')
      .select('schema, schema_data')
      .eq('connection_id', connectionId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no rows are found

    if (error) {
      console.error("Error fetching schema:", error.message);
      return defaultSchema;
    }

    if (!data) {
      console.log("No schema found for connection ID:", connectionId);
      return defaultSchema;
    }

    // Use schema_data if available, otherwise use schema
    const schemaData = data.schema_data || data.schema || defaultSchema;
    
    // Ensure we have an array
    if (!Array.isArray(schemaData)) {
      console.warn("Schema data is not an array, returning default schema");
      return defaultSchema;
    }
    
    return schemaData;
  } catch (error) {
    console.error("Error getting schema for connection:", error);
    return defaultSchema;
  }
}

// Export default schema for backward compatibility
export default defaultSchema;
