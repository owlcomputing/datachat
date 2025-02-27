import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Database, Settings, User } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from 'react'

export default function ProfilePage() {
  const [connections, setConnections] = useState<Array<{ 
    name: string
    connection: string
    type: string
    status: string
  }>>([])

  // Sync with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = JSON.parse(localStorage.getItem('connections') || '[]')
      setConnections(saved)
    }
  }, [])

  const handleAddConnection = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const newConnection = {
      name: formData.get('name') as string,
      connection: formData.get('name')?.toString().toLowerCase().replace(/\s+/g, '-') || '',
      type: formData.get('type') as string,
      status: "Connected"
    }
    
    const updated = [...connections, newConnection]
    setConnections(updated)
    localStorage.setItem('connections', JSON.stringify(updated))
  }

  const handleRemove = (connectionId: string) => {
    const updated = connections.filter(c => c.connection !== connectionId)
    setConnections(updated)
    localStorage.setItem('connections', JSON.stringify(updated))
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      <aside className="hidden lg:block w-64 border-r border-border bg-muted/20 p-4">
        <nav className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Data Connections</h2>
          <div className="space-y-1">
            {connections.map((db) => (
              <Link href="/" key={db.connection}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <span className="truncate">{db.name}</span>
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
                <div key={connection.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{connection.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {connection.type} • {connection.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleRemove(connection.connection)}>
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
                    placeholder="Connection Name" 
                    name="name"
                    required
                  />
                  <Input 
                    placeholder="Database Type" 
                    name="type"
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