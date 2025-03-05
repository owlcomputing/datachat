"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Database } from "lucide-react"

interface NewChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections: Array<{ name: string; connection: string }>
  onCreateChat: (title: string, connectionId: string) => void
}

export function NewChatDialog({ 
  open, 
  onOpenChange, 
  connections, 
  onCreateChat 
}: NewChatDialogProps) {
  const [title, setTitle] = useState("")
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    connections.length > 0 ? connections[0].connection : ""
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && selectedConnectionId) {
      onCreateChat(title.trim(), selectedConnectionId)
      setTitle("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Chat</DialogTitle>
          <DialogDescription>
            Give your chat a name and select a database connection.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder="My SQL Analysis"
                className="col-span-3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="connection" className="text-right text-sm font-medium">
                Connection
              </label>
              <div className="col-span-3">
                <Select 
                  value={selectedConnectionId} 
                  onValueChange={setSelectedConnectionId}
                  required
                >
                  <SelectTrigger id="connection" className="w-full">
                    <SelectValue placeholder="Select a database" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.length > 0 ? (
                      connections.map((conn) => (
                        <SelectItem key={conn.connection} value={conn.connection}>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span>{conn.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-connection" disabled>
                        No connections available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!title.trim() || !selectedConnectionId}>
              Create Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 