import { AgentExecutor } from "langchain/agents";

/**
 * Suggests a graph type based on the data and query
 * @param data The data to visualize
 * @param originalQuery The original user query
 * @param agentExecutor The agent executor to use for LLM calls
 * @returns A visualization configuration or null
 */
export async function suggestGraphType(
    data: string,
    originalQuery: string,
    agentExecutor: AgentExecutor,
): Promise<Record<string, unknown> | null> {
    console.log(
        "Suggesting graph type for data:",
        data.substring(0, 200) + "...",
    );

    const prompt =
        `Given the following data and the original user query, analyze it and determine the best way to visualize it. 
  Choose the most appropriate chart type based on the data characteristics:
  
  1. For time series or trend data: Use a LINE CHART
  2. For comparing values across categories: Use a BAR CHART
  3. For part-to-whole relationships: Use a PIE CHART
  4. For showing a single metric against a goal: Use a RADIAL CHART
  5. For showing changes over time with cumulative values: Use an AREA CHART
  
  Original user query: "${originalQuery}"
  
  Return a complete visualization configuration in JSON format with the following structure:
  
  For LINE CHART:
  {
    "type": "line",
    "componentConfig": {
      "data": [array of data points with x and y values],
      "config": {key-value pairs for each line with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values (usually dates/categories)",
      "lineKeys": [array of keys to use for the lines],
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For BAR CHART:
  {
    "type": "bar",
    "componentConfig": {
      "data": [array of data points],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values (categories)",
      "barKeys": [array of keys to use for the bars],
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For AREA CHART:
  {
    "type": "area",
    "componentConfig": {
      "data": [array of data points],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "xAxisKey": "The key for x-axis values",
      "areaKey": "The key for the area values",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For PIE CHART:
  {
    "type": "pie",
    "componentConfig": {
      "data": [
        { "name": "Category1", "value": 100 },
        { "name": "Category2", "value": 200 }
      ],
      "config": {
        "Category1": { "label": "Category1", "color": "hsl(var(--chart-1))" },
        "Category2": { "label": "Category2", "color": "hsl(var(--chart-2))" }
      },
      "title": "Descriptive chart title",
      "description": "Optional description",
      "dataKey": "value",
      "nameKey": "name",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  For RADIAL CHART:
  {
    "type": "radial",
    "componentConfig": {
      "data": [array of numeric values],
      "config": {key-value pairs with label and color},
      "title": "Descriptive chart title",
      "description": "Optional description",
      "labelText": "Label for the central value",
      "footerText": "Optional footer text",
      "trendText": "Optional trend description"
    }
  }
  
  Here is the data to analyze: ${data}
  
  If the data is not suitable for visualization, return null.
  
  IMPORTANT: Ensure that the data structure matches exactly what the chart component expects. For example:
  - For pie charts, each data item should have 'name' and 'value' properties
  - For radial charts, provide numeric values that can be averaged
  - For line and area charts, ensure the xAxisKey exists in each data point
  - For bar charts, ensure the xAxisKey (category) exists in each data point
  
  IMPORTANT FOR COLORS:
  - For pie charts, the config must use this exact format:
    "config": {
      "CategoryName1": { "label": "CategoryName1", "color": "hsl(var(--chart-1))" },
      "CategoryName2": { "label": "CategoryName2", "color": "hsl(var(--chart-2))" }
    }
  - Do NOT use this format for pie charts (it won't work):
    "config": {
      "CategoryName1": "hsl(var(--chart-1))",
      "CategoryName2": "hsl(var(--chart-2))"
    }
  - Use explicit HSL color values like "hsl(var(--chart-1))" through "hsl(var(--chart-5))" for consistent coloring
  `;

    try {
        console.log("Sending visualization suggestion prompt to LLM");

        const response = await agentExecutor.invoke({
            input: prompt,
        });

        console.log("Raw visualization suggestion response:", response.output);

        // Clean the response by removing markdown code blocks
        let cleanedResponse = response.output;
        if (cleanedResponse.includes("```json")) {
            cleanedResponse = cleanedResponse.replace(/```json\n|\n```/g, "");
        } else if (cleanedResponse.includes("```")) {
            cleanedResponse = cleanedResponse.replace(/```\n|\n```/g, "");
        }
        cleanedResponse = cleanedResponse.trim();

        // Parse the cleaned response as JSON
        try {
            // Check if the response is "null" or indicates no visualization
            if (
                cleanedResponse.toLowerCase() === "null" ||
                cleanedResponse.toLowerCase().includes("not suitable") ||
                cleanedResponse.toLowerCase().includes(
                    "cannot be visualized",
                ) ||
                cleanedResponse.toLowerCase().includes("i'm sorry") ||
                cleanedResponse.toLowerCase().includes("i don't know")
            ) {
                console.log("Data not suitable for visualization");
                return null;
            }

            // Try to parse the JSON response
            let result;
            try {
                result = JSON.parse(cleanedResponse);
            } catch (parseError) {
                console.error("Failed to parse JSON response:", parseError);
                console.log("Response content:", cleanedResponse);
                return null;
            }

            // Validate the result has the required structure
            if (!result || !result.type || !result.componentConfig) {
                console.error("Invalid visualization format:", result);
                return null;
            }

            // Additional validation based on chart type
            const config = result.componentConfig;

            if (
                !config.data || !Array.isArray(config.data) ||
                config.data.length === 0
            ) {
                console.error("Visualization data is empty or invalid");
                return null;
            }

            // Fix color format if needed
            if (config.config) {
                Object.entries(config.config).forEach(([key, value]) => {
                    const configValue = value as { color: string };
                    if (
                        configValue.color &&
                        configValue.color.startsWith("var(--color-")
                    ) {
                        // Convert var(--color-X) to hsl(var(--chart-Y))
                        const colorIndex =
                            (Object.keys(config.config).indexOf(key) % 5) +
                            1;
                        configValue.color = `hsl(var(--chart-${colorIndex}))`;
                    }
                });
            }

            // Special handling for pie chart colors
            if (result.type.toLowerCase() === "pie") {
                const nameKey = config.nameKey || "name";

                // If config is in the wrong format (direct key-color mapping), convert it
                if (
                    config.config && typeof config.config === "object" &&
                    Object.values(config.config).some((v) =>
                        typeof v === "string"
                    )
                ) {
                    console.log("Converting pie chart color format");
                    config.config = {};

                    // Create proper config entries for each slice
                    config.data.forEach(
                        (item: Record<string, unknown>, index: number) => {
                            const key = item[nameKey];
                            if (
                                key &&
                                (typeof key === "string" ||
                                    typeof key === "number")
                            ) {
                                const colorIndex = (index % 5) + 1;
                                config.config[key] = {
                                    label: key,
                                    color: `hsl(var(--chart-${colorIndex}))`,
                                };
                            }
                        },
                    );
                }

                // If no config exists, create one
                if (!config.config) {
                    config.config = {};

                    // Create config entries for each slice
                    config.data.forEach(
                        (item: Record<string, unknown>, index: number) => {
                            const key = item[nameKey];
                            if (
                                key &&
                                (typeof key === "string" ||
                                    typeof key === "number")
                            ) {
                                const colorIndex = (index % 5) + 1;
                                config.config[key] = {
                                    label: key,
                                    color: `hsl(var(--chart-${colorIndex}))`,
                                };
                            }
                        },
                    );
                }
            } // For other charts, create config entries for each data key if no config exists
            else if (!config.config) {
                config.config = {};
                const sampleItem = config.data[0];
                Object.keys(sampleItem).forEach((key, index) => {
                    if (
                        key !== config.xAxisKey && key !== "name" &&
                        typeof sampleItem[key] === "number"
                    ) {
                        config.config[key] = {
                            label: key,
                            color: `hsl(var(--chart-${index % 5 + 1}))`,
                        };
                    }
                });
            }

            console.log(
                "Visualization suggestion:",
                JSON.stringify(result, null, 2),
            );
            return result;
        } catch (e) {
            console.error("Failed to parse JSON response:", e);
            console.error("Response content:", cleanedResponse);
            return null;
        }
    } catch (error) {
        console.error("Error getting graph type suggestion:", error);
        return null;
    }
}

