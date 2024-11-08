// components/QueryDetails.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyzeAPIResponse } from '@/types/chat';

interface QueryDetailsProps {
  queryDetails: AnalyzeAPIResponse[];
  currentQueryIndex: number;
  onScroll: () => void;
}

const QueryDetails: React.FC<QueryDetailsProps> = ({ queryDetails, currentQueryIndex, onScroll }) => {
  return (
    <Card className="w-1/3 flex flex-col h-full overflow-hidden">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-lg">Query Details</CardTitle>
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-y-auto snap-y snap-mandatory"
        onScroll={onScroll}
      >
        {queryDetails.length > 0 ? (
          queryDetails.map((detail, index) => (
            <div key={index} className="min-h-full flex-shrink-0 snap-start snap-always">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">SQL Query:</h3>
                  <pre className="bg-muted p-2 rounded text-sm">{detail.query}</pre>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Explanation:</h3>
                  <p>{detail.explanation}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Results:</h3>
                  <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
                    {JSON.stringify(detail.result, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">
            Run a query in the chat to see the details here.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default QueryDetails;