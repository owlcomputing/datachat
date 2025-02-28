import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Database, Settings, User } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'

export default function ProfilePage() {
  const [connections, setConnections] = useState<Array<{
    display_name: string;
    id: string;
  }>>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null); // Store email
  const supabaseClient = useSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error);
        // Handle error (e.g., redirect to login)
        router.push('/login'); // Redirect to login on error
        return;
      }

      if (session?.user) {
        setUserEmail(session.user.email || null); // Set the email
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
        const { data, error } = await supabaseClient
          .from('database_connections')
          .select('display_name, id')
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
    fetchConnections(); // Call fetchConnections here
  }, [supabaseClient, router])


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
    };

    try {
      const response = await fetch('http://127.0.0.1:54322/functions/v1/save-db-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConnection),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Connection saved successfully!");
        // Optionally, refresh the connections list
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (session?.user && !sessionError) {
          const { data, error } = await supabaseClient
            .from('database_connections')
            .select('display_name, id')
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

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4">
        <nav className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
          <div className="space-y-1">
            {connections.map((db) => (
              <Link href="/" key={db.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <span className="truncate">{db.display_name}</span>
                </Button>
              </Link>
            ))}
          </div>

          <div className="pt-4 border-t">
            <Link href="/profile">
              <Button
                variant="ghost"
                className="w-full justify-start"
              >
                <User className="h-4 w-4 mr-2" />
                Profile & Settings
              </Button>
            </Link>
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col p-8">
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
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" />
              <Input placeholder="Last Name" />
              <Input placeholder="Email" type="email" className="col-span-2" />
              <Input placeholder="Password" type="password" className="col-span-2" />
            </div>
            <Button className="mt-4">Update Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              Database Connections
            </CardTitle>
            <CardDescription>Manage your data connections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{connection.display_name}</h3>
                    {/* <p className="text-sm text-muted-foreground">
                      {connection.type} • {connection.status}
                    </p> */}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleRemove(connection.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Add New Connection</h3>
              <form onSubmit={handleAddConnection}>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Connection Title"
                    name="name"
                    required
                  />
                  <Input
                    placeholder="Database Name"
                    name="dbname"
                    required
                  />
                  <Input
                    placeholder="Host"
                    className="col-span-2"
                    name="host"
                    required
                  />
                  <Input
                    placeholder="Port"
                    name="port"
                    type="number"
                    required
                  />
                  <Input
                    placeholder="Username"
                    name="username"
                    required
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    className="col-span-2"
                    name="password"
                    required
                  />
                </div>
                <Button className="mt-4" type="submit">
                  Add Connection
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 