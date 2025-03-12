import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Database, ChevronLeft, User, Eye, EyeOff, Plus, Server, Globe, Key, FileText } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

// Define a type for database connection
type DatabaseConnection = {
  id: string;
  display_name: string;
  host?: string;
  port?: number;
  dbname?: string;
  username?: string;
  password?: string;
  dialect?: string;
  instructions?: string;
};

export default function ProfilePage() {
  const [connections, setConnections] = useState<Array<DatabaseConnection>>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabaseClient = useSupabaseClient();
  const router = useRouter();
  
  // State for the edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // State for the add connection modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error);
        router.push('/login');
        return;
      }

      if (session?.user) {
        setUserEmail(session.user.email || null);
      } else {
        router.push('/login');
      }
    };

    const fetchConnections = async () => {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

      if (sessionError) {
        console.error("Error fetching session:", sessionError);
        router.push('/login');
        return;
      }

      if (session?.user) {
        // Fetch all connection details, not just display_name and id
        const { data, error } = await supabaseClient
          .from('database_connections')
          .select('*')
          .eq('user_id', session.user.id);

        if (error) {
          console.error("Error fetching connections:", error);
        } else if (data) {
          setConnections(data);
        }
      } else {
        router.push('/login');
      }
    };

    fetchUser();
    fetchConnections();
  }, [supabaseClient, router]);

  const handleAddConnection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session || error) {
      alert("Please sign in to add connections.");
      return;
    }

    const newDisplayName = formData.get('name') as string;

    // Frontend validation: Check for duplicate display names
    if (connections.some(conn => conn.display_name === newDisplayName)) {
      alert("A connection with this display name already exists. Please choose a different name.");
      return; // Prevent form submission
    }

    const newConnection = {
      userId: session.user.id,
      dbname: formData.get('dbname') as string,
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      host: formData.get('host') as string,
      port: parseInt(formData.get('port') as string),
      displayName: newDisplayName, // Use the validated name
      instructions: formData.get('instructions') as string || '', // Add instructions field
    };

    try {
      const response = await fetch('http://127.0.0.1:54322/functions/v1/save-db-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnection),
      });

      const data = await response.json();

      if (response.ok) {
        setIsAddModalOpen(false); // Close the modal on success
        alert("Connection saved successfully!");
        // Optionally, refresh the connections list
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (session?.user && !sessionError) {
          const { data, error } = await supabaseClient
            .from('database_connections')
            .select('*')
            .eq('user_id', session.user.id)
          if (error) {
            console.error('Failed to refetch', error)
          } else if (data) {
            setConnections(data)
          }
        }
      } else {
        alert(`Failed to save connection: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error saving connection:", error);
      alert("Error saving connection. Please try again.");
    }
  };

  const handleRemove = async (connectionId: string) => {
    // Remove connection logic
    const { error } = await supabaseClient
      .from('database_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      console.error("Error deleting connection:", error);
      alert(`Failed to delete connection: ${error.message}`);
    } else {
      // Remove the connection from the local state
      setConnections(connections.filter(conn => conn.id !== connectionId));
      alert("Connection removed successfully!");
    }
  }

  const handleLogout = async () => {
    await supabaseClient.auth.signOut()
    router.push('/login')
  }

  const handleEdit = (connection: DatabaseConnection) => {
    setEditingConnection(connection);
    setIsEditModalOpen(true);
    setShowPassword(false); // Reset password visibility
  }

  const handleUpdateConnection = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!editingConnection) return;
    
    const formData = new FormData(e.currentTarget);
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session || error) {
      alert("Please sign in to update connections.");
      return;
    }

    const updatedConnection = {
      id: editingConnection.id,
      display_name: formData.get('display_name') as string,
      dbname: formData.get('dbname') as string,
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      host: formData.get('host') as string,
      port: parseInt(formData.get('port') as string),
      dialect: editingConnection.dialect || 'postgres', // Preserve the dialect
      instructions: formData.get('instructions') as string || '', // Add instructions field
    };

    try {
      // Update the connection in the database
      const { error } = await supabaseClient
        .from('database_connections')
        .update({
          display_name: updatedConnection.display_name,
          dbname: updatedConnection.dbname,
          username: updatedConnection.username,
          password: updatedConnection.password,
          host: updatedConnection.host,
          port: updatedConnection.port,
          instructions: updatedConnection.instructions, // Add instructions to update
        })
        .eq('id', updatedConnection.id);

      if (error) {
        console.error("Error updating connection:", error);
        alert(`Failed to update connection: ${error.message}`);
      } else {
        // Update the connection in the local state
        setConnections(connections.map(conn => 
          conn.id === updatedConnection.id ? updatedConnection : conn
        ));
        setIsEditModalOpen(false);
        alert("Connection updated successfully!");
      }
    } catch (error) {
      console.error("Error updating connection:", error);
      alert("Error updating connection. Please try again.");
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  // Function to get a color based on the dialect
  const getDialectColor = (dialect?: string) => {
    switch(dialect?.toLowerCase()) {
      case 'postgres':
        return 'bg-blue-100 text-blue-800';
      case 'mysql':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to check if a connection has custom instructions
  const hasInstructions = (connection: DatabaseConnection) => {
    return connection.instructions && connection.instructions.trim().length > 0;
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-1 pl-0 hover:bg-transparent">
              <ChevronLeft className="h-5 w-5" />
              <span>Back to Chat</span>
            </Button>
          </Link>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">Profile & Settings</h1>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-6 w-6" />
                User Profile
              </CardTitle>
              <CardDescription>Update your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userEmail ? (
                <>
                  <p>Email: {userEmail}</p>
                  <Button onClick={handleLogout}>Logout</Button>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-6 w-6" />
                  Database Connections
                </CardTitle>
                <CardDescription>Manage your data connections</CardDescription>
              </div>
              <Button 
                onClick={() => setIsAddModalOpen(true)} 
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Connection
              </Button>
            </CardHeader>
            <CardContent>
              {connections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No connections yet</p>
                  <p className="text-sm mt-1">Add a database connection to get started</p>
                  <Button 
                    onClick={() => setIsAddModalOpen(true)} 
                    className="mt-4"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Connection
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {connections.map((connection) => (
                    <div 
                      key={connection.id} 
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium text-lg">{connection.display_name}</h3>
                        <div className="flex gap-2">
                          <Badge className={getDialectColor(connection.dialect)}>
                            {connection.dialect || 'postgres'}
                          </Badge>
                          {hasInstructions(connection) && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <FileText className="h-3 w-3 mr-1" />
                              Custom Instructions
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span>{connection.host}:{connection.port}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          <span>{connection.dbname}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          <span>{connection.username}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(connection)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemove(connection.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Connection Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update your database connection details.
            </DialogDescription>
          </DialogHeader>
          
          {editingConnection && (
            <form onSubmit={handleUpdateConnection}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="display_name" className="text-right">
                    Name
                  </label>
                  <Input
                    id="display_name"
                    name="display_name"
                    defaultValue={editingConnection.display_name}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="host" className="text-right">
                    Host
                  </label>
                  <Input
                    id="host"
                    name="host"
                    defaultValue={editingConnection.host || ''}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="port" className="text-right">
                    Port
                  </label>
                  <Input
                    id="port"
                    name="port"
                    type="number"
                    defaultValue={editingConnection.port || ''}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="dbname" className="text-right">
                    Database
                  </label>
                  <Input
                    id="dbname"
                    name="dbname"
                    defaultValue={editingConnection.dbname || ''}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="username" className="text-right">
                    Username
                  </label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={editingConnection.username || ''}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="password" className="text-right">
                    Password
                  </label>
                  <div className="col-span-3 relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      defaultValue={editingConnection.password || ''}
                      className="pr-10"
                      required
                    />
                    <button 
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4 pt-2">
                  <label htmlFor="instructions" className="text-right pt-2">
                    Custom Instructions
                  </label>
                  <div className="col-span-3">
                    <Textarea
                      id="instructions"
                      name="instructions"
                      placeholder="Add custom instructions for the AI agent when using this connection. These will be included in the initial prompt."
                      className="min-h-[120px]"
                      defaultValue={editingConnection.instructions || ''}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      These instructions will be added to the AI agent's prompt when using this connection.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Add Connection Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Connection</DialogTitle>
            <DialogDescription>
              Enter your database connection details.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddConnection}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="name" className="text-right">
                  Name
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My Database"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="host" className="text-right">
                  Host
                </label>
                <Input
                  id="host"
                  name="host"
                  placeholder="localhost or IP address"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="port" className="text-right">
                  Port
                </label>
                <Input
                  id="port"
                  name="port"
                  type="number"
                  placeholder="5432"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="dbname" className="text-right">
                  Database
                </label>
                <Input
                  id="dbname"
                  name="dbname"
                  placeholder="Database name"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="username" className="text-right">
                  Username
                </label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Database user"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="new-password" className="text-right">
                  Password
                </label>
                <div className="col-span-3 relative">
                  <Input
                    id="new-password"
                    name="password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Database password"
                    className="pr-10"
                    required
                  />
                  <button 
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={toggleNewPasswordVisibility}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4 pt-2">
                <label htmlFor="new-instructions" className="text-right pt-2">
                  Custom Instructions
                </label>
                <div className="col-span-3">
                  <Textarea
                    id="new-instructions"
                    name="instructions"
                    placeholder="Add custom instructions for the AI agent when using this connection. These will be included in the initial prompt."
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    These instructions will be added to the AI agent's prompt when using this connection.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Connection</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 