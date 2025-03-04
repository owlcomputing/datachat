import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquareText, Database, User, Trash2, PlusCircle } from "lucide-react"
import Link from "next/link"
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { LineChartComponent } from "@/components/LineChart"
import { AreaChartComponent } from "@/components/AreaChart"
import { PieChartComponent } from "@/components/PieChartLabel"
import { RadialChartComponent } from "@/components/Radial"
import BarChartComponent from '@/components/BarChart'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { motion, AnimatePresence } from 'framer-motion'
import TableComponent, { Column } from '@/components/Table'
import { toast } from 'react-hot-toast'

interface VisualizationData {
  type: string;
  componentConfig?: {
    data: Array<Record<string, any>>;
    config: Record<string, any>;
    title: string;
    description?: string;
    xAxisKey?: string;
    lineKeys?: string[];
    areaKey?: string;
    dataKey?: string;
    nameKey?: string;
    labelText?: string;
    footerText?: string;
    trendText?: string;
    className?: string;
    showLabels?: boolean;
    hideLabel?: boolean;
    margin?: {
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
    };
    barKeys?: string[];
    columns?: Column[];
    caption?: string;
    footerData?: {
      label: string;
      value: string | number;
      colSpan?: number;
    };
  };
}

// First, let's define the Message interface to include the role property
interface Message {
    content: string;
    isUser: boolean;
    role?: string;
    visualization?: VisualizationData;
    tableData?: VisualizationData;
}

