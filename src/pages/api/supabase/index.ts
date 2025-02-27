import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { supabaseUrl, supabaseServiceKey, query } = req.body;

  if (!supabaseUrl || !supabaseServiceKey || !query) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc("safe_query", {
      table_name: "players",
      columns: req.body.columns || "*",
      limit_count: Math.min(Number(req.body.limit) || 100, 1000),
    });

    if (error) {
      console.error("RPC Error:", error);
      return res.status(500).json({
        message: "Query failed",
        error: error.message,
      });
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Server error", error: (err as Error).message });
  }
}
