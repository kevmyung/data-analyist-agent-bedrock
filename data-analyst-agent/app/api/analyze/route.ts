// app/api/analyze/route.ts
import { NextRequest } from "next/server";
import { ConverseCommand, BedrockRuntimeServiceException } from "@aws-sdk/client-bedrock-runtime";
import { createBedrockClient } from "@/app/lib/utils";
import fs from 'fs/promises';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';


export async function POST(req: NextRequest) {
    try {
        const { messages, model, region } = await req.json();

        console.log("🔍 Received API request:", JSON.stringify({
            messages,
            model,
            region,
        }, null, 2));

        // Input validation
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "Messages are required and must be a non-empty array" }),
                { status: 400 }
            );
        }

        if (!model) {
            return new Response(
                JSON.stringify({ error: "Model selection is required" }),
                { status: 400 }
            );
        }

        if (!region) {
            return new Response(
                JSON.stringify({ error: "Region selection is required" }),
                { status: 400 }
            );
        }

        const bedrockClient = createBedrockClient(region);

        const schemaPath = path.resolve(process.cwd(), '../db_schema.json');
        const schemaContent = await fs.readFile(schemaPath, 'utf-8');
        const tableSchema = JSON.parse(schemaContent);

        const dbPath = path.resolve(process.cwd(), '../sample.db');
        const tableName = 'sales_table';

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        const sampleData = await db.all(`SELECT * FROM ${tableName} LIMIT 3`);

        const systemPrompt = `You are a database expert. When given a user's natural language question and a table schema, your role is to generate an SQL query that answers the question.  Use the generate_sql_query tool to output the query.

Always:
- Analyze the user's question carefully.
- Use the columns from the provided table schema.
- Ensure the SQL query is syntactically correct.
- Use appropriate SQL functions and clauses.
- Use the table name '${tableName}' in your queries.

Never:
- Include any additional information in your responses.
- Mention the tool or any implementation details.
- Provide explanations or commentary.
        
Focus on providing the correct SQL query that answers the user's question.

Here is the table schema for the table '${tableName}':
${JSON.stringify(tableSchema, null, 2)}

Here are some sample data for the table '${tableName}':
${JSON.stringify(sampleData, null, 2)}
`;
        
        const tools = [{
            toolSpec: {
              name: "generate_sql_query",
              description: "Generate an SQL query based on a user's question and a given table schema.",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    query: { type: "string"},
                    explanation: { type: "string"},
                  },
                  required: ["query", "explanation"]
                }
              }
            }
          }];
        
        const command = new ConverseCommand({
            modelId: model,
            messages: messages,
            system: [{ text: systemPrompt }],
            inferenceConfig: {
                maxTokens: 4096,
                temperature: 0.0,
                topP: 0.1,
            },
            toolConfig: {
                tools: tools,
                toolChoice: { auto: {} }
            }
        });

        console.log("Final API request:", JSON.stringify({
            modelId: model,
            messages: messages,
        }, null, 2));

        const response = await bedrockClient.send(command);

        console.log("📊 Raw Bedrock Response:", JSON.stringify(response, null, 2));

        if (!response.output?.message?.content) {
            throw new Error("Invalid response from Bedrock API");
        }

        const textContent = response.output.message.content.find(c => 'text' in c);
        const toolUseContent = response.output.message.content.find(c => 'toolUse' in c);

        const processToolResponse = (toolUseContent: any) => {
            try {
                if (!toolUseContent || !toolUseContent.toolUse || !toolUseContent.toolUse.input) {
                    console.log("No valid tool use content found");
                    return null;
                }

                // Get the tool input from the response
                const toolInput = toolUseContent.toolUse.input;
                console.log("Tool Input:", toolInput);

                const toolData = typeof toolInput === 'string' ? JSON.parse(toolInput) : toolInput;

                if (!toolData.query || typeof toolData.query !== 'string') {
                    throw new Error("Invalid query data structure");
                }

                return {
                    query: toolData.query,
                    explanation: toolData.explanation || ''
                  };          

            } catch (error) {
                console.error("Error processing tool response:", error);
                return null;
            }
        };

        let generatedQueryData = toolUseContent ? processToolResponse(toolUseContent) : null;

        let queryResult = null;
        if (generatedQueryData && generatedQueryData.query) {
            try {
                console.log("Executing Query:", generatedQueryData.query);
                queryResult = await db.all(generatedQueryData.query);
            } catch (dbError) {
                console.error("Database execution error:", dbError);
            }
        }
        
        const responseData = {
            query: generatedQueryData?.query || null,
            explanation: generatedQueryData?.explanation || null,
            result: queryResult,
            content: textContent?.text || "No response generated"
        };
        
        return new Response(
            JSON.stringify(responseData),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                }
            }
        );

    } catch (error) {
        console.error("❌ Analyze API Error: ", error);
        console.error("Full error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });

        if (error instanceof BedrockRuntimeServiceException) {
            return new Response(
                JSON.stringify({
                    error: "AWS Service Error",
                    details: error.message,
                    code: error.$metadata.httpStatusCode
                }),
                { 
                    status: error.$metadata.httpStatusCode || 500,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "An unknown error occurred",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}