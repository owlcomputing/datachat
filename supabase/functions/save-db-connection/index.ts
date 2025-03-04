// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = 'https://aadvgunvxivivkkyhsrp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhZHZndW52eGl2aXZra3loc3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NjYzMTcsImV4cCI6MjA1NjI0MjMxN30.f_iqnwPGUUbt2hza6M_tQcq-FHZcJrGJxQ5UrwHD3HU'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhZHZndW52eGl2aXZra3loc3JwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDY2NjMxNywiZXhwIjoyMDU2MjQyMzE3fQ.Frw1iIcsnf47YW1g_2TCII6eIPOAyItTh-GXplRKonU'
const ENCRYPTION_KEY = '12345678901234567890123456789012'

console.log("Hello from Functions!")

// CORS headers allowing any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Function to encrypt the password
async function encryptPassword(password: string): Promise<string> {
  try {
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Convert the encryption key to a CryptoKey
    const keyData = new TextEncoder().encode(ENCRYPTION_KEY);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-CBC", length: 256 },
      false,
      ["encrypt"]
    );
    
    // Encrypt the password
    const encodedPassword = new TextEncoder().encode(password);
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      encodedPassword
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + new Uint8Array(encryptedData).length);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.length);
    
    // Return as base64 string
    return encodeBase64(result);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt password");
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
    const body = await req.text(); // Log raw body for debugging
    console.log("Request body:", body);
    const { userId, dbname, username, password, host, port, displayName } = JSON.parse(body);

    if (!userId || !dbname || !username || !password || !host || !port || !displayName) {
      console.error("Missing parameters");
      return new Response(JSON.stringify({ message: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt the password
    const encryptedPassword = await encryptPassword(password);

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Store the data in Supabase
    const { data, error } = await supabaseClient
      .from('database_connections')
      .insert([
        {
          user_id: userId,
          dbname: dbname,
          username: username,
          password: encryptedPassword, // Store encrypted password
          host: host,
          port: port,
          display_name: displayName,
        },
      ]);

    if (error) {
      console.error('Supabase error:', error);
      return new Response(JSON.stringify({ message: 'Failed to save connection', error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Inserted data:", data);
    return new Response(JSON.stringify({ message: 'Connection saved successfully', data: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  curl -i --location --request POST 'http://127.0.0.1:54322/functions/v1/save-db-connection' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
