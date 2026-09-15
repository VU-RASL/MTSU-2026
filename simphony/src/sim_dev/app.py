from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, Field
import os
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from tinydb import TinyDB, Query as dbQuery
from typing import List, Any

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()

# Get API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment variables")


class SessionResponse(BaseModel):
    session_id: str
    token: str


class WeatherResponse(BaseModel):
    temperature: float
    unit: str

class HintsResponse(BaseModel):
    content: list[str] = Field(description="A list containing three hints")

class ExamplesResponse(BaseModel):
    content: list[str] = Field(description="A list containing three examples")


ChatOpenAI.api_key = OPENAI_API_KEY
# needs apis for
# 1. getting example dialogue for an atomic object
# 2. getting "socratic method" questions for an atomic object

# input = {
#     "Persona": {},
#     "Field": "key of Persona"

#     }
# response = {
#     "content": [str(), str(), str()]
# }


@app.get("/generate-examples")
# @app.post("/generate-examples")
async def generate_ex(Persona: str = Query(...), Field: str = Query(...)):
    # print(Persona)
    # print(Field)

    # Initialize OpenAI LLM
    model = ChatOpenAI(
        model_name="gpt-4o-mini",  # Replace with the model you want to use
        temperature=0.7,
        max_tokens=100,
    ).with_structured_output(ExamplesResponse)

    # User query

    template = """You are a standardized patient preparing to participate in a healthcare simulation scenario. A standardized patient is someone who portrays a patient with a specific condition in a realistic, standardized and repeatable way.

    The objectives of a standardized patient include: 
    - To appropriately and accurately reveal the facts about the role being portrayed. 
    - To improvise only when necessary and in a manner that is consistent with the overall tone/content of the case.
    - Maintain the realism of the simulation (i.e., stay in character).

    As part of your preparation process, you want to run a few example lines of dialoge by the healthcare faculty member who is designing the simulation and your character's persona.

    Here is your character's details in the form of a JSON object, where the description fields provide additional context of the meaning of a trait, and the corresponding content fields give the actual persona information relating to that trait: {Persona}

    Respond with three lines of dialogue pertaining to the {Field} trait in your persona. Consider all the information given in your persona to produce authentic and believable lines of dialogue.
    Return the three lines of dialogue as a json object with a key called 'content' containing a string array with one string for each line of dialogue (3 strings total), as shown below.
    Response Format:
    {{'content': []}}
    
    Below is an example: 
    
    The persona of a patient includes that they have severe anxiety. You should return something like:
    {{'content': ['I feel like I cannot breathe.','I cannot deal with this anymore.','I am exhausted.']}}    
    """

    prompt = PromptTemplate.from_template(template)
    #     input_variables=["Persona","Field"],
    #     template=template
    # )

    # Combine LLM and PromptTemplate into a chain
    chain = prompt | model

    # Call the chain
    response = chain.invoke({"Persona": f"{Persona}", "Field": f"{Field}"})
    # response = chain.invoke(input)

    print(response)
    # print(response.content)
    return response.model_dump()


@app.get("/provide-hints")
# @app.post("/provide-hints")
async def generate_hint(Persona: str = Query(...), Field: str = Query(...)):
    # Persona = input.Persona
    # Field = input.Field
    # print(Persona)
    # print(Field)

    # Initialize OpenAI LLM
    model = ChatOpenAI(
        model_name="gpt-4o-mini",  # Replace with the model you want to use
        temperature=0.7,
        max_tokens=100,
    ).with_structured_output(HintsResponse)

    # User query

    template = """You are a standardized patient preparing to participate in a healthcare simulation scenario. A standardized patient is someone who portrays a patient with a specific condition in a realistic, standardized and repeatable way.

    The objectives of a standardized patient include: 
    - To appropriately and accurately reveal the facts about the role being portrayed. 
    - To improvise only when necessary and in a manner that is consistent with the overall tone/content of the case.
    - Maintain the realism of the simulation (i.e., stay in character).

    As part of your preparation process, you want to ask a few questions regarding the direction the healthcare faculty member who is designing the simulation wants you to take your character.
    
    Here are your character's details in the form of a JSON object, where the description fields provide additional context of the meaning of a trait, and the corresponding content fields give the actual persona information relating to that trait: {Persona}

    Respond with three questions pertaining to the {Field} trait in your persona. Consider all the information given in your persona to produce authentic and believable questions.
    Return the three questions as a json object with a key called 'content' containing a string array with one string for each question (3 strings total), as shown below.
    Response Format:
    {{'content': []}} 

    Example:

    The persona of a patient includes that they have severe anxiety, is fidgety, has a stressful work culture, and is a trans woman. The input field is "feelingsAndThoughts". You should return something like:
    {{'content': ['Since you mentioned that the patient was fidgety, do you think there are any feelings that can be aligned to that?','In the cultural context, you mention that their work culture is very stressful. Is there anything you can align here','Do you know if being a transgender is having an effect on them. What would that look like?']}}

    If the content field is empty or contains an empty string, return an array of three empty strings.
    Example:
    Given: {{'Field':{{'content': [""]}}}}
    Return: {{'content': ["","",""]}}

    """

    prompt = PromptTemplate.from_template(template)
    #     input_variables=["Persona","Field"],
    #     template=template
    # )

    # Combine LLM and PromptTemplate into a chain
    chain = prompt | model

    # Call the chain
    response = chain.invoke({"Persona": f"{Persona}", "Field": f"{Field}"})
    # response = chain.invoke(input)

    print(response)
    # print(json.loads(response.content))
    print(type(response))
    
    return response.model_dump()


@app.get("/session")
async def get_session():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": "gpt-4o-realtime-preview-2024-12-17", "voice": "echo"},
        )
        return response.json()
    
@app.post("/dialin")
def configDialin(Persona: str = Query(...)):
    pass

# -------------------------
# Store Models
# -------------------------

class PersonasState(BaseModel):
    personas: List[Any]
    selectedPersonaId: int
    searchQuery: str

class PersonaStoreData(BaseModel):
    data: PersonasState

class ScenariosState(BaseModel):
    scenarios: List[Any]
    selectedScenarioId: int

class ScenarioStoreData(BaseModel):
    data: ScenariosState

STORE_SCHEMAS = {
    "personas": PersonasState,
    "scenarios": ScenariosState
}

# -------------------------
# File-per-store setup
# -------------------------
STORE_DIR="stores"
os.makedirs(STORE_DIR, exist_ok=True)

def get_store_path(store_id: str) -> str:
    return os.path.join(STORE_DIR, f"{store_id}.json")

# -------------------------
# Endpoints
# -------------------------
@app.get("/api/sync/{store_id}")
def get_store(store_id: str):
    schema = STORE_SCHEMAS.get(store_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Unknown store")

    db = TinyDB(get_store_path(store_id))
    records = db.all()
    if not records:
        return schema(  # 👇 return default empty state
            personas=[],
            selectedPersonaId=1,
            searchQuery=""
        )
    
    return schema(**records[0]["data"])

@app.post("/api/sync/{store_id}")
async def update_store(store_id: str, request: Request):
    schema = STORE_SCHEMAS.get(store_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Unknown store")

    raw_json = await request.json()
    try:
        validated = schema(**raw_json)
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    db = TinyDB(get_store_path(store_id))
    db.truncate()
    db.insert({"data": validated.dict()})
    return {"status": "saved"}

def main():
    import uvicorn 

    uvicorn.run(app, host="0.0.0.0", port=8888)

if __name__ == "__main__":
    main()
