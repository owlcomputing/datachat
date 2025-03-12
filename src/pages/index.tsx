import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquareText, Database, User, Trash2, PlusCircle, Menu } from "lucide-react"
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
import { NewChatDialog } from "@/components/NewChatDialog"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
    sqlQuery?: string;
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

    const sendMessage = useCallback(async (message: string, selectedDb: string | null, chatId: string | null = null, recentMessages: Message[] = []) => {
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
            chatId: chatId,
            context: recentMessages.slice(-5)
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
                    chatId: chatId,
                    context: recentMessages.slice(-5)
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
    <div className="flex space-x-2">
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
    const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);

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

    // Update the createNewChat function to open the dialog
    const createNewChat = useCallback(() => {
        setNewChatDialogOpen(true);
    }, []);

    // Add a new function to handle chat creation from the dialog
    const handleCreateChat = useCallback(async (title: string, connectionId: string) => {
        if (!user) {
            toast.error("You must be logged in to create a chat.");
            return;
        }
        
        try {
            // Create a new chat in the database
            const { data, error } = await supabaseClient
                .from('chats')
                .insert({
                    title: title,
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select('id')
                .single();
            
            if (error) {
                console.error("Error creating chat:", error);
                toast.error("Failed to create chat.");
                return;
            }
            
            const newChatId = data.id;
            
            // Create the chat-connection relationship
            const { error: connectionError } = await supabaseClient
                .from('chat_connections')
                .insert({
                    chat_id: newChatId,
                    connection_id: connectionId,
                    user_id: user.id,
                    updated_at: new Date().toISOString()
                });
            
            if (connectionError) {
                console.error("Error creating chat connection:", connectionError);
                toast.error("Failed to link chat to database connection.");
                return;
            }
            
            // Add the new chat to the local state
            setChats(prevChats => [
                ...prevChats,
                { id: newChatId, title: title }
            ]);
            
            // Select the new chat
            setCurrentChatId(newChatId);
            setSelectedConnectionId(connectionId);
            setMessages([]);
            
            toast.success("New chat created successfully!");
        } catch (error) {
            console.error("Error in chat creation:", error);
            toast.error("An unexpected error occurred.");
        }
    }, [user, supabaseClient, toast]);

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
            // Send message to API with the 5 most recent messages as context
            await sendMessage(currentMessage, selectedConnectionId, currentChatId, messages.slice(-5));
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
    }, [message, currentChatId, selectedConnectionId, createNewChat, sendMessage, setMessage, setMessages, user, toast, messages]);

    // Update the useEffect that handles streamingText
    useEffect(() => {
        if (!isLoading && streamingText) {
            try {
                // Try to parse as JSON first
                const response = JSON.parse(streamingText);
                console.log("Received JSON response:", response);
                console.log("SQL Query in response:", response.sqlQuery);
                
                setMessages((prev) => [
                    ...prev,
                    { 
                        content: response.answer || response.content || streamingText, 
                        isUser: false,
                        role: "assistant",
                        visualization: response.visualization,
                        tableData: response.tableData,
                        sqlQuery: response.sqlQuery
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
        console.log("Rendering message:", msg);
        console.log("SQL Query in message:", msg.sqlQuery);
        
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

                {msg.sqlQuery && (
                    <div className="mt-4 w-full">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="sql-query">
                                <AccordionTrigger className="text-sm font-medium">
                                    View SQL Query
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md overflow-x-auto">
                                        <pre className="text-xs">{msg.sqlQuery}</pre>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
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

    // Add a function to get the current chat title
    const getCurrentChatTitle = useCallback(() => {
        if (!currentChatId) return null;
        const chat = chats.find(c => c.id === currentChatId);
        return chat ? chat.title : null;
    }, [chats, currentChatId]);

    return (
        <div className="min-h-screen w-full bg-background text-foreground flex">
            {/* Desktop Sidebar - Simplified to only show chats */}
            <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4 fixed h-screen">
                <nav className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={createNewChat}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <PlusCircle className="h-4 w-4 mr-1" />
                            New Chat
                        </Button>
                    </div>

                    <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                        {chats.map((chat) => (
                            <div key={chat.id} className="flex flex-col mb-2">
                                <Button
                                    variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                                    className="w-full justify-start text-left"
                                    onClick={() => selectChat(chat.id)}
                                >
                                    <span className="truncate">{chat.title}</span>
                                </Button>
                            </div>
                        ))}
                        {chats.length === 0 && (
                            <p className="text-xs text-muted-foreground p-2">
                                No chats yet. Create a new chat to get started.
                            </p>
                        )}
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

            {/* Mobile Header - Simplified */}
            <div className="flex-1 flex flex-col ml-0 lg:ml-64">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b fixed w-full bg-background z-10">
                    <div className="flex items-center gap-2">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                                <nav className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-lg font-semibold tracking-tight">Chats</h2>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => {
                                                setNewChatDialogOpen(true);
                                            }}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                        >
                                            <PlusCircle className="h-4 w-4 mr-1" />
                                            New Chat
                                        </Button>
                                    </div>

                                    <div className="space-y-1">
                                        {chats.map((chat) => (
                                            <div key={chat.id} className="flex flex-col mb-2">
                                                <Button
                                                    variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                                                    className="w-full justify-start text-left"
                                                    onClick={() => {
                                                        selectChat(chat.id);
                                                        (document.querySelector('[data-radix-collection-item]') as HTMLElement)?.click();
                                                    }}
                                                >
                                                    <span className="truncate">{chat.title}</span>
                                                </Button>
                                            </div>
                                        ))}
                                        {chats.length === 0 && (
                                            <p className="text-xs text-muted-foreground p-2">
                                                No chats yet. Create a new chat to get started.
                                            </p>
                                        )}
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
                        {currentChatId && (
                            <div className="text-sm font-medium">
                                {getCurrentChatTitle()}
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

                {/* Desktop Header/Banner with DB name */}
                {currentChatId && (
                    <div className="hidden lg:flex items-center justify-between p-3 border-b bg-muted/10">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-medium">{getCurrentChatTitle()}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <span>{getCurrentConnectionName()}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={createNewChat}
                            >
                                <PlusCircle className="h-4 w-4 mr-1" />
                                New Chat
                            </Button>
                        </div>
                    </div>
                )}

                {/* Mobile Banner with DB name (only visible when chat is selected) */}
                {currentChatId && (
                    <div className="lg:hidden flex items-center justify-between p-2 border-b bg-muted/10 mt-16">
                        <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs">
                            <Database className="h-3 w-3 text-muted-foreground" />
                            <span>{getCurrentConnectionName()}</span>
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                <div className={`flex-1 overflow-y-auto space-y-6 chat-container ${currentChatId ? 'lg:pt-4' : 'lg:pt-0'} pb-32 ${currentChatId ? 'mt-6 lg:mt-0' : 'mt-12'}`}>
                    {!currentChatId ? (
                        <div className="flex flex-col items-center justify-center h-full p-8">
                            <MessageSquareText className="h-12 w-12 text-primary mb-4" />
                            <h3 className="text-lg font-medium">Start a new chat</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
                                Create a new chat to start interacting with your database.
                            </p>
                            <Button 
                                onClick={createNewChat} 
                                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                <PlusCircle className="h-4 w-4 mr-2" />
                                New Chat
                            </Button>
                        </div>
                    ) : (
                        <>
                            <AnimatePresence>
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="w-full"
                                    >
                                        <div className={`w-full py-6 px-6 ${msg.isUser ? 'bg-background' : 'bg-muted/30'}`}>
                                            <div className="max-w-3xl mx-auto flex items-start gap-4">
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'}`}>
                                                    {msg.isUser ? (
                                                        <User className="h-5 w-5" />
                                                    ) : (
                                                        <Database className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    {renderMessageContent(msg)}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {isLoading && (
                                <div className="w-full py-6 px-6 bg-muted/30">
                                    <div className="max-w-3xl mx-auto flex items-start gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted-foreground/20">
                                            <Database className="h-5 w-5" />
                                        </div>
                                        <LoadingDots />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t fixed bottom-0 w-full lg:w-[calc(100%-16rem)] bg-background">
                    <div className="max-w-3xl mx-auto flex gap-2">
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
                            className="flex-1 py-6 px-4 rounded-full"
                        />
                        <Button 
                            onClick={handleSend} 
                            disabled={isLoading || !message.trim()}
                            className="rounded-full aspect-square p-2"
                        >
                            <MessageSquareText className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* New Chat Dialog */}
            <NewChatDialog
                open={newChatDialogOpen}
                onOpenChange={setNewChatDialogOpen}
                connections={connections}
                onCreateChat={handleCreateChat}
            />
        </div>
    );
}
