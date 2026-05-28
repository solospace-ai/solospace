import json
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from providers import stream_provider

async def run_echohouse_simulation(
    session_id: str,
    problem_text: str,
    cast: List[Dict[str, Any]],
    provider: str = "gemini",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    api_keys: Optional[Dict[str, str]] = None,
    base_url: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Orchestrates a multi-turn social simulation where agents act as real-life people.
    Produces 3 rounds of conversation and a final Insight synthesis turn.
    """
    history: List[Dict[str, str]] = []
    
    rounds = 3
    for r in range(rounds):
        yield f"event: status\ndata: {json.dumps(f'Orchestrating Round {r + 1} of social simulation...')}\n\n"
        
        for agent in cast:
            name = agent.get("inferred_name", "Unknown")
            role = agent.get("role", "Unknown")
            problem = agent.get("inferred_problem", "")
            is_self = agent.get("is_self", False)
            
            # Embody specific character via system prompt
            system_prompt = f"""You are {name}, whose role in the user's life is: {role}.
The user has described their core problem: "{problem_text}".
From your perspective, the situation is: "{problem}".

You are participating in a social dynamics simulation. Respond authentically as this person would.
STRICT GUIDELINES:
- Embody this person completely. Do NOT speak as an AI, and do NOT be polite, helpful, or constructive unless it is authentic to this character's emotions, defense mechanisms, desires, or flaws.
- Express defensiveness, anger, sadness, love, or blind spots if they fit the situation.
- Read and react directly to what the other characters have said in the conversation history.
- Reference the user (Self) and other people by name.
- Keep your turn relatively short and punchy (around 2-4 sentences), as in a real conversation.
- Output ONLY the raw conversational speech of {name}. Do NOT prefix with your name or role in the response (e.g., do NOT write "{name}: ..."). Just output the speech itself.
"""

            messages = []
            for item in history:
                messages.append({
                    "role": "user",
                    "content": item["content"]
                })
            
            if is_self:
                messages.append({
                    "role": "user",
                    "content": f"[SYSTEM: You are {name} (Self). It is your turn to speak. React to the conversation so far.]"
                })
            else:
                messages.append({
                    "role": "user",
                    "content": f"[SYSTEM: You are {name} ({role}). It is your turn to speak. React to the conversation so far.]"
                })

            # Send metadata for active speaker
            yield f"event: metadata\ndata: {json.dumps({'active_speaker': name})}\n\n"
            await asyncio.sleep(0.1)
            
            agent_speech = ""
            try:
                async for token in stream_provider(
                    provider=provider,
                    model=model,
                    api_key=api_key or "",
                    messages=messages,
                    system_prompt=system_prompt,
                    temperature=0.8,
                    api_keys=api_keys,
                    base_url=base_url
                ):
                    agent_speech += token
                    yield f"event: text\ndata: {json.dumps(token)}\n\n"
            except Exception as e:
                err_msg = f"[Simulation Error for {name}: {str(e)}]"
                agent_speech += err_msg
                yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"
            
            history.append({
                "role": "user",
                "content": f"{name} ({role}): {agent_speech}"
            })
            await asyncio.sleep(0.5)

    # ── Final Insight synthesis ─────────────────────────────────────────
    yield f"event: status\ndata: {json.dumps('Generating simulation insight synthesis...')}\n\n"
    
    insight_system_prompt = """You are an expert system therapist and social analyst.
Analyze the preceding simulated conversation and synthesize a deep insight.
Your response must speak from a neutral, objective third-person perspective.
Identify:
1. The underlying emotional needs and core fears of each participant.
2. Repetitive toxic or unproductive patterns observed in the simulation.
3. Actionable, compassionate suggestions for how the user can approach this situation in real life to break the pattern.

Keep it structured, clear, and highly insightful.
"""

    messages = []
    for item in history:
        messages.append({
            "role": "user",
            "content": item["content"]
        })
    messages.append({
        "role": "user",
        "content": "[SYSTEM: Provide the final therapeutic insight and analysis of this simulated family/social dynamic.]"
    })
    
    yield f"event: metadata\ndata: {json.dumps({'active_speaker': 'insight'})}\n\n"
    await asyncio.sleep(0.1)

    try:
        async for token in stream_provider(
            provider=provider,
            model=model,
            api_key=api_key or "",
            messages=messages,
            system_prompt=insight_system_prompt,
            temperature=0.5,
            api_keys=api_keys,
            base_url=base_url
        ):
            yield f"event: text\ndata: {json.dumps(token)}\n\n"
    except Exception as e:
        err_msg = f"[Insight generation failed: {str(e)}]"
        yield f"event: text\ndata: {json.dumps(err_msg)}\n\n"

    yield "event: done\ndata: {}\n\n"
