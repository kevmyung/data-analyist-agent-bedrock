import dotenv
import os
import json
import boto3
import logging
from dotenv import load_dotenv
from opensearchpy import OpenSearch, RequestsHttpConnection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()

class OpenSearch_Manager:
    def __init__(self, region_name):
        self.client = self._init_opensearch()
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=region_name)

    def _init_opensearch(self):
        try:
            host = os.getenv('OPENSEARCH_HOST')
            user = os.getenv('OPENSEARCH_USER')
            password = os.getenv('OPENSEARCH_PASSWORD')
            client = OpenSearch(
                hosts = [{'host': host.replace("https://", ""), 'port': 443}],
                http_auth = (user, password),
                use_ssl = True,
                verify_certs = True,
                connection_class = RequestsHttpConnection
            )
            return client
        except Exception as e:
            logger.error(f"Error initializing OpenSearch: {e}")
            return None

    def _search(self, query, index_name):
        try:
            response = self.client.search(index=index_name, body=query)
            results = []
            for hit in response['hits']['hits']:
                result = {
                    "question": hit['_source']["question"],
                    "sql_query": hit['_source']["sql_query"],
                    "score": hit['_score'],
                }
                results.append(result)
            return results
        except Exception as e:
            logger.error(f"An error occurred during search: {e}")
            return []


    def _search_by_knn(self, vector, index_name, top_n=5):
        query = {
            "size": top_n,
            "_source": ["question", "sql_query"],
            "query": {
                "knn": {
                    "question_embedding": {
                        "vector": vector,
                        "k": top_n
                    }
                }
            }
        }
        results = self._search(query, index_name)
        for result in results:
            result['search_method'] = 'knn'
        return results


    def retrieve_search_results(self, question, index_name, top_n):
        response = self.bedrock_client.invoke_model(
            modelId="amazon.titan-embed-text-v2:0",
            body=json.dumps({"inputText": question})
        )
        embedding = json.loads(response['body'].read())['embedding']

        search_results = self._search_by_knn(embedding, index_name, top_n)
        return search_results