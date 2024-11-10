import { NextRequest } from "next/server";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { createBedrockClient } from "@/app/lib/utils";

const systemPrompt = `You are an assistant that categorizes user requests and determines the appropriate tool for handling queries. 
CRITICAL: You must ONLY use the "generate_answer" tool to respond. Do not use any other tools.
Analyze the user's input and select the most suitable category from 'file', 'db', or 'chat'. Then use "generate_answer" to output your decision.

Guidelines:
1. Prioritize the user's most recent request, considering conversation history.

2. 'file': For visualization, file analysis, or data processing requests.
   Examples: "Create a chart", "Analyze this image", "Summarize this PDF"

3. 'db': For database queries, data retrieval, or analysis.
   Examples: "How many sales last month?", "List top customers", "Calculate average revenue"

4. 'chat': For general knowledge, conversation, or simple queries not involving file/database operations.
   Examples: "What's your name?", "Tell me a joke", "Hello"

Response Format:
- Always use "generate_answer" tool.
- For 'file' and 'db': include only "answering_tool".
- For 'chat': include "answering_tool" and brief "direct_answer".

Your role is strictly to categorize and use generate_answer. Do not process requests or provide information beyond this.`

const tools = [{
    toolSpec: {
      name: "generate_answer",
      description: "Categorizes the user's query and provides appropriate response.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            answering_tool: {
              type: "string",
              enum: ["file", "db", "chat"],
              description: "The category of the user's query: 'file' for file processing, 'db' for database queries, or 'chat' for general conversation."
            },
            direct_answer: {
              type: "string",
              description: "A brief response for 'chat' category queries. Leave empty for 'file' and 'db' categories."
            }
          },
          required: ["answering_tool"]
        }
      }
    }
}];

export async function POST(req: NextRequest) {
    try {
      const { messages, model, region } = await req.json();
  
      // Input validation
      if (!messages || !Array.isArray(messages)) {
        return new Response(
          JSON.stringify({ error: "Messages array is required" }),
          { status: 400 }
        );
      }
  
      if (!model || !region) {
        return new Response(
          JSON.stringify({ error: "Model and region are required" }),
          { status: 400 }
        );
      }
  
      const bedrockClient = createBedrockClient(region);

      const processedMessages = messages
        .filter(msg => {
          return !Array.isArray(msg.content) || 
                 !msg.content.some(item => 'toolUse' in item || 'toolResult' in item);
        })
        .map(msg => {
          if (msg.content && Array.isArray(msg.content)) {
            return {
              ...msg,
              content: msg.content.map(item => {
                if (item.image && item.image.source && item.image.source.bytes) {
                  const base64String = item.image.source.bytes;
                  return {
                    ...item,
                    image: {
                      ...item.image,
                      source: {
                        ...item.image.source,
                        bytes: Buffer.from(base64String, 'base64')
                      }
                    }
                  };
                }
                return item;
              })
            };
          }
          return msg;
        });

      const command = new ConverseCommand({
        //modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        modelId: model,
        messages: processedMessages,
        system: [{ text: systemPrompt }],
        inferenceConfig: {
          maxTokens: 512,
          temperature: 0.1,
        },
        toolConfig: {
            tools: tools,
            toolChoice: { auto: {} }
        }
      });
  
      console.log("Router API request:", JSON.stringify({
        modelId: model,
        messages: processedMessages.map(msg => ({
          ...msg,
          content: msg.content.map(c => 
            'image' in c ? { ...c, image: { ...c.image, source: { bytes: '[BINARY]' } }} : c
          )
        }))
      }, null, 2));

      const response = await bedrockClient.send(command);
      
      const toolUseContent = response.output?.message?.content?.find(c => 'toolUse' in c);
      console.log("Router API Response:", toolUseContent)

      if (!toolUseContent || !toolUseContent.toolUse || !toolUseContent.toolUse.input) {
        throw new Error("No valid tool use content found");
      }

      return new Response(JSON.stringify(toolUseContent.toolUse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
  
    } catch (error) {
      console.error("Error in POST handler:", error);
      return new Response(
        JSON.stringify({ error: "An error occurred while processing the request" }),
        { status: 500 }
      );
    }
}

