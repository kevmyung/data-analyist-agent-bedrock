// app/analysis/page.tsx
"use client";
import { v4 as uuidv4 } from "uuid";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartColumnBig } from "lucide-react";
import Chat from '@/components/Chat';
import QueryDetails from '@/components/QueryDetails';
import { ChartRenderer } from "@/components/ChartRenderer";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import type { ChartData } from "@/types/chart";
import type { Message, FileUpload, APIResponse, AnalyzeAPIResponse } from '@/types/chat';
import { models, regions } from '@/constants';

import TopNavBar from "@/components/TopNavBar";
import { readFileAsText, readFileAsBase64, readFileAsPDFText } from "@/utils/fileHandling";


const SafeChartRenderer = React.memo(({ data }: { data: ChartData }) => {
  try {
    return (
      <div className="w-full h-full p-6 flex flex-col">
        <div className="w-[90%] flex-1 mx-auto">
          <ChartRenderer data={data} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Chart rendering error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return (
      <div className="text-red-500">Error rendering chart: {errorMessage}</div>
    );
  }
});


const ChartPagination = ({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}) => (
  <div className="fixed right-12 top-1/2 -translate-y-1/2 flex flex-col gap-2">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        onClick={() => onDotClick(i)}
        className={`w-2 h-2 rounded-full transition-all ${
          i === current
            ? "bg-primary scale-125"
            : "bg-muted hover:bg-primary/50"
        }`}
      />
    ))}
  </div>
);

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chartEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUpload, setCurrentUpload] = useState<FileUpload | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentChartIndex, setCurrentChartIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  //const [isScrollLocked, setIsScrollLocked] = useState(false);

  const [queryDetails, setQueryDetails] = useState<AnalyzeAPIResponse[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const [currentQueryIndex, setCurrentQueryIndex] = useState(0);
  const queryContentRef = useRef<HTMLDivElement>(null);
  
  const [selectedRegion, setSelectedRegion] = useState("us-west-2");
  const [selectedModel, setSelectedModel] = useState(
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
  );

  useEffect(() => {
    const scrollToBottom = () => {
      if (!messagesEndRef.current) return;

      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    };

    // Scroll when messages change or when loading state changes
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]); // Add isLoading to dependencies

  useEffect(() => {
    if (!messagesEndRef.current) return;

    const observer = new ResizeObserver(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  

    observer.observe(messagesEndRef.current);

    return () => observer.disconnect();
  }, []);

  const handleReset = useCallback(() => {
    setMessages([]);
    setQueryDetails([]);
    setCurrentChartIndex(0);
    setCurrentQueryIndex(0);
    setInput("");
    setCurrentUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: "Chat Reset",
      description: "All chat history and visualizations have been cleared.",
    });
  }, []);

  const handleChartScroll = useCallback(() => {
    if (!contentRef.current) return;

    const { scrollTop, clientHeight } = contentRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);
    setCurrentChartIndex(newIndex);
  }, []);

  const scrollToChart = (index: number) => {
    if (!contentRef.current) return;
    contentRef.current.scrollTo({
      top: index * contentRef.current.clientHeight,
      behavior: "smooth"
    });
  };

  const syncScroll = (index: number) => {
    setCurrentChartIndex(index);
    setCurrentQueryIndex(index);
    scrollToChart(index);
    scrollToQuery(index);
  };
  
  const scrollToQuery = (index: number) => {
    if (!queryContentRef.current) return;
    queryContentRef.current.scrollTo({
      top: index * queryContentRef.current.clientHeight,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    const scrollToNewestChart = () => {
      const chartsCount = messages.filter((m) => m.chartData).length;
      if (chartsCount > 0) {
        setCurrentChartIndex(chartsCount - 1);
        scrollToChart(chartsCount - 1);
      }
    };

    const lastChartIndex = messages.findLastIndex((m) => m.chartData);
    if (lastChartIndex !== -1) {
      setTimeout(scrollToNewestChart, 100);
    }
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Create a ref to store the toast handlers
    let loadingToastRef: { dismiss: () => void } | undefined;

    if (file.type === "application/pdf") {
      loadingToastRef = toast({
        title: "Processing PDF",
        description: "Extracting text content...",
        duration: Infinity, // This will keep the toast until we dismiss it
      });
    }

    try {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";
      let base64Data = "";
      let isText = false;

      if (isImage) {
        base64Data = await readFileAsBase64(file);
        isText = false;
      } else if (isPDF) {
        try {
          const pdfText = await readFileAsPDFText(file);
          base64Data = btoa(encodeURIComponent(pdfText));
          isText = true;
        } catch (error) {
          console.error("Failed to parse PDF:", error);
          toast({
            title: "PDF parsing failed",
            description: "Unable to extract text from the PDF",
            variant: "destructive",
          });
          return;
        }
      } else {
        try {
          const textContent = await readFileAsText(file);
          base64Data = btoa(encodeURIComponent(textContent));
          isText = true;
        } catch (error) {
          console.error("Failed to read as text:", error);
          toast({
            title: "Invalid file type",
            description: "File must be readable as text, PDF, or be an image",
            variant: "destructive",
          });
          return;
        }
      }

      setCurrentUpload({
        base64: base64Data,
        fileName: file.name,
        mediaType: isText ? "text/plain" : file.type,
        isText,
      });

      toast({
        title: "File uploaded",
        description: `${file.name} ready to analyze`,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process the file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (loadingToastRef) {
        loadingToastRef.dismiss(); // Use the dismiss method from the toast ref
        // Show success toast for PDF
        if (file.type === "application/pdf") {
          toast({
            title: "PDF Processed",
            description: "Text extracted successfully",
          });
        }
      }
    }
  };

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() && !currentUpload) return;
    if (isLoading) return;
  
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: [{ text: input}],
      file: currentUpload || undefined,
    };
  
    setMessages((prev) => [...prev, userMessage]);
    setIsThinking(true);
    setInput("");
    setIsLoading(true);
  
    try {
      const apiMessages = [...messages, userMessage].map((msg) => {
        if (msg.file) {
          if (msg.file.isText) {
            const decodedText = decodeURIComponent(atob(msg.file.base64));
            return {
              role: msg.role,
              content: [{ text: `File contents of ${msg.file.fileName}:\n\n${decodedText}\n\n${msg.content[0].text}` }]
            };
          } else {
            return {
              role: msg.role,
              content: [{
                image: {
                  format: msg.file.mediaType.split('/')[1],
                  source: {
                    bytes: msg.file.base64
                  }
                }
              }, 
              { text: msg.content[0].text }
            ]};
          }
        }
        return {
          role: msg.role,
          content: msg.content 
        };
      });

      console.log("📤 Sending API request:", JSON.stringify({
        messages: apiMessages,
        model: selectedModel,
        region: selectedRegion,
      }, null, 2));

      const routerResponse = await fetch("/api/router", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          region: selectedRegion,
        }),
      });

      if (!routerResponse.ok) {
        throw new Error(`Visualize API error! status: ${routerResponse.status}`);
      }
      const responseData = await routerResponse.json();
      const answeringTool = responseData.input.answering_tool;

      console.log("Router Response:", responseData)

      if (answeringTool === 'db') { // Database Access
        console.log("Database access is requested");
        
        const analyzeResponse = await fetch("http://localhost:8000/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: apiMessages,
            model: selectedModel,
            region: selectedRegion,
          }),
        });

        if (!analyzeResponse.ok) {
          throw new Error(`Analyze API error! status: ${analyzeResponse.status}`);
        }

        const analyzeData: AnalyzeAPIResponse = await analyzeResponse.json();        
    
        if (analyzeData.stopReason === 'tool_use' && analyzeData.result.length > 0) {
          setQueryDetails((prev) => [...prev, analyzeData]);

          const updatedApiMessages = [
            ...apiMessages,
            {
              id: uuidv4(),
              role: "assistant",
              content: [
                {
                  toolUse: {
                    toolUseId: analyzeData.toolUseId,
                    name: "generate_sql_query",
                    input: {
                      query: analyzeData.query,
                      explanation: analyzeData.explanation
                    }
                  }
                }
              ]
            },
            {
              id: uuidv4(),
              role: "user",
              content: [
                {
                  toolResult: {
                    toolUseId: analyzeData.toolUseId,
                    content: [
                      {
                        text: `Visualize this data: ${JSON.stringify(analyzeData.result)}`
                      }
                    ]
                  }
                }
              ]
            }
          ];

  
          const visualizeResponse = await fetch("/api/visualize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: updatedApiMessages,
              model: selectedModel,
              region: selectedRegion,
            }),
          });

          if (visualizeResponse.ok) {
            const visualizeData: APIResponse = await visualizeResponse.json();
            setMessages((prev) => [
              ...prev,
              ...updatedApiMessages.slice(-2) as Message[],
              {
                id: uuidv4(),
                role: "assistant",
                content: [{ text: `${analyzeData.content}\n\n${visualizeData.content}` }],
                chartData: visualizeData.chartData || null
              },
            ]);        

          } else {
            throw new Error(`Visualize API error! status: ${visualizeResponse.status}`);
          }
        } 
      } else if (answeringTool === 'file') {  // File Access
        console.log("File processing is requested");
        const visualizeResponse = await fetch("/api/visualize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: apiMessages,
            model: selectedModel,
            region: selectedRegion,
          }),
        });

        if (!visualizeResponse.ok) {
          throw new Error(`Visualize API error! status: ${visualizeResponse.status}`);
        }
  
        const visualizeData: APIResponse = await visualizeResponse.json();
        const toolUseId = visualizeData.toolUse.id || uuidv4()
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content: [
              {
                toolUse: {
                  toolUseId: toolUseId,
                  name: visualizeData.toolUse.name || "generate_graph_data",
                  input: visualizeData.toolUse.input
                }
              }
            ],
            hasToolUse: visualizeData.hasToolUse || !!visualizeData.toolUse,
            chartData: visualizeData.chartData || (visualizeData.toolUse?.input as ChartData) || null,
          },
          {
            id: uuidv4(),
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId: toolUseId,
                  content: [
                    {
                      text: "Visualization Done."
                    }
                  ]
                }
              }
            ]
          },
          {
            id: uuidv4(),
            role: "assistant",
            content: [
              {
                text: visualizeData.content
              }
            ]
          }
        ]);
      } else if (answeringTool === 'chat') {
        console.log("General chat response");
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content: [{ text: responseData.input.direct_answer || "I'm sorry, I don't have a direct answer for that." }],
          },
        ]);
      } else {
        console.error("Unexpected result from router API");
      }
    } catch (error) {
      console.error("Submit Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content: [{ text: "I apologize, but I encountered an error. Please try again." }],
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      setCurrentUpload(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
      }

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    }
  }, [messages, input, currentUpload, selectedModel, selectedRegion, setMessages, setIsThinking, setInput, setIsLoading, setQueryDetails, setCurrentUpload]); 

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || currentUpload) {
        const form = e.currentTarget.form;
        if (form) {
          const submitEvent = new Event("submit", {
            bubbles: true,
            cancelable: true,
          });
          form.dispatchEvent(submitEvent);
        }
      }
    }
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const textarea = event.target;
    setInput(textarea.value);
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`;
  };

  return (
    <div className="flex flex-col h-screen">
      <TopNavBar
        features={{showDomainSelector: false, showViewModeSelector: false, showPromptCaching: false }}
        onReset={handleReset}
      />

      <div className="flex-1 flex bg-background p-4 pt-0 gap-4 h-[calc(100vh-4rem)]">
        <Chat
          messages={messages}
          input={input}
          isLoading={isLoading}
          currentUpload={currentUpload}
          selectedModel={selectedModel}
          selectedRegion={selectedRegion}
          models={models}
          regions={regions}
          isThinking={isThinking}
          fileInputRef={fileInputRef}
          onInputChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSubmit={handleSubmit}
          onFileSelect={handleFileSelect}
          setSelectedModel={setSelectedModel}
          setSelectedRegion={setSelectedRegion}
          setCurrentUpload={setCurrentUpload}
        />

        <QueryDetails 
          queryDetails={queryDetails}
          currentQueryIndex={currentQueryIndex}
          onScroll={() => {
            if (!queryContentRef.current) return;
            const { scrollTop, clientHeight } = queryContentRef.current;
            const newIndex = Math.round(scrollTop / clientHeight);
            if (newIndex !== currentQueryIndex) {
              syncScroll(newIndex);
            }
          }}
        />

        {/* Content Area */}
        <Card className="flex-1 flex flex-col h-full overflow-hidden">
          {messages.some((m) => m.chartData) && (
            <CardHeader className="py-3 px-4 shrink-0">
              <CardTitle className="text-lg">Analysis & Visualizations</CardTitle>
            </CardHeader>
          )}
          <CardContent
            ref={contentRef}
            className="flex-1 overflow-y-auto min-h-0 snap-y snap-mandatory"
            onScroll={handleChartScroll}
          >
            {messages.some((m) => m.chartData) ? (
              <div className="min-h-full flex flex-col">
                {messages.map(
                  (message, index) =>
                    message.chartData && (
                      <div
                        key={`chart-${index}`}
                        className="w-full min-h-full flex-shrink-0 snap-start snap-always"
                        ref={
                          index ===
                          messages.filter((m) => m.chartData).length - 1
                            ? chartEndRef
                            : null
                        }
                      >
                        <SafeChartRenderer data={message.chartData} />
                      </div>
                    )
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="flex flex-col items-center justify-center gap-4 -translate-y-8">
                  <ChartColumnBig className="w-8 h-8 text-muted-foreground" />
                  <div className="space-y-2">
                    <CardTitle className="text-lg">
                      Analysis & Visualizations
                    </CardTitle>
                    <CardDescription className="text-base">
                      Charts and detailed analysis will appear here as you chat
                    </CardDescription>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <Badge variant="outline">Bar Charts</Badge>
                      <Badge variant="outline">Area Charts</Badge>
                      <Badge variant="outline">Linear Charts</Badge>
                      <Badge variant="outline">Pie Charts</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {messages.some((m) => m.chartData) && (
        <ChartPagination
          total={Math.max(messages.filter((m) => m.chartData).length, queryDetails.length)}
          current={currentChartIndex}
          onDotClick={syncScroll}
        />
      )}
    </div>
  );
}