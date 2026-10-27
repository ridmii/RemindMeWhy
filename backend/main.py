import os
import json
from google import genai
from google.genai import types
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# New SDK initialization
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """
You are an AI assistant for a "Temporary Memory" mobile app. 
Your job is to analyze user screenshots and extract the core actionable data.
You must respond ONLY with a valid JSON object. Do not include markdown formatting like ```json or any conversational text.

Use this exact JSON schema:
{
  "is_actionable": boolean,
  "category": "flight" | "event" | "receipt" | "wifi" | "address" | "contact" | "payment" | "other" | "ignore",
  "title": "Short 3-5 word title for a card",
  "actionable_time": "ISO 8601 timestamp for when the user needs a reminder (or null)",
  "expiry_time": "ISO 8601 timestamp for when this data is no longer useful (or null)",
  "entities": { "key": "value" },
  "summary": "A one-sentence summary of what this is."
}

Rules:
1. Use the provided current date/time to calculate exact ISO timestamps.
2. If the screenshot is a meme or useless, set "is_actionable": false, "category": "ignore".
"""

@app.post("/extract")
async def extract_info(file: UploadFile = File(...), current_time: str = Form(...)):
    try:
        image_data = await file.read()
        
        # Send to Gemini using the new SDK format
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[
                f"The current date and time is {current_time}. Analyze this screenshot.",
                types.Part.from_bytes(data=image_data, mime_type=file.content_type)
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        
        # The new SDK with response_mime_type="application/json" guarantees valid JSON
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e), "is_actionable": False}