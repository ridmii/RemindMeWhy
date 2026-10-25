import os
import json
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

# Allow React Native to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The prompt we designed earlier
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

# Use Gemini 1.5 Flash for speed and cost
model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=SYSTEM_PROMPT)

@app.post("/extract")
async def extract_info(file: UploadFile = File(...), current_time: str = Form(...)):
    try:
        # Read the image bytes
        image_data = await file.read()
        
        # Prepare the image for Gemini
        image_parts = [
            {
                "mime_type": file.content_type,
                "data": image_data
            }
        ]
        
        # Send to Gemini
        prompt = f"The current date and time is {current_time}. Analyze this screenshot."
        response = model.generate_content([prompt, image_parts[0]])
        
        # Parse the JSON response (Gemini sometimes adds markdown backticks)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        
        return json.loads(text)
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e), "is_actionable": False}