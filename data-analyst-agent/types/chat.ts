// types/chat.ts

import { ChartData } from './chart';

export interface ContentBlock {
  text?: string;
  toolUse?: ToolUse;
  toolResult?: ToolResult;
  json?: string;
}

export interface ToolUse {
  toolUseId: string;
  name: string;
  input: {
    [key: string]: any;
  };
}

export interface ToolResult {
  toolUseId: string;
  content: [{text?: string; json?: string;}];
  status?: 'success' | 'error'; 
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: ContentBlock[];
  hasToolUse?: boolean;
  file?: FileUpload;
  chartData?: ChartData;
  sqlQuery?: string;
}

export interface FileUpload {
  base64: string;
  fileName: string;
  mediaType: string;
  isText?: boolean;
  fileSize?: number;
}

export type Model = {
  id: string;
  name: string;
};

export interface APIResponse {
  content: string;
  hasToolUse: boolean;
  toolUse?: {
    type: "tool_use";
    id: string;
    name: string;
    input: ChartData;
  };
  chartData?: ChartData;
}

export interface AnalyzeAPIResponse {
  query?: string;
  explanation?: string;
  result?: any[];
  content: string;
  toolUseId?: string;
  toolName?: string;
  stopReason?: string;
}