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
    const { data: schemaData, error } = await supabaseClient
      .from('database_schemas')
      .select('schema, schema_data')
      .eq('connection_id', connectionId)
      .single();

    if (error || !schemaData) {
      console.error("Error fetching schema:", error?.message || 'Schema not found');
      return defaultSchema;
    }

    // Use schema_data if available, otherwise use schema
    return schemaData.schema_data || schemaData.schema || defaultSchema;
  } catch (error) {
    console.error("Error getting schema for connection:", error);
    return defaultSchema;
  }
}

// Export default schema for backward compatibility
export default defaultSchema;
