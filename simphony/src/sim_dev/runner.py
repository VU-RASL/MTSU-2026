from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
from typing import Dict,Any
import argparse
import os
import sys
import openai
from dotenv import load_dotenv
import random
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

import aiohttp
import subprocess
from contextlib import asynccontextmanager

from pipecat.transports.services.helpers.daily_rest import (
    DailyRESTHelper,
    DailyRoomObject,
    DailyRoomParams,
    DailyRoomProperties,
    DailyRoomSipParams,
)

from loguru import logger

import shlex

# logger.remove(0)
logger.add(sys.stderr, level="DEBUG")

load_dotenv(override=True)




# ------------ Configuration ------------ #

MAX_SESSION_TIME = 5 * 60  # 5 minutes
REQUIRED_ENV_VARS = ["OPENAI_API_KEY", "DAILY_API_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]

daily_helpers = {}

# ----------------- API ----------------- #

current_instructions = "Be helpful and nice!"


@asynccontextmanager
async def lifespan(app: FastAPI):
    aiohttp_session = aiohttp.ClientSession()
    daily_helpers["rest"] = DailyRESTHelper(
        daily_api_key=os.getenv("DAILY_API_KEY", ""),
        daily_api_url=os.getenv("DAILY_API_URL", "https://api.daily.co/v1"),
        aiohttp_session=aiohttp_session,
    )
    yield
    await aiohttp_session.close()


app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


"""
Create Daily room, tell the bot if the room is created for Twilio's SIP or Daily's SIP (vendor).
When the vendor is Daily, the bot handles the call forwarding automatically,
i.e, forwards the call from the "hold music state" to the Daily Room's SIP URI.

Alternatively, when the vendor is Twilio (not Daily), the bot is responsible for
updating the state on Twilio. So when `dialin-ready` fires, it takes appropriate
action using the Twilio Client library.
"""
async def _create_daily_room(
    room_url, callId, callDomain=None, dialoutNumber=None, vendor="daily", detect_voicemail=False, instructions=None
):
    if not room_url:
        # Create base properties with SIP settings
        properties = DailyRoomProperties(
            sip=DailyRoomSipParams(
                display_name="dialin-user", video=False, sip_mode="dial-in", num_endpoints=1
            )
        )

        # Only enable dialout if dialoutNumber is provided
        if dialoutNumber:
            properties.enable_dialout = True

        params = DailyRoomParams(properties=properties)

        logger.debug(f"Creating new room...")
        room: DailyRoomObject = await daily_helpers["rest"].create_room(params=params)

    else:
        # Check passed room URL exist (we assume that it already has a sip set up!)
        try:
            room: DailyRoomObject = await daily_helpers["rest"].get_room_from_url(room_url)
        except Exception:
            raise HTTPException(status_code=500, detail=f"Room not found: {room_url}")

    logger.debug(f"Daily room: {room.url} {room.config.sip_endpoint}")

    # Give the agent a token to join the session
    token = await daily_helpers["rest"].get_token(room.url, MAX_SESSION_TIME)

    if not room or not token:
        raise HTTPException(status_code=500, detail=f"Failed to get room or token token")

    # Spawn a new agent, and join the user session
    # Note: this is mostly for demonstration purposes (refer to 'deployment' in docs)
    
    bot_proc = f"python3 -m bot -u {room.url} -t {token} -i {callId} -d {callDomain}{' -v' if detect_voicemail else ''}"
    if dialoutNumber:
        bot_proc += f" -o {dialoutNumber}"
    if instructions:
        bot_proc += f" -p {shlex.quote(instructions)}"

    try:
        subprocess.Popen(
            [bot_proc], shell=True, bufsize=1, cwd=os.path.dirname(os.path.abspath(__file__))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start subprocess: {e}")

    return room

async def _create_local_session(instructions: str):
    
    bot_proc = f"python3 -m bot -p {instructions}"
    
    try:
        subprocess.Popen(
            [bot_proc], shell=True, bufsize=1, cwd=os.path.dirname(os.path.abspath(__file__))
        )
        return True
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start subprocess: {e}")

@app.post("/update_instructions")
async def update_instructions(request: Request) -> JSONResponse:
    global current_instructions
    data = await request.json()
    data = data['data']
    logger.debug(data)
    if "instructions" in data:
        current_instructions = data.get('instructions')
        return JSONResponse({'success':True})
    else:
        return JSONResponse({'success':False})
    


@app.post("/daily_start_bot")
async def daily_start_bot(request: Request) -> JSONResponse:
    # The /daily_start_bot is invoked when a call is received on Daily's SIP URI
    # daily_start_bot will create the room, put the call on hold until
    # the bot and sip worker are ready. Daily will automatically
    # forward the call to the SIP URi when dialin_ready fires.

    # Use specified room URL, or create a new one if not specified
    room_url = os.getenv("DAILY_SAMPLE_ROOM_URL", None)
    # Get the dial-in properties from the request
    try:
        data = await request.json()
        if "test" in data:
            # Pass through any webhook checks
            return JSONResponse({"test": True})
        detect_voicemail = data.get("detectVoicemail", False)
        callId = data.get("callId", None)
        callDomain = data.get("callDomain", None)
        dialoutNumber = data.get("dialoutNumber", None)
    except Exception:
        raise HTTPException(
            status_code=500, detail="Missing properties 'callId', 'callDomain', or 'dialoutNumber'"
        )

    room: DailyRoomObject = await _create_daily_room(
        room_url, callId, callDomain, dialoutNumber, "daily", detect_voicemail, current_instructions
    )

    # Grab a token for the user to join with
    return JSONResponse({"room_url": room.url, "sipUri": room.config.sip_endpoint})

@app.post("/local_start_bot")
async def local_start_bot(request: Request) -> JSONResponse:
    
    data = await request.json()
    instructions = data.get('instructions',None)
    success = False
    if instructions:
        success = await _create_local_session(instructions)

    return JSONResponse({'success':success})

# Get API key from environment variable

class Response(BaseModel):
    content: list[str]

@app.get("/generate-examples")
# @app.post("/generate-examples")
async def generate_ex(Persona: str = Query(...), Field: str = Query(...)):

    logger.debug(Persona)
    logger.debug(Field)

    # Initialize OpenAI LLM
    model= ChatOpenAI(
        model="gpt-4o-mini",  # Replace with the model you want to use
        temperature=0.7,
        response_format=Response
    )

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
    {{content: []}}
    
    Below is an example: 
    
    The persona of a patient includes that they have severe anxiety. You should return something like:
    {{content: ['I feel like I cannot breathe.','I cannot deal with this anymore.','I am exhausted.']}}    
    """

    prompt = PromptTemplate.from_template(template)
    #     input_variables=["Persona","Field"],
    #     template=template
    # )


    # Combine LLM and PromptTemplate into a chain
    chain = prompt | model

    # Call the chain
    response = chain.invoke({"Persona":f'{Persona}', "Field": f'{Field}'})
    # response = chain.invoke(input)
    
    # logger.debug(response.content)
    return response.content

@app.get("/provide-hints")
# @app.post("/provide-hints")
async def generate_hint(Persona: str = Query(...), Field: str = Query(...)):

    # Persona = input.Persona
    # Field = input.Field
    logger.debug(Persona)
    logger.debug(Field)

    # Initialize OpenAI LLM
    model= ChatOpenAI(
        model="gpt-4o-mini",  # Replace with the model you want to use
        temperature=0.7,
        response_format=Response
    )

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
    {{content: []}} 

    Example:

    The persona of a patient includes that they have severe anxiety, is fidgety, has a stressful work culture, and is a trans woman. The input field is "feelingsAndThoughts". You should return something like:
    {{content: ['Since you mentioned that the patient was fidgety, do you think there are any feelings that can be aligned to that?','In the cultural context, you mention that their work culture is very stressful. Is there anything you can align here','Do you know if being a transgender is having an effect on them. What would that look like?']}}

    If the content field is empty or contains an empty string, return an array of three empty strings.
    Example:
    Given: {{'Field':{{content: [""]}}}}
    Return: {{content: ["","",""]}}

    """



    prompt = PromptTemplate.from_template(template)
    #     input_variables=["Persona","Field"],
    #     template=template
    # )


    # Combine LLM and PromptTemplate into a chain
    chain = prompt | model

    # Call the chain
    response = chain.invoke({"Persona":f'{Persona}', "Field": f'{Field}'})
    # response = chain.invoke(input)
    
    logger.debug(response.content)
    return response.content
    
    

    


@app.get("/session")
async def get_session():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.openai.com/v1/realtime/sessions',
            headers={
                'Authorization': f'Bearer {os.environ['OPENAI_API_KEY']}',
                'Content-Type': 'application/json'
            },
            json={
                "model": "gpt-4o-realtime-preview-2024-12-17",
                "voice": "echo"
            }
        )
        return response.json()
    

if __name__ == "__main__":
    # Check environment variables
    for env_var in REQUIRED_ENV_VARS:
        if env_var not in os.environ:
            raise Exception(f"Missing environment variable: {env_var}.")

    parser = argparse.ArgumentParser(description="Pipecat Bot Runner")
    parser.add_argument(
        "--host", type=str, default=os.getenv("HOST", "0.0.0.0"), help="Host address"
    )
    parser.add_argument("--port", type=int, default=os.getenv("PORT", 7860), help="Port number")
    parser.add_argument("--reload", action="store_true", default=True, help="Reload code on change")

    config = parser.parse_args()

    try:
        import uvicorn

        uvicorn.run("runner:app", host=config.host, port=config.port, reload=config.reload)

    except KeyboardInterrupt:
        logger.debug("Pipecat runner shutting down...")