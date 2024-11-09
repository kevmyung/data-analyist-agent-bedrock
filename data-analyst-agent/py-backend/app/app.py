from fastapi import FastAPI, HTTPException
#from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Union, Dict, Any, Optional
import json
import os
import sqlite3
from boto3 import Session
from botocore.config import Config
import logging
from fastapi.middleware.cors import CORSMiddleware

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..'))
db_path = os.path.join(root_dir, 'sample.db')
schema_path = os.path.join(root_dir, 'db_schema.json')
table_name = 'sales_table'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]

class AnalyzeRequest(BaseModel):
    messages: List[Message]
    model: str
    region: str

class AnalyzeResponse(BaseModel):
    content: str
    query: Optional[str] = None
    explanation: Optional[str] = None
    result: Optional[List[dict]] = None
    toolUseId: Optional[str] = None
    toolName: Optional[str] = None
    stopReason: str


def create_bedrock_client(region):
    session = Session()
    config = Config(region_name=region)
    return session.client('bedrock-runtime', config=config)

def get_sample_data():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
    columns = [description[0] for description in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]
    conn.close()
    return data

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    try:
        logger.info(f"Received raw request: {request.json()}")
        logger.info(f"Parsed messages: {[msg.dict() for msg in request.messages]}")

        if not request.messages:
            raise HTTPException(status_code=400, detail="Messages are required and must be a non-empty array")
        if not request.model:
            raise HTTPException(status_code=400, detail="Model selection is required")
        if not request.region:
            raise HTTPException(status_code=400, detail="Region selection is required")

        bedrock_client = create_bedrock_client(request.region)

        with open(schema_path, 'r') as f:
            table_schema = json.load(f)

        sample_data = get_sample_data()

        system_prompt = f"""You are a helpful assistant. When answering questions, if the information can be obtained from the database, use the generate_sql_query tool to create an SQL query with a given user's question and table schema. 
        If not, provide a direct answer without using the tool. Always be concise and clear in your responses.

Always:
- Analyze the user's question carefully.
- Use the columns from the provided table schema.
- Ensure the SQL query is syntactically correct.
- Use appropriate SQL functions and clauses.
- Use the table name '{table_name}' in your queries.

Never:
- Include any additional information in your responses.
- Mention the tool or any implementation details.
- Provide explanations or commentary.

Focus on providing the correct SQL query that answers the user's question.

Here is the table schema for the table '{table_name}':
{json.dumps(table_schema, indent=2)}

Here are some sample data for the table '{table_name}':
{json.dumps(sample_data, indent=2)}
"""

        tool_config = {
            "tools": [{
                "toolSpec": {
                    "name": "generate_sql_query",
                    "description": "Generate an SQL query based on a user's question and a given table schema.",
                    "inputSchema": {
                        "json": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"},
                                "explanation": {"type": "string"},
                            },
                            "required": ["query", "explanation"]
                        }
                    }
                }
            }]
        }

        logger.info(f"Final API request: {json.dumps({'modelId': request.model, 'messages': [msg.model_dump() for msg in request.messages]}, indent=2)}")

        response = bedrock_client.converse(
            modelId=request.model,
            messages=[msg.model_dump() for msg in request.messages],
            system=[{'text': system_prompt}],
            inferenceConfig={
                'maxTokens': 4096,
                'temperature': 0.0,
                'topP': 0.1
            },
            toolConfig=tool_config
        )

        logger.info(f"Raw Bedrock Response: {json.dumps(response, indent=2)}")
        if 'output' not in response or 'message' not in response['output'] or 'content' not in response['output']['message']:
            raise HTTPException(status_code=500, detail="Invalid response from Bedrock API")

        content_text = ""
        query = None
        explanation = None
        tool_use_id = None
        tool_name = None

        for item in response['output']['message']['content']:
            if 'text' in item:
                content_text += item['text']
                
            if 'toolUse' in item:
                tool_use = item['toolUse']
                tool_input = tool_use['input']
                tool_data = json.loads(tool_input) if isinstance(tool_input, str) else tool_input
                if 'query' in tool_data and isinstance(tool_data['query'], str):
                    query = tool_data['query']
                    explanation = tool_data.get('explanation', '')
                    tool_use_id = tool_use['toolUseId']
                    tool_name = "generate_sql_query"

        if query:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            try:
                logger.info(f"Executing Query: {query}")
                cursor.execute(query)
                columns = [description[0] for description in cursor.description]
                query_result = [dict(zip(columns, row)) for row in cursor.fetchall()]
            except sqlite3.Error as e:
                logger.error(f"Database execution error: {e}")
                query_result = None
            finally:
                conn.close()
        else:
            query_result = None

        stop_reason = response.get('stopReason', 'end_turn')

        return AnalyzeResponse(
            content=content_text,
            query=query,
            explanation=explanation,
            result=query_result,
            toolUseId=tool_use_id,
            toolName=tool_name,
            stopReason=stop_reason
        )

    except Exception as e:
        logger.error(f"Analyze API Error: {str(e)}")
        logger.error(f"Full error details: {{'name': {type(e).__name__}, 'message': {str(e)}, 'stack': {getattr(e, '__traceback__', None)}}}")

        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)