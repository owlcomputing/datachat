"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const chartData = [
  { month: "Month 1", pts: 17, ast: 4, reb: 13, fgPct: 0.44 },
  { month: "Month 2", pts: 20, ast: 7, reb: 6, fgPct: 0.64 },
  { month: "Month N", pts: 28, ast: 5, reb: 14, fgPct: 0.48 },
]

const chartConfig = {
  pts: {
    label: "Points",
    color: "hsl(var(--chart-1))",
  },
  ast: {
    label: "Assists",
    color: "hsl(var(--chart-2))",
  },
  reb: {
    label: "Rebounds",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function AreaChartTest({ data, gamesToShow }: { 
  data: typeof chartData 
  gamesToShow: number | 'all'
}) {
  const filteredData = gamesToShow === 'all' ? data : data.slice(-gamesToShow)
  const [selectedStats, setSelectedStats] = useState<Array<keyof typeof chartConfig>>(['pts', 'ast', 'reb'])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>
          <Tabs 
            value={gamesToShow.toString()}
            onValueChange={(value) => {
              const newValue = value === 'all' ? 'all' : Number(value)
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gameFilterChange', { detail: newValue }))
              }
            }}
            className="w-full"
          >
            <TabsList className="grid h-9 w-full grid-cols-6 gap-1 bg-background p-1 text-muted-foreground">
              <TabsTrigger
                value="all"
                className="rounded-sm px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                All
              </TabsTrigger>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <TabsTrigger
                  key={num}
                  value={num.toString()}
                  className="rounded-sm px-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {num}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={filteredData}
            margin={{ left: 12, right: 12, top: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.replace('Game ', '')}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            
            {Object.entries(chartConfig).map(([key, config]) => (
              <Area
                key={key}
                dataKey={key}
                type="natural"
                fill={config.color}
                fillOpacity={0.1}
                stroke={config.color}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              January - June 2024
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

export default AreaChartTest;
