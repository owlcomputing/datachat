import React, { useState, useEffect } from 'react';

export default function TestPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize agent when component mounts
    const initAgent = async () => {
      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'initialize' }),
        });

        if (!response.ok) {
          throw new Error('Failed to initialize agent');
        }
        
        setInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setResponse('Error: Failed to initialize agent');
      }
    };

    initAgent();

    // No explicit cleanup needed as the agent will be garbage collected
    // when the server-side API route is no longer in use
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialized) {
      setResponse('Error: Agent not initialized');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setResponse(data.response);
    } catch (error) {
      console.error('Error:', error);
      setResponse('Error: Failed to get response from agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Agent Test Page</h1>
        
        {!initialized && (
          <div className="mb-4 text-yellow-500">
            Initializing agent...
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2 border rounded bg-background"
              rows={4}
              placeholder="Enter your message here..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || !message}
            className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Send Message'}
          </button>
        </form>

        {response && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Response:</h2>
            <div className="p-4 bg-muted rounded whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
