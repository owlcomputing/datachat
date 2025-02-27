import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Database, Rocket, BarChart } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <nav className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">DataDash</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/">Get Started</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center">
        <div className="container max-w-6xl py-20">
          <section className="text-center space-y-6 mb-24">
            <h1 className="text-5xl font-bold tracking-tight">
              Visualize Your Data
              <br />
              <span className="text-primary">Like Never Before</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform raw numbers into stunning interactive dashboards with our AI-powered analytics platform
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/" className="flex gap-2">
                  <Rocket className="h-4 w-4" />
                  Start Exploring
                </Link>
              </Button>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-8 mb-24">
            <div className="p-6 border rounded-lg bg-background">
              <BarChart className="h-8 w-8 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Real-time Analytics</h3>
              <p className="text-muted-foreground">
                Interactive charts that update as new data arrives
              </p>
            </div>
            <div className="p-6 border rounded-lg bg-background">
              <Database className="h-8 w-8 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Multi-source</h3>
              <p className="text-muted-foreground">
                Connect to various databases and APIs
              </p>
            </div>
            <div className="p-6 border rounded-lg bg-background">
              <Rocket className="h-8 w-8 mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">AI Insights</h3>
              <p className="text-muted-foreground">
                Get automated insights using natural language
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="text-center text-sm text-muted-foreground py-8 border-t">
        © 2024 DataDash. All rights reserved.
      </footer>
    </div>
  )
} 