/**
 * Suggests table data based on the data and query
 * @param data The data to display in a table
 * @param originalQuery The original user query
 * @param agentExecutor The agent executor to use for LLM calls
 * @returns A table data configuration or null
 */
export async function suggestTableData(
    data: string,
    originalQuery: string,
    agentExecutor: AgentExecutor,
): Promise<Record<string, unknown> | null> {
    console.log("Suggesting table data for:", data.substring(0, 200) + "...");

    const prompt =
        `Given the following data and the original user query, analyze it and determine if it would be beneficial to display the data in a table format.
  
  Original user query: "${originalQuery}"
  
  Return a complete table configuration in JSON format with the following structure if the data is suitable for a table:
  
  {
    "type": "table",
    "componentConfig": {
      "data": [array of data objects where each object represents a row],
      "columns": [
        {
          "key": "column1",
          "header": "Column 1 Header",
          "isNumeric": false
        },
        {
          "key": "column2",
          "header": "Column 2 Header",
          "isNumeric": true
        }
        // Add more columns as needed
      ],
      "caption": "Optional table caption",
      "footerData": {
        "label": "Optional footer label (e.g., 'Total')",
        "value": "Optional footer value (e.g., sum of a column)",
        "colSpan": 3  // Optional, number of columns the label should span
      },
      "title": "Optional table title",
      "config": {
        // Optional color configuration for specific columns or values
        "column1": {
          "label": "Column 1",
          "color": "hsl(var(--chart-1))"
        }
      }
    }
  }
  
  Here is the data to analyze: ${data}
  
  If the data is not suitable for a table display, return null.
  
  IMPORTANT: 
  - The 'key' in each column must match a property name in the data objects
  - Set 'isNumeric' to true for columns containing numeric values to right-align them
  - Only include a footerData if there's a meaningful summary value (like a sum or average)
  - Make sure all data objects have consistent properties
  - If the data is already in a table format in the markdown, extract and structure it properly
  - Use explicit HSL color values like "hsl(var(--chart-1))" through "hsl(var(--chart-5))" for consistent coloring
  `;

    try {
        console.log("Sending table data suggestion prompt to LLM");

        const response = await agentExecutor.invoke({
            input: prompt,
        });

        console.log("Raw table data suggestion response:", response.output);

        // Clean the response by removing markdown code blocks
        let cleanedResponse = response.output;
        if (cleanedResponse.includes("```json")) {
            cleanedResponse = cleanedResponse.replace(/```json\n|\n```/g, "");
        } else if (cleanedResponse.includes("```")) {
            cleanedResponse = cleanedResponse.replace(/```\n|\n```/g, "");
        }
        cleanedResponse = cleanedResponse.trim();

        // Parse the cleaned response as JSON
        try {
            // Check if the response is "null" or indicates no table data
            if (
                cleanedResponse.toLowerCase() === "null" ||
                cleanedResponse.toLowerCase().includes("not suitable") ||
                cleanedResponse.toLowerCase().includes("cannot be displayed") ||
                cleanedResponse.toLowerCase().includes("i'm sorry") ||
                cleanedResponse.toLowerCase().includes("i don't know")
            ) {
                console.log("Data not suitable for table display");
                return null;
            }

            // Try to parse the JSON response
            let result;
            try {
                result = JSON.parse(cleanedResponse);
            } catch (parseError) {
                console.error("Failed to parse JSON response:", parseError);
                console.log("Response content:", cleanedResponse);
                return null;
            }

            // Validate the result has the required structure
            if (!result || !result.type || !result.componentConfig) {
                console.error("Invalid table format:", result);
                return null;
            }

            // Additional validation for table data
            const config = result.componentConfig;

            if (
                !config.data || !Array.isArray(config.data) ||
                config.data.length === 0
            ) {
                console.error("Table data is empty or invalid");
                return null;
            }

            if (
                !config.columns || !Array.isArray(config.columns) ||
                config.columns.length === 0
            ) {
                console.error("Table columns are missing or invalid");

                // Try to auto-generate columns from the first data item
                const firstItem = config.data[0];
                if (firstItem && typeof firstItem === "object") {
                    config.columns = Object.keys(firstItem).map((key) => ({
                        key,
                        header: key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/([A-Z])/g, " $1").trim(),
                        isNumeric: typeof firstItem[key] === "number",
                    }));

                    console.log("Auto-generated columns:", config.columns);
                } else {
                    return null;
                }
            }

            // Ensure we have a config object for colors
            if (!config.config) {
                config.config = {};

                // Auto-generate colors for columns
                config.columns.forEach(
                    (
                        column: { key: string; header: string },
                        index: number,
                    ) => {
                        config.config[column.key] = {
                            label: column.header,
                            color: `hsl(var(--chart-${(index % 5) + 1}))`,
                        };
                    },
                );
            } else {
                // Fix color format if needed
                Object.entries(config.config).forEach(([key, value]) => {
                    const configValue = value as { color?: string };
                    if (
                        configValue.color &&
                        configValue.color.startsWith("var(--color-")
                    ) {
                        // Convert var(--color-X) to hsl(var(--chart-Y))
                        const colorIndex =
                            (Object.keys(config.config).indexOf(key) % 5) +
                            1;
                        configValue.color = `hsl(var(--chart-${colorIndex}))`;
                    }
                });
            }

            console.log(
                "Table data suggestion:",
                JSON.stringify(result, null, 2),
            );
            return result;
        } catch (e) {
            console.error("Failed to parse JSON response for table data:", e);
            console.error("Response content:", cleanedResponse);
            return null;
        }
    } catch (error) {
        console.error("Error getting table data suggestion:", error);
        return null;
    }
}
