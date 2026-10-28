import os
import json
import base64
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel # Add this

load_dotenv()
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
You are a strict data extraction API. 
Your ONLY job is to analyze the screenshot and return a JSON object that EXACTLY matches the schema below. 
Do NOT invent new keys like "event_details" or "post_details". 
Do NOT include markdown formatting.
If you include any keys other than the ones in the schema, the system will crash.

EXACT SCHEMA:
{
  "is_actionable": boolean,
  "category": "flight" | "event" | "receipt" | "wifi" | "address" | "contact" | "payment" | "other" | "ignore",
  "title": "Short 3-5 word title (e.g., '2FORTY2 PADURA Concert')",
  "actionable_time": "ISO 8601 timestamp (or null)",
  "expiry_time": "ISO 8601 timestamp (or null)",
  "entities": { "key": "value" },
  "summary": "A one-sentence summary of what this is."
}

Rules:
1. For this concert poster, the title should be the event name. Category is "event".
2. Use the provided current date/time to calculate exact ISO timestamps for actionable_time and expiry_time. (e.g., If an event is on Dec 19, 2026, the expiry_time should be Dec 20, 2026).
3. If the image is completely blank or a random selfie, set "is_actionable": false and category "ignore".
4. All the specific details (venue, price, contacts) MUST go inside the "entities" object.
"""

# Create a model for the incoming JSON
class ImagePayload(BaseModel):
    image_base64: str
    current_time: str

@app.post("/extract")
async def extract_info(payload: ImagePayload): # Changed from UploadFile to ImagePayload
    try:
        # Decode the base64 string back into image bytes
        image_data = base64.b64decode(payload.image_base64)
        
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite', # Or whatever model you are using
            contents=[
                f"The current date and time is {payload.current_time}. Analyze this screenshot.",
                types.Part.from_bytes(data=image_data, mime_type="image/jpeg") 
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e), "is_actionable": False}