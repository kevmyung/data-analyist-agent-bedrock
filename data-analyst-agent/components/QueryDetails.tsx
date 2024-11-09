// components/QueryDetails.tsx
import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartColumnBig } from "lucide-react";
import type { AnalyzeAPIResponse } from '@/types/chat';

interface QueryDetailsProps {
  queryDetails: AnalyzeAPIResponse[];
  currentQueryIndex: number;
  onScroll: () => void;
}

const QueryDetails: React.FC<QueryDetailsProps> = ({ queryDetails, currentQueryIndex, onScroll }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Card className="w-1/3 flex flex-col h-full overflow-hidden">
      <CardHeader className="py-3 px-4 shrink-0">
        <CardTitle className="text-lg">Query Details</CardTitle>
      </CardHeader>
      <CardContent 
        ref={contentRef}
        className="flex-1 overflow-y-auto min-h-0 snap-y snap-mandatory"
        onScroll={onScroll}
      >
        {queryDetails.length > 0 ? (
          <div className="min-h-full flex flex-col">
            {queryDetails.map((detail, index) => (
              <div key={index} className="w-full min-h-full flex-shrink-0 snap-start snap-always">
                <div className="space-y-4 p-4">
                  <div>
                    <h3 className="font-semibold mb-2">SQL Query:</h3>
                    <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">{detail.query}</pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Explanation:</h3>
                    <p className="text-sm">{detail.explanation}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Results:</h3>
                    <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
                      {JSON.stringify(detail.result, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="flex flex-col items-center justify-center gap-4 -translate-y-8">
              <ChartColumnBig className="w-8 h-8 text-muted-foreground" />
              <div className="space-y-2">
                <CardTitle className="text-lg">No Queries Yet</CardTitle>
                <CardDescription className="text-base">
                  Run a query in the chat to see the details here
                </CardDescription>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QueryDetails;