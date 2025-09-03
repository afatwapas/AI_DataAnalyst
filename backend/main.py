import os
import uuid
import pandas as pd
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

app= FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

#agent management
agents = {}

#api endpoints

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), temperature: float = Form(0.0)):
    print(f"file received : {file.filename}")  # Debug log
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    session_id = str(uuid.uuid4())
    file_path= f"uploads/{session_id}.csv"

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        df= pd.read_csv(file_path)
        
        # --- THE FIX STARTS HERE ---

        # 1. Create a custom prompt prefix that includes the ENTIRE DataFrame
        # We convert the full DataFrame to a string to include in the prompt
        custom_prefix = f"""
        You are working with a pandas dataframe in Python. The name of the dataframe is `df`.
        You have the following tools at your disposal.
        This is the entire dataframe:
        {df.to_string()}
        """
        llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0)

        agent= create_pandas_dataframe_agent(
            llm,
            df,
            verbose=True,
            prefix=custom_prefix,
            allow_dangerous_code=True, 
            agent_executor_kwargs={"handle_parsing_errors": True},
        )
        agents[session_id]= agent
        print(f"Agent created for session: {session_id}")  # Debug log
        return {"session_id": session_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {e}")
    
@app.post("/chat")
async def chat_with_agent(session_id: str=Form(...),prompt :str=Form(...)):

    if session_id not in agents:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")

    agent= agents[session_id]

    try:
        response= agent.invoke({"input": prompt})
        print("1")
        return {"response": response.get("output", "No response from agent.")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process prompt: {e}")    