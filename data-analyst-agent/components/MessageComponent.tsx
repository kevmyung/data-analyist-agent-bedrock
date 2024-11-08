import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChartLine } from "lucide-react";
import FilePreview from "@/components/FilePreview";
import { Message, ContentBlock } from '@/types/chat'; 

interface MessageComponentProps {
  message: Message;
}

export const MessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
    const hasText = (content: ContentBlock): content is { text: string } => {
      return 'text' in content && typeof content.text === 'string';
    };
  
    const textContent = message.content.find(hasText);
    if (!textContent) {
      return null;
    }
  
    return (
      <div className="flex items-start gap-2">
        {message.role === "assistant" && (
          <Avatar className="w-8 h-8 border">
            <AvatarImage src="/bedrock-logo.png" alt="AI Assistant Avatar" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        )}
        <div
          className={`flex flex-col max-w-[75%] ${
            message.role === "user" ? "ml-auto" : ""
          }`}
        >
          <div
            className={`p-3 rounded-md text-base ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted border"
            }`}
          >
            {message.role === "assistant" ? (
              <div className="flex flex-col gap-2">
                {message.hasToolUse && (
                  <Badge variant="secondary" className="inline-flex px-0">
                    <ChartLine className="w-4 h-4 mr-1" /> Generated Chart
                  </Badge>
                )}
                <span>{message.content[0].text}</span>
              </div>
            ) : (
              <span>{message.content[0].text}</span>
            )}
          </div>
          {message.file && (
            <div className="mt-1.5">
              <FilePreview file={message.file} size="small" />
            </div>
          )}
        </div>
      </div>
    );
  };