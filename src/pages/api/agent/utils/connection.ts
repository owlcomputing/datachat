import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
export const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

/**
 * Checks if the Supabase connection is working
 * @returns Promise<boolean> True if connection is successful
 */
export async function checkSupabaseConnection(): Promise<boolean> {
    try {
        const { data, error } = await supabaseClient.from(
            "database_connections",
        )
            .select("*").limit(1);

        if (error) {
            console.error("Supabase connection check FAILED:", error);
            return false;
        }

        if (data) {
            console.log(
                "Supabase connection check SUCCESSFUL. Sample data:",
                data,
            );
            return true;
        }
        console.log("data is null");
        return false;
    } catch (err) {
        console.error("Supabase connection check FAILED (exception):", err);
        return false;
    }
}

/**
 * Gets the database dialect for a connection
 * @param connectionId The connection ID
 * @returns Promise<string> The database dialect (defaults to postgres)
 */
export async function getDatabaseDialect(
    connectionId: string,
): Promise<string> {
    try {
        const { data, error } = await supabaseClient
            .from("database_connections")
            .select("dialect")
            .eq("id", connectionId)
            .single();

        if (error || !data) {
            console.error(
                "Error fetching database dialect:",
                error?.message || "Connection not found",
            );
            return "postgres"; // Default to postgres if not found
        }

        return data.dialect || "postgres";
    } catch (error) {
        console.error("Error getting database dialect:", error);
        return "postgres"; // Default to postgres on error
    }
}

/**
 * Validates that a user has access to a chat
 * @param userId The user ID
 * @param chatId The chat ID
 * @returns Promise<boolean> True if the user has access to the chat
 */
export async function validateChatAccess(
    userId: string,
    chatId: string,
): Promise<boolean> {
    console.log(`Validating chat access: userId=${userId}, chatId=${chatId}`);

    const { data: chatData, error: chatError } = await supabaseClient
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .eq("user_id", userId)
        .single();

    if (chatError) {
        console.error("Chat validation error:", chatError);
        return false;
    }

    if (!chatData) {
        console.error(`No chat found with id=${chatId} for user=${userId}`);
        return false;
    }

    console.log("Chat validation successful:", chatData);
    return true;
}

/**
 * Validates that a user has access to a connection
 * @param userId The user ID
 * @param connectionId The connection ID
 * @returns Promise<boolean> True if the user has access to the connection
 */
export async function validateConnectionAccess(
    userId: string,
    connectionId: string,
): Promise<boolean> {
    console.log(
        `Validating connection access: userId=${userId}, connectionId=${connectionId}`,
    );

    const { data: connectionData, error: connectionError } =
        await supabaseClient
            .from("database_connections")
            .select("*")
            .eq("id", connectionId)
            .eq("user_id", userId)
            .single();

    if (connectionError) {
        console.error("Connection validation error:", connectionError);
        return false;
    }

    if (!connectionData) {
        console.error(
            `No connection found with id=${connectionId} for user=${userId}`,
        );
        return false;
    }

    console.log("Connection validation successful:", {
        id: connectionData.id,
        name: connectionData.display_name,
        host: connectionData.host,
        database: connectionData.dbname,
        username: connectionData.username,
        // Don't log the password, even if encrypted
    });

    return true;
}

/**
 * Gets the connection ID for a chat
 * @param userId The user ID
 * @param chatId The chat ID
 * @returns Promise<string | null> The connection ID or null if not found
 */
export async function getConnectionIdForChat(
    userId: string,
    chatId: string,
): Promise<string | null> {
    console.log(`Fetching connection for chat: chatId=${chatId}`);

    const { data: chatConnectionData, error: chatConnectionError } =
        await supabaseClient
            .from("chat_connections")
            .select("connection_id")
            .eq("chat_id", chatId)
            .eq("user_id", userId)
            .single();

    if (chatConnectionError) {
        console.error(
            "Error fetching connection for chat:",
            chatConnectionError,
        );
        return null;
    }

    if (chatConnectionData) {
        console.log(
            `Found connection ${chatConnectionData.connection_id} for chat ${chatId}`,
        );
        return chatConnectionData.connection_id;
    }

    console.error(`No connection found for chat ${chatId}`);
    return null;
}
