// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = 'https://aadvgunvxivivkkyhsrp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhZHZndW52eGl2aXZra3loc3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NjYzMTcsImV4cCI6MjA1NjI0MjMxN30.f_iqnwPGUUbt2hza6M_tQcq-FHZcJrGJxQ5UrwHD3HU'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhZHZndW52eGl2aXZra3loc3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDY2NjMxNywiZXhwIjoyMDU2MjQyMzE3fQ.Frw1iIcsnf47YW1g_2TCII6eIPOAyItTh-GXplRKonU'
const ENCRYPTION_KEY = '12345678901234567890123456789012'

console.log("Fetch DB Schema Function Initialized")

// CORS headers allowing any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Function to decrypt the password
async function decryptPassword(encryptedPassword: string): Promise<string> {
  try {
    // Convert the encryption key to a CryptoKey
    const keyData = new TextEncoder().encode(ENCRYPTION_KEY);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-CBC", length: 256 },
      false,
      ["decrypt"]
    );

    // Decode the base64 encrypted data
    const encryptedData = decodeBase64(encryptedPassword);
    
    // Extract IV (first 16 bytes) and ciphertext
    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      key,
      ciphertext
    );

    // Convert the decrypted data to a string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt password");
  }
}

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    console.log("Request body:", body);
    const { userId, connectionId, chatId } = JSON.parse(body);

    if (!userId || !connectionId) {
      console.error("Missing parameters");
      return new Response(JSON.stringify({ message: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch the database connection details
    const { data: connectionData, error: connectionError } = await supabaseClient
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (connectionError || !connectionData) {
      console.error('Error fetching connection:', connectionError);
      return new Response(JSON.stringify({ message: 'Connection not found', error: connectionError?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the password directly without decryption
    console.log("Using password directly without decryption");
    const password = connectionData.password;

    // Connect to the database
    const client = new Client({
      user: connectionData.username,
      password: password,
      database: connectionData.dbname,
      hostname: connectionData.host,
      port: connectionData.port,
    });

    try {
      await client.connect();
      console.log("Connected to database");

      // Execute the schema query
      const schemaQuery = `
        SELECT 
          table_name, 
          column_name, 
          data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `;
      
      const schemaResult = await client.queryObject(schemaQuery);
      console.log(`Retrieved schema with ${schemaResult.rows.length} columns`);

      // Check if we already have a schema for this connection
      const { data: existingSchema, error: schemaError } = await supabaseClient
        .from('database_schemas')
        .select('*')
        .eq('connection_id', connectionId)
        .single();

      if (schemaError && schemaError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking existing schema:', schemaError);
      }

      // Store or update the schema in the database_schemas table
      let schemaOperation;
      if (existingSchema) {
        schemaOperation = supabaseClient
          .from('database_schemas')
          .update({
            schema_data: schemaResult.rows,
            schema: schemaResult.rows,
            user_id: userId
          })
          .eq('id', existingSchema.id);
      } else {
        schemaOperation = supabaseClient
          .from('database_schemas')
          .insert([{
            connection_id: connectionId,
            schema: schemaResult.rows,
            schema_data: schemaResult.rows,
            user_id: userId,
            created_at: new Date().toISOString()
          }]);
      }

      const { error: upsertError } = await schemaOperation;
      if (upsertError) {
        console.error('Error storing schema:', upsertError);
        return new Response(JSON.stringify({ message: 'Failed to store schema', error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If chatId is provided, associate this connection with the chat
      if (chatId) {
        const { error: chatError } = await supabaseClient
          .from('chat_connections')
          .upsert([{
            chat_id: chatId,
            connection_id: connectionId,
            user_id: userId,
            updated_at: new Date().toISOString()
          }], { onConflict: 'chat_id, user_id' });

        if (chatError) {
          console.error('Error associating connection with chat:', chatError);
        }
      }

      return new Response(JSON.stringify({ 
        message: 'Schema fetched successfully', 
        schema: schemaResult.rows,
        connectionDetails: {
          id: connectionData.id,
          display_name: connectionData.display_name,
          host: connectionData.host,
          port: connectionData.port,
          dbname: connectionData.dbname,
          username: connectionData.username
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ message: 'Database connection failed', error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      try {
        await client.end();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ message: 'Internal server error', error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54322/functions/v1/fetch-db-schema' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"userId":"user-id", "connectionId":"connection-id"}'

*/ 