// Component to render the appropriate chart based on visualization type
const VisualizationComponent = ({ visualization }: { visualization: VisualizationData }) => {
  if (!visualization || !visualization.componentConfig) {
    return null;
  }

  const config = visualization.componentConfig;
  console.log(`Rendering visualization of type: ${visualization.type}`, config);

  switch (visualization.type.toLowerCase()) {
    case 'line':
      return (
        <LineChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          lineKeys={config.lineKeys || []}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'bar':
      return (
        <BarChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          barKeys={config.barKeys || Object.keys(config.config)}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'area':
      return (
        <AreaChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          xAxisKey={config.xAxisKey || ''}
          gamesToShow='all'
          areaKey={config.areaKey || Object.keys(config.config)[0] || ''}
          footerText={config.footerText}
          trendText={config.trendText}
          showLabels={config.showLabels}
          margin={config.margin}
        />
      );
    case 'pie':
      return (
        <PieChartComponent
          data={config.data}
          config={config.config}
          title={config.title}
          description={config.description}
          dataKey={config.dataKey || 'value'}
          nameKey={config.nameKey || 'name'}
          footerText={config.footerText}
          trendText={config.trendText}
          hideLabel={config.hideLabel}
          className={config.className}
        />
      );
    case 'radial':
      // Extract numeric values from the data array
      const numericData = Array.isArray(config.data) 
        ? config.data.map(item => {
            // If the item is a number, use it directly
            if (typeof item === 'number') return item;
            // If it's an object with a 'value' property, use that
            if (item && typeof item.value === 'number') return item.value;
            // Otherwise, try to find the first numeric property
            const numericValue = Object.values(item).find(val => typeof val === 'number');
            return numericValue !== undefined ? numericValue : 0;
          })
        : [];
      
      return (
        <RadialChartComponent
          data={numericData}
          config={config.config}
          title={config.title}
          description={config.description}
          footerText={config.footerText}
          trendText={config.trendText}
          className={config.className}
          labelText={config.labelText || 'Value'}
        />
      );
    case 'table':
      return (
        <TableComponent
          data={config.data}
          columns={config.columns || []}
          caption={config.caption}
          footerData={config.footerData}
          className={config.className}
        />
      );
    default:
      console.warn(`Unknown visualization type: ${visualization.type}`);
      return null;
  }
};

function useStreamingResponse(connections: Array<{ name: string; connection: string }>) {
    const [streamingText, setStreamingText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const supabaseClient = useSupabaseClient();
    const user = useUser();

    const sendMessage = useCallback(async (message: string, selectedDb: string | null, chatId: string | null = null) => {
        setIsLoading(true);
        setError(null);
        setStreamingText('');

        if (!user || !selectedDb) {
            setIsLoading(false);
            setError(new Error("User not logged in or no database selected."));
            return;
        }

        const connection = connections.find(db => db.connection === selectedDb);
        if (!connection) {
            setIsLoading(false);
            setError(new Error("Selected database connection not found."));
            return;
        }

        console.log("Sending message to API:", {
            question: message,
            userId: user.id,
            connectionId: selectedDb,
            chatId: chatId
        });

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: message,
                    userId: user.id,
                    connectionId: selectedDb,
                    chatId: chatId
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API error response:", errorText);
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            if (!response.body) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                setStreamingText(prev => prev + chunk);
            }
        } catch (err) {
            console.error("Error sending message:", err);
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [user, connections, setIsLoading, setError, setStreamingText]);

    useEffect(() => {
        if (!isLoading && streamingText) {
            setStreamingText(""); // Reset after adding to messages
        }
    }, [isLoading, streamingText]);

    return { streamingText, isLoading, error, sendMessage, setStreamingText };
}

// Update the loading indicator
const LoadingDots = () => (
  <div className="flex justify-start">
    <div className="p-3 rounded-lg max-w-[75%] bg-gray-200 text-black flex space-x-1">
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.5s]"></div>
    </div>
  </div>
);

export default function Index() {
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabaseClient = useSupabaseClient();
    const user = useUser();
    const router = useRouter();
    const [connections, setConnections] = useState<Array<{
      name: string;
      connection: string;
    }>>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const { streamingText, isLoading, error, sendMessage, setStreamingText } = useStreamingResponse(connections); // Use the hook
    const [chats, setChats] = useState<Array<{
        id: string;
        title: string;
    }>>([]);

    // Fetch connections
    useEffect(() => {
        const fetchConnections = async () => {
            if (!user) return;
            
            try {
                const { data, error } = await supabaseClient
                    .from('database_connections')
                    .select('id, display_name')
                    .eq('user_id', user.id);
                
                if (error) {
                    console.error("Error fetching connections:", error);
                } else if (data) {
                    // Format connections to match what useStreamingResponse expects
                    const formattedConnections = data.map(item => ({
                        name: item.display_name,
                        connection: item.id,
                    }));
                    setConnections(formattedConnections);
                    
                    // If there's at least one connection, select the first one by default
                    if (formattedConnections.length > 0 && !selectedConnectionId) {
                        setSelectedConnectionId(formattedConnections[0].connection);
                    }
                }
            } catch (error) {
                console.error("Error fetching connections:", error);
            }
        };
        
        fetchConnections();
    }, [user, supabaseClient, selectedConnectionId]);

    // Basic session check
    useEffect(() => {
        if (!user) {
            console.log("No user logged in");
        } else {
            console.log("User logged in:", user.email);
        }
    }, [user, router]);

    // Update the useEffect for scrolling to use the ref directly
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingText, isLoading]);

    // Add this function to handle connection selection
    const handleConnectionChange = (connectionId: string) => {
        setSelectedConnectionId(connectionId);
        
        // If we have a current chat, update the chat_connections table
        if (user && currentChatId) {
            supabaseClient
                .from('chat_connections')
                .upsert({
                    chat_id: currentChatId,
                    connection_id: connectionId,
                    user_id: user.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'chat_id, user_id' })
                .then(({ error }) => {
                    if (error) {
                        console.error("Error updating chat connection:", error);
                    } else {
                        console.log("Chat connection updated successfully");
                    }
                });
        }
    };

    // First define loadChatConnection
    const loadChatConnection = useCallback(async (chatId: string) => {
        if (!user) {
            console.error("Cannot load chat connection: User not logged in");
            return;
        }
        
        console.log(`Loading connection for chat: chatId=${chatId}, userId=${user.id}`);
        
        try {
            const { data, error } = await supabaseClient
                .from('chat_connections')
                .select('connection_id')
                .eq('chat_id', chatId)
                .eq('user_id', user.id)
                .single();
            
            if (error) {
                console.error("Error fetching chat connection:", error);
                toast.error("Failed to load chat connection.");
                return;
            }
            
            if (!data) {
                console.error(`No connection found for chat ${chatId}`);
                toast.error("No database connection found for this chat.");
                return;
            }
            
            console.log(`Found connection ${data.connection_id} for chat ${chatId}`);
            
            // Verify the connection exists
            const { data: connectionData, error: connectionError } = await supabaseClient
                .from('database_connections')
                .select('display_name')
                .eq('id', data.connection_id)
                .eq('user_id', user.id)
                .single();
            
            if (connectionError || !connectionData) {
                console.error("Error verifying connection:", connectionError);
                toast.error("The database connection for this chat no longer exists.");
                return;
            }
            
            console.log(`Verified connection: ${connectionData.display_name}`);
            setSelectedConnectionId(data.connection_id);
        } catch (error) {
            console.error("Error loading chat connection:", error);
            toast.error("Failed to load chat connection.");
        }
    }, [user, supabaseClient, setSelectedConnectionId, toast]);

    // Then define selectChat which uses loadChatConnection
    const selectChat = useCallback(async (chatId: string) => {
        setCurrentChatId(chatId);
        await loadChatConnection(chatId);
        setMessages([]); // Reset messages when switching chats
        
        // Fetch chat messages if needed
        // This would be implemented in a future update
    }, [loadChatConnection]);

    // Now define createNewChat which uses selectChat
    const createNewChat = useCallback(async () => {
        if (!user) {
            toast.error("You must be logged in to create a chat.");
            return;
        }
        
        if (!selectedConnectionId) {
            toast.error("Please select a database connection first.");
            return;
        }
        
        try {
            // Get the connection name for the title
            const connection = connections.find(conn => conn.connection === selectedConnectionId);
            const connectionName = connection ? connection.name : 'Database';
            
            console.log("Creating new chat with connection:", {
                userId: user.id,
                connectionId: selectedConnectionId,
                connectionName
            });
            
            const { data, error } = await supabaseClient
                .from('chats')
                .insert([
                    { 
                        user_id: user.id,
                        title: `Chat with ${connectionName}` 
                    }
                ])
                .select()
                .single();
                
            if (error) {
                console.error("Error creating new chat:", error);
                toast.error("Failed to create new chat.");
                throw new Error(`Failed to create chat: ${error.message}`);
            }
            
            if (!data) {
                console.error("No data returned from chat creation");
                toast.error("Failed to create new chat.");
                throw new Error("No data returned from chat creation");
            }
            
            console.log("Chat created successfully:", data);
            
            // Create the chat_connection record
            console.log("Creating chat connection record:", {
                chatId: data.id,
                connectionId: selectedConnectionId,
                userId: user.id
            });
            
            const { error: connectionError } = await supabaseClient
                .from('chat_connections')
                .insert([
                    {
                        chat_id: data.id,
                        connection_id: selectedConnectionId,
                        user_id: user.id
                    }
                ]);
                
            if (connectionError) {
                console.error("Error creating chat connection:", connectionError);
                toast.error("Failed to associate connection with chat.");
                
                // Try to delete the chat since we couldn't associate it with a connection
                try {
                    await supabaseClient
                        .from('chats')
                        .delete()
                        .eq('id', data.id);
                    console.log("Deleted chat due to connection association failure");
                } catch (deleteError) {
                    console.error("Failed to delete chat after connection error:", deleteError);
                }
                
                throw new Error(`Failed to create chat connection: ${connectionError.message}`);
            }
            
            console.log("Chat connection created successfully");
            
            // Add the new chat to the list and select it
            setChats(prevChats => [data, ...prevChats]);
            await selectChat(data.id);
            toast.success(`Created new chat with ${connectionName}`);
            
            return data.id;
        } catch (error) {
            console.error("Error creating new chat:", error);
            toast.error("An error occurred while creating the chat.");
            throw error;
        }
    }, [user, selectedConnectionId, supabaseClient, selectChat, setChats, connections, toast]);

    // Fix the setMessages call in handleSend to match the Message type
    const handleSend = useCallback(async () => {
        if (!message.trim()) return;
        
        // If no chat is selected and we have a connection, create a new chat
        if (!currentChatId && selectedConnectionId) {
            try {
                await createNewChat();
                // The message will be sent after the chat is created in the next render
                return;
            } catch (error) {
                console.error("Error creating new chat:", error);
                toast.error("Failed to create a new chat. Please try again.");
                return;
            }
        }
        
        if (!selectedConnectionId) {
            toast.error("Please select a database connection first.");
            return;
        }
        
        if (!user) {
            toast.error("You must be logged in to send messages.");
            return;
        }
        
        const currentMessage = message;
        setMessage("");
        
        // Add user message to the chat
        setMessages((prev) => [
            ...prev,
            { content: currentMessage, isUser: true, role: "user" },
        ]);
        
        try {
            // Send message to API
            await sendMessage(currentMessage, selectedConnectionId, currentChatId);
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Failed to send message. Please try again.");
            
            // Optionally, you could add the error to the messages
            setMessages((prev) => [
                ...prev,
                { 
                    content: "Error: Failed to send message. Please try again.", 
                    isUser: false, 
                    role: "system" 
                },
            ]);
        }
    }, [message, currentChatId, selectedConnectionId, createNewChat, sendMessage, setMessage, setMessages, user, toast]);

    // Update the useEffect that handles streamingText
    useEffect(() => {
        if (!isLoading && streamingText) {
            try {
                // Try to parse as JSON first
                const response = JSON.parse(streamingText);
                console.log("Received JSON response:", response);
                
                setMessages((prev) => [
                    ...prev,
                    { 
                        content: response.answer || response.content || streamingText, 
                        isUser: false,
                        role: "assistant",
                        visualization: response.visualization,
                        tableData: response.tableData
                    }
                ]);
            } catch (e) {
                console.log("Received text response:", streamingText);
                // If it's not JSON, treat it as plain text
                setMessages((prev) => [
                    ...prev, 
                    { 
                        content: streamingText, 
                        isUser: false,
                        role: "assistant"
                    }
                ]);
            }
            setStreamingText(""); // Reset after adding to messages
        }
    }, [isLoading, streamingText, setMessages]);

    // Function to render message content
    const renderMessageContent = (msg: Message) => {
        return (
            <div className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        rehypePlugins={[rehypeRaw]}
                    >
                        {msg.content}
                    </ReactMarkdown>
                </div>
                
                {msg.visualization && (
                    <div className="mt-4 w-full">
                        <VisualizationComponent visualization={msg.visualization} />
                    </div>
                )}
                
                {msg.tableData && (
                    <div className="mt-4 w-full">
                        <VisualizationComponent visualization={msg.tableData} />
                    </div>
                )}
            </div>
        );
    };

    // Update the useEffect that fetches chats
    useEffect(() => {
        const fetchChats = async () => {
            if (!user) return;
            
            try {
                const { data, error } = await supabaseClient
                    .from('chats')
                    .select('id, title')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error("Error fetching chats:", error);
                } else if (data) {
                    setChats(data);
                    
                    // If there's at least one chat, select the first one by default
                    if (data.length > 0 && !currentChatId) {
                        setCurrentChatId(data[0].id);
                        loadChatConnection(data[0].id);
                    }
                }
            } catch (error) {
                console.error("Error fetching chats:", error);
            }
        };
        
        fetchChats();
    }, [user, supabaseClient, currentChatId, loadChatConnection]);

    // Add a function to get the connection name for a chat
    const getConnectionNameForChat = useCallback((chatId: string) => {
        // If this is the current chat, use the selectedConnectionId
        if (chatId === currentChatId && selectedConnectionId) {
            const connection = connections.find(conn => 
                conn.connection === selectedConnectionId
            );
            return connection ? connection.name : 'No connection';
        }
        
        // Otherwise, we'd need to fetch the connection from the database
        // For simplicity, we'll just show "Select to view" for non-active chats
        return "Select to view";
    }, [connections, selectedConnectionId, currentChatId]);

    // Add a function to get the current connection name
    const getCurrentConnectionName = useCallback(() => {
        if (!selectedConnectionId) return null;
        
        const connection = connections.find(conn => 
            conn.connection === selectedConnectionId
        );
        return connection ? connection.name : null;
    }, [connections, selectedConnectionId]);

    return (
        <div className="min-h-screen w-full bg-background text-foreground flex">
            {/* Desktop Sidebar - Display Connections */}
            <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4 fixed h-screen">
                <nav className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={createNewChat}
                        >
                            New Chat
                        </Button>
                    </div>

                    <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                        {chats.map((chat) => (
                            <div key={chat.id} className="flex flex-col">
                                <Button
                                    variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                                    className="w-full justify-start text-left"
                                    onClick={() => selectChat(chat.id)}
                                >
                                    <span className="truncate">{chat.title}</span>
                                </Button>
                                {currentChatId === chat.id && (
                                    <div className="text-xs text-muted-foreground ml-2 mb-1">
                                        Connected to: {getConnectionNameForChat(chat.id)}
                                    </div>
                                )}
                            </div>
                        ))}
                        {chats.length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">
                                No chats yet. Create a new chat to get started.
                            </p>
                        )}
                    </div>

                    <div className="pt-4 border-t">
                        <h2 className="text-lg font-semibold tracking-tight mb-2">Data Connections</h2>
                        <div className="space-y-1">
                            {connections.map((db) => (
                                <div key={db.connection} className="flex gap-1 items-center">
                                    <Button
                                        variant={selectedConnectionId === db.connection ? 'secondary' : 'ghost'}
                                        className="w-full justify-start flex-1"
                                        onClick={() => handleConnectionChange(db.connection)}
                                    >
                                        <span className="truncate">{db.name}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Link href="/profile">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                            >
                                <User className="h-4 w-4 mr-2" />
                                Profile
                            </Button>
                        </Link>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col ml-0 lg:ml-64">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b fixed w-full bg-background z-10">
                    <div className="flex items-center gap-2">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Database className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                                <nav className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={createNewChat}
                                        >
                                            New Chat
                                        </Button>
                                    </div>

                                    <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                                        {chats.map((chat) => (
                                            <div key={chat.id} className="flex flex-col">
                                                <Button
                                                    variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-left"
                                                    onClick={() => selectChat(chat.id)}
                                                >
                                                    <span className="truncate">{chat.title}</span>
                                                </Button>
                                                {currentChatId === chat.id && (
                                                    <div className="text-xs text-muted-foreground ml-2 mb-1">
                                                        Connected to: {getConnectionNameForChat(chat.id)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {chats.length === 0 && (
                                            <p className="text-xs text-muted-foreground p-2">
                                                No chats yet. Create a new chat to get started.
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t">
                                        <h2 className="text-lg font-semibold tracking-tight mb-2">Data Connections</h2>
                                        <div className="space-y-1">
                                            {connections.map((db) => (
                                                <div key={db.connection} className="flex gap-1 items-center">
                                                    <Button
                                                        variant={selectedConnectionId === db.connection ? 'secondary' : 'ghost'}
                                                        className="w-full justify-start flex-1"
                                                        onClick={() => handleConnectionChange(db.connection)}
                                                    >
                                                        <span className="truncate">{db.name}</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <Link href="/profile">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                            >
                                                <User className="h-4 w-4 mr-2" />
                                                Profile
                                            </Button>
                                        </Link>
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                        {selectedConnectionId && (
                            <div className="text-sm font-medium">
                                {getCurrentConnectionName()}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {currentChatId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={createNewChat}
                            >
                                <PlusCircle className="h-4 w-4 mr-1" />
                                New Chat
                            </Button>
                        )}
                    </div>
                </header>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4 chat-container pt-16 mt-12 lg:pt-0 pb-32">
                    {!selectedConnectionId && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Database className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Select a database connection</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
                                Choose a database connection from the sidebar to start chatting with your data.
                            </p>
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                                {connections.slice(0, 4).map((db) => (
                                    <Button
                                        key={db.connection}
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => handleConnectionChange(db.connection)}
                                    >
                                        {db.name}
                                    </Button>
                                ))}
                            </div>
                            {connections.length > 4 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    More connections available in the sidebar.
                                </p>
                            )}
                        </div>
                    )}
                    <AnimatePresence>
                        {messages.map((msg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`p-3 rounded-lg max-w-[75%] ${msg.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    {renderMessageContent(msg)}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isLoading && <LoadingDots />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t fixed bottom-0 w-full lg:w-[calc(100%-16rem)] bg-background">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Ask a question about your data..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1"
                        />
                        <Button onClick={handleSend} disabled={isLoading || !message.trim()}>
                            <MessageSquareText className="h-4 w-4 mr-2" />
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
