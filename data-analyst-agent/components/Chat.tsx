// components/Chat.tsx
import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, MessageCircleQuestion, ChartArea, FileInput } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FilePreview from "@/components/FilePreview";
import { MessageComponent } from "@/components/MessageComponent";
import type { Message, Model, FileUpload } from '@/types/chat';

interface ChatProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  currentUpload: FileUpload | null;
  selectedModel: string;
  selectedRegion: string;
  models: Model[];
  regions: { id: string; name: string }[];
  isThinking: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSelectedModel: (modelId: string) => void;
  setSelectedRegion: (regionId: string) => void;
  setCurrentUpload: (upload: FileUpload | null) => void;
}

const ThinkingIndicator: React.FC = () => {
    return (
      <div className="flex items-center space-x-2 p-4 bg-secondary rounded-lg">
        <div className="text-primary font-medium">AI is thinking</div>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }; 

const Chat: React.FC<ChatProps> = ({
  messages,
  input,
  isLoading,
  currentUpload,
  selectedModel,
  selectedRegion,
  models,
  regions,
  isThinking,
  fileInputRef,  
  onInputChange,
  onKeyDown,
  onSubmit,
  onFileSelect,
  setSelectedModel,
  setSelectedRegion,
  setCurrentUpload,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  return (
    <Card className="w-1/3 flex flex-col h-full">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {messages.length > 0 && (
              <>
                <Avatar className="w-8 h-8 border">
                  <AvatarImage src="/bedrock-logo.png" alt="AI Assistant Avatar" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">Data Analysis Assistant</CardTitle>
                  <CardDescription className="text-xs">Powered by Bedrock</CardDescription>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 text-sm">
                  {regions.find((r) => r.id === selectedRegion)?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {regions.map((region) => (
                  <DropdownMenuItem key={region.id} onSelect={() => setSelectedRegion(region.id)}>
                    {region.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-8 text-sm">
                  {models.find((m) => m.id === selectedModel)?.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {models.map((model) => (
                  <DropdownMenuItem key={model.id} onSelect={() => setSelectedModel(model.id)}>
                    {model.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 scroll-smooth snap-y snap-mandatory">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in-up max-w-[95%] mx-auto">
            <Avatar className="w-10 h-10 mb-4 border">
              <AvatarImage src="/bedrock-logo.png" alt="AI Assistant Avatar" width={40} height={40} />
            </Avatar>
            <h2 className="text-xl font-semibold mb-2">Data Analysis Assistant</h2>
            <div className="space-y-4 text-base">
              <div className="flex items-center gap-3">
                <MessageCircleQuestion className="text-muted-foreground w-6 h-6" />
                <p className="text-muted-foreground">Ask questions about your database, and I'll prepare the relevant dataset.</p>
              </div>
              <div className="flex items-center gap-3">
                <ChartArea className="text-muted-foreground w-6 h-6" />
                <p className="text-muted-foreground">I can analyze data and create visualizations based on the dataset.</p>
              </div>
              <div className="flex items-center gap-3">
                <FileInput className="text-muted-foreground w-6 h-6" />
                <p className="text-muted-foreground">You can also upload CSVs, PDFs, or images if you have additional files to discuss.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 min-h-full">
            {messages.map((message) => (
              <div key={message.id} className="animate-fade-in-up">
                <MessageComponent message={message} />
              </div>
            ))}
            {isThinking && (
              <div className="animate-fade-in-up">
                <ThinkingIndicator />
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 border-t">
        <form onSubmit={onSubmit} className="w-full">
          <div className="flex flex-col space-y-2">
            {currentUpload && (
              <FilePreview file={currentUpload} onRemove={() => setCurrentUpload(null)} />
            )}
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Textarea
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={onKeyDown}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="min-h-[44px] h-[44px] resize-none pl-12 py-3 flex items-center"
                  rows={1}
                />
              </div>
              <Button type="submit" disabled={isLoading || (!input.trim() && !currentUpload)} className="h-[44px]">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelect} />
        </form>
      </CardFooter>
    </Card>
  );
};

export default Chat;