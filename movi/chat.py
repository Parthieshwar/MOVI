import sqlite3
import json
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool
from typing import Optional
from asr import transcribe_audio
from tts import text_to_speech
from dotenv import load_dotenv
import os

load_dotenv()

# Base directory (where your app.py is located)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database path
DATABASE = r"C:\Data\moveinsync.db"  # full path to existing database

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# SQL Query Tool - LLM generates SQL queries
@tool
def execute_sql_query(sql_query: str) -> str:
    """
    Execute a SQL SELECT query on the moveinsync database and return results as JSON.
    Use this tool to query information from tables: Stops, Paths, Routes, Vehicles, Drivers, DailyTrips, Deployments.
    
    Args:
        sql_query: A valid SQL SELECT query
    
    Returns:
        JSON string with query results
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(sql_query)
        results = cursor.fetchall()
        conn.close()
        
        if not results:
            return json.dumps({"status": "success", "result": "No data found", "row_count": 0})
        
        return json.dumps({
            "status": "success",
            "result": [dict(row) for row in results],
            "row_count": len(results)
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

@tool
def execute_sql_write(sql_query: str) -> str:
    """
    Execute a SQL INSERT, UPDATE, or DELETE query on the moveinsync database.
    Use this for creating, updating, or deleting records. This will actually modify the database.
    
    Args:
        sql_query: A valid SQL INSERT/UPDATE/DELETE query
    
    Returns:
        JSON string with execution results
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute(sql_query)
        conn.commit()
        affected_rows = cursor.rowcount
        conn.close()
        
        return json.dumps({
            "status": "success",
            "affected_rows": affected_rows,
            "message": f"Successfully modified {affected_rows} row(s) in the database"
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})

# Get schema information for LLM awareness
def get_schema_info() -> str:
    """Returns database schema information for LLM context."""
    return """
DATABASE SCHEMA:
================

1. Stops Table:
   - stop_id (TEXT, PRIMARY KEY) - Example: 's1', 's2'
   - name (TEXT) - Stop name
   - latitude (REAL) - Latitude coordinate
   - longitude (REAL) - Longitude coordinate

2. Paths Table:
   - path_id (TEXT, PRIMARY KEY) - Example: 'p1', 'p2'
   - path_name (TEXT) - Path name
   - ordered_list_of_stop_ids (TEXT, JSON format) - Example: '["s1", "s2", "s3"]'

3. Routes Table:
   - route_id (TEXT, PRIMARY KEY) - Example: 'r1', 'r2'
   - path_id (TEXT, FOREIGN KEY)
   - route_display_name (TEXT)
   - shift_time (TEXT)
   - direction (TEXT)
   - start_point (TEXT)
   - end_point (TEXT)
   - capacity (INTEGER)
   - allowed_waitlist (INTEGER)
   - status (TEXT, default 'active')

4. Vehicles Table:
   - vehicle_id (TEXT, PRIMARY KEY) - Example: 'v1', 'v2'
   - license_plate (TEXT, UNIQUE)
   - type (TEXT)
   - capacity (INTEGER)

5. Drivers Table:
   - driver_id (TEXT, PRIMARY KEY) - Example: 'd1', 'd2'
   - name (TEXT)
   - phone_number (TEXT)

6. DailyTrips Table:
   - trip_id (TEXT, PRIMARY KEY) - Example: 't1', 't2'
   - route_id (TEXT, FOREIGN KEY)
   - display_name (TEXT) - Trip display name
   - booking_status_percentage (INTEGER) - Percentage of bookings (0-100)
   - live_status (TEXT) - Status like 'scheduled', 'ongoing', 'completed'

7. Deployments Table:
   - deployment_id (TEXT, PRIMARY KEY) - Example: 'dep1', 'dep2'
   - trip_id (TEXT, FOREIGN KEY)
   - vehicle_id (TEXT, FOREIGN KEY, can be NULL)
   - driver_id (TEXT, FOREIGN KEY, can be NULL)
"""

def get_shared_llm():
    """Returns a single LLM instance reused across all nodes."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0,
        api_key=os.getenv("GOOGLE_API_KEY")
    )

shared_llm = get_shared_llm()

# State definition
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    pending_action: str  # Stores the SQL to execute after confirmation
    requires_confirmation: bool
    awaiting_confirmation: bool
    current_page: str  # 👈 add this
    image_path: Optional[str]  # 👈 optional for multimodal input

# Node: Agent Entry - LLM analyzes intent and decides action
def agent_entry(state: AgentState) -> AgentState:
    """
    Entry point where LLM analyzes user request and decides on action.
    For READ operations: Calls execute_sql_query directly
    For WRITE operations: Identifies them and routes to consequence checking
    """
    # llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, api_key=os.getenv("GOOGLE_API_KEY1"))
    
    tools = [execute_sql_query, execute_sql_write]
    llm_with_tools = shared_llm.bind_tools(tools)
    
    messages = state["messages"]
    
    # System prompt with clear instructions
    system_context = f"""You are Movi, an intelligent transport management assistant with access to a database.

{get_schema_info()}

CURRENT PAGE CONTEXT:
---------------------
The user is currently on the **{state.get('current_page', 'home')}** page.

Behave as a context-aware agent:
- If on `busDashboard`: prioritize live trip data, vehicle assignments, and driver status.
- If on `manageRoute`: focus on creating, updating, or analyzing routes and paths.
- If on `home`: provide summaries, daily overviews, or insights.
Adapt your responses and SQL accordingly.

IMPORTANT INSTRUCTIONS:

1. For READ/QUERY operations (How many, What's the status, List, Show):
   - Use execute_sql_query tool with appropriate SELECT statements
   - Analyze results and provide clear answers

2. For WRITE operations (Create, Assign, Remove, Delete, Update, Modify):
   - IDENTIFY the operation type but DO NOT execute yet
   - Respond with: "I understand you want to [action]. Let me check if there are any consequences first."

3. SQL Guidelines:
   - Use proper JOINs when querying across tables
   - For "not assigned": LEFT JOIN Deployments and WHERE vehicle_id IS NULL
   - Use LIKE for partial text matching
"""

    enriched_messages = [
        HumanMessage(content=system_context)
    ] + messages
    
    # Optional multimodal input (if user uploads an image)
    if state.get("image_path"):
        enriched_messages.append(
            HumanMessage(
                content=[
                    {"type": "text", "text": "Here is an image related to my query:"},
                    {"type": "image_url", "image_url": f"file://{state['image_path']}"}
                ]
            )
        )

    
    response = llm_with_tools.invoke(enriched_messages)
    
    return {
        "messages": [response],
        "pending_action": "",
        "requires_confirmation": False,
        "awaiting_confirmation": False
    }

# Node: Analyze for Write Operation
def analyze_write_operation(state: AgentState) -> AgentState:
    """LLM analyzes the operation and decides if consequence checking is needed."""
    messages = state["messages"]
    
    analysis_prompt = """Analyze the user's request and determine:

1. Is this a WRITE operation (INSERT, UPDATE, DELETE) that modifies the database?
2. Does this operation need consequence checking?
   - YES if it affects: vehicles/drivers assigned to trips, trips with bookings, active routes
   - NO if it's: reading data (SELECT queries), simple inserts with no dependencies

You MUST respond with ONLY a valid JSON object, no extra text:
{
    "is_write_operation": true,
    "has_consequences": true,
    "sql_query": "UPDATE Deployments SET vehicle_id = NULL WHERE vehicle_id = 'v7'",
    "reasoning": "Removing vehicle from trips with bookings"
}"""

    analysis_messages = messages + [HumanMessage(content=analysis_prompt)]
    response = shared_llm.invoke(analysis_messages)
    
    try:
        content = response.content
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()
        else:
            json_str = content.strip()
            
        analysis = json.loads(json_str)
        print(f"[ANALYZE] has_consequences: {analysis.get('has_consequences')}")
        
        return {
            "messages": [response],
            "pending_action": analysis.get("sql_query", ""),
            "requires_confirmation": analysis.get("has_consequences", False)
        }
    except Exception as e:
        print(f"[ERROR] Failed to parse analysis: {e}")
        # Fallback logic
        user_msg = ""
        for msg in messages:
            if isinstance(msg, HumanMessage):
                content = msg.content
                if isinstance(content, list):
                    content = " ".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])
                user_msg = str(content).lower()
                break
        
        has_consequences = any(kw in user_msg for kw in ["remove", "delete", "update"]) and \
                          any(kw in user_msg for kw in ["vehicle", "driver", "trip"])
        
        return {
            "messages": [response],
            "requires_confirmation": has_consequences,
            "pending_action": ""
        }

# 2. CHECK CONSEQUENCES - Simplified
def check_consequences(state: AgentState) -> AgentState:
    """LLM queries the database to check consequences."""
    tools = [execute_sql_query]
    llm_with_tools = shared_llm.bind_tools(tools)
    
    messages = state["messages"]
    pending_action = state.get("pending_action", "")
    
    consequence_prompt = f"""The user wants to perform this operation:
Pending SQL: {pending_action if pending_action else "Not yet determined"}

Your task: Query the database to check for consequences.

{get_schema_info()}

Check:
1. Will this affect any trips with bookings (booking_status_percentage > 0)?
2. Are there scheduled trips that will be impacted?
3. What are the specific consequences?

Use execute_sql_query to gather information. Be specific about booking percentages and affected trips."""

    consequence_messages = messages + [HumanMessage(content=consequence_prompt)]
    response = llm_with_tools.invoke(consequence_messages)
    
    return {"messages": [response]}


# Node: Get Confirmation
def get_confirmation(state: AgentState) -> AgentState:
    """LLM generates a clear confirmation message with consequences."""
    messages = state["messages"]
    # Extract consequence check results from tool messages
    consequence_data = ""
    for msg in reversed(messages):
        if isinstance(msg, ToolMessage):
            consequence_data = msg.content
            break
    confirmation_prompt = f"""Based on the consequence analysis results below, generate a clear confirmation message.

CONSEQUENCE CHECK RESULTS:
{consequence_data}

Format: "I can [action]. However, please be aware: [specific consequences with numbers]. Do you want to proceed? (yes/no)"

Be specific about:
- Exact booking percentages
- Trip names affected  
- What will happen (bookings cancelled, trip-sheet will fail, etc.)
- Number of affected records"""
    confirmation_messages = [HumanMessage(content=confirmation_prompt)]
    response = shared_llm.invoke(confirmation_messages)
    return {
        **state,
        "messages": [response],
        "awaiting_confirmation": True
    }

# 4. HANDLE CONFIRMATION - Clears requires_confirmation flag
def handle_confirmation_response(state: AgentState) -> AgentState:
    """Parse user's yes/no response."""
    messages = state["messages"]
    # Get last user message
    last_user_msg = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            content = msg.content
            if isinstance(content, list):
                content = " ".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])
            last_user_msg = str(content).lower().strip()
            break
    print(f"[HANDLE_CONFIRMATION] User response: '{last_user_msg}'")
    if any(word in last_user_msg for word in ["yes", "y", "proceed", "ok", "confirm", "sure"]):
        print("[HANDLE_CONFIRMATION] → User confirmed")
        # Preserve all previous state, just update flags
        return {
            **state,
            "awaiting_confirmation": False,
            "requires_confirmation": False,
        }
    elif any(word in last_user_msg for word in ["no", "n", "cancel", "abort", "stop"]):
        print("[HANDLE_CONFIRMATION] → User cancelled")
        return {
            **state,
            "messages": [AIMessage(content="Action cancelled. No changes made to the database.")],
            "awaiting_confirmation": False,
            "requires_confirmation": False,
            "pending_action": ""
        }
    else:
        return {
            **state,
            "messages": [AIMessage(content="Please respond with 'yes' to proceed or 'no' to cancel.")],
            "awaiting_confirmation": True
        }


# 5. EXECUTE ACTION - Uses pending_action SQL
def execute_action(state: AgentState) -> AgentState:
    """LLM generates and executes the write SQL query."""
    tools = [execute_sql_write]
    llm_with_tools = shared_llm.bind_tools(tools)
    
    messages = state["messages"]
    pending_action = state.get("pending_action", "")
    
    # Get original user request
    original_request = ""
    for msg in messages:
        if isinstance(msg, HumanMessage):
            content = msg.content
            if isinstance(content, list):
                content = " ".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])
            original_request = str(content)
            break
    
    execution_prompt = f"""Now execute the write operation.

ORIGINAL REQUEST: {original_request}

{get_schema_info()}

{'IMPORTANT: Use this exact SQL: ' + pending_action if pending_action else 'Generate the appropriate SQL query.'}

Use execute_sql_write to modify the database. Confirm success with details."""

    context_messages = [HumanMessage(content=execution_prompt)]
    response = llm_with_tools.invoke(context_messages)
    
    print(f"[EXECUTE_ACTION] Pending SQL: {pending_action}")
    
    return {
        "messages": [response],
        "awaiting_confirmation": False
    }


# Node: Generate Response
def generate_response(state: AgentState) -> AgentState:
    """
    LLM generates final response based on query results.
    """
    # llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, api_key=os.getenv("GOOGLE_API_KEY2"))
    
    messages = state["messages"]
    
    response_prompt = """Based on the query results, provide a clear, concise answer to the user's question.

If data was retrieved:
- Summarize the results in natural language
- Include specific numbers and details
- Format lists clearly

Be direct and helpful."""

    final_messages = messages + [HumanMessage(content=response_prompt)]
    response = shared_llm.invoke(final_messages)
    
    return {"messages": [response]}
# 6. ROUTING FUNCTIONS
def route_after_entry(state: AgentState) -> Literal["tools", "analyze_write"]:
    """Route after agent entry based on tool calls."""
    messages = state["messages"]
    last_message = messages[-1] if messages else None
    
    if last_message and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return "tools"
    
    if last_message and hasattr(last_message, 'content'):
        content = last_message.content
        if isinstance(content, list):
            content = " ".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])
        content = str(content).lower()
        
        if any(kw in content for kw in ["check if there are any consequences", "let me check"]):
            return "analyze_write"
    
    return "tools"


def route_after_analyze(state: AgentState) -> Literal["check_consequences", "execute_action"]:
    """Route based on LLM's decision about consequences."""
    requires_confirmation = state.get("requires_confirmation", False)
    
    if requires_confirmation:
        print("[ROUTE] → check_consequences (LLM detected potential impact)")
        return "check_consequences"
    else:
        print("[ROUTE] → execute_action (No consequences detected)")
        return "execute_action"


def route_after_consequences(state: AgentState) -> Literal["tools", "get_confirmation"]:
    """Route after consequence checking."""
    messages = state["messages"]
    last_message = messages[-1] if messages else None
    
    if last_message and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        print("[ROUTE] → tools (processing consequence queries)")
        return "tools"
    
    print("[ROUTE] → get_confirmation")
    return "get_confirmation"


def route_after_confirmation(state: AgentState) -> Literal["execute_action", "end"]:
    """Route based on confirmation status."""
    awaiting = state.get("awaiting_confirmation", False)
    
    print(f"[ROUTE_AFTER_CONFIRMATION] awaiting_confirmation={awaiting}")
    
    if awaiting:
        print("[ROUTE] → end (still awaiting)")
        return "end"
    
    messages = state["messages"]
    if messages:
        last_msg = messages[-1]
        if isinstance(last_msg, AIMessage) and hasattr(last_msg, 'content'):
            content = last_msg.content
            if isinstance(content, list):
                content = " ".join([str(item.get("text", "")) if isinstance(item, dict) else str(item) for item in content])
            content = str(content).lower()
            
            if "cancelled" in content or "no changes made" in content:
                print("[ROUTE] → end (user cancelled)")
                return "end"
    
    print("[ROUTE] → execute_action (user confirmed)")
    return "execute_action"


# 7. BUILD GRAPH - With interrupt_before
def build_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("agent_entry", agent_entry)
    workflow.add_node("tools", ToolNode([execute_sql_query, execute_sql_write]))
    workflow.add_node("analyze_write", analyze_write_operation)
    workflow.add_node("check_consequences", check_consequences)
    workflow.add_node("tools_consequences", ToolNode([execute_sql_query]))
    workflow.add_node("get_confirmation", get_confirmation)
    workflow.add_node("execute_action", execute_action)
    workflow.add_node("tools_for_execution", ToolNode([execute_sql_write]))
    workflow.add_node("handle_confirmation", handle_confirmation_response)
    workflow.add_node("generate_response", generate_response)
    
    # Define edges
    workflow.add_edge(START, "agent_entry")
    
    workflow.add_conditional_edges(
        "agent_entry",
        route_after_entry,
        {"tools": "tools", "analyze_write": "analyze_write"}
    )
    
    workflow.add_edge("tools", "analyze_write")
    
    workflow.add_conditional_edges(
        "analyze_write",
        route_after_analyze,
        {"check_consequences": "check_consequences", "execute_action": "execute_action"}
    )
    
    workflow.add_conditional_edges(
        "check_consequences",
        route_after_consequences,
        {"tools": "tools_consequences", "get_confirmation": "get_confirmation"}
    )
    
    workflow.add_edge("tools_consequences", "get_confirmation")
    workflow.add_edge("get_confirmation", "handle_confirmation")
    
    workflow.add_conditional_edges(
        "handle_confirmation",
        route_after_confirmation,
        {"execute_action": "execute_action", "end": END}
    )
    
    workflow.add_edge("execute_action", "tools_for_execution")
    workflow.add_edge("tools_for_execution", "generate_response")
    workflow.add_edge("generate_response", END)
    
    # CRITICAL: Interrupt before handle_confirmation for human-in-the-loop
    return workflow.compile(
        checkpointer=MemorySaver(),
        interrupt_before=["handle_confirmation"]
    )


# 8. RUN AGENT - FIXED VERSION with proper interrupt handling
def run_movi_agent(
    user_id: str,
    message_type: str,
    content: str = "",
    audio_path: str = None,
    image_path: str = None,
    current_page: str = "",
    thread_id: str = None
):
    """Runs the LangGraph workflow with human-in-the-loop support."""
    
    graph = build_graph()
    
    # Transcribe audio if needed
    if message_type == "audio" and audio_path:
        try:
            content = transcribe_audio(audio_path)
        except Exception as e:
            content = "(Unable to transcribe audio)"
    
    # Generate thread_id
    if not thread_id:
        import uuid
        thread_id = f"thread_{user_id}_{uuid.uuid4().hex[:8]}"
    
    config = {"configurable": {"thread_id": thread_id}}
    
    # Check if resuming from interrupt
    try:
        current_state = graph.get_state(config)
        
        # Check if graph is interrupted (waiting at handle_confirmation)
        if current_state and current_state.next and "handle_confirmation" in current_state.next:
            print("[HUMAN-IN-LOOP] Resuming from confirmation interrupt")
            print(f"[DEBUG] Current state keys: {current_state.values.keys() if current_state.values else 'None'}")
            print(f"[DEBUG] Pending action: {current_state.values.get('pending_action', 'None') if current_state.values else 'None'}")
            
            # FIX: Add the user's confirmation response to the existing state
            # Don't reconstruct the state, just append the new message
            new_message = HumanMessage(content=content)
            
            # Update state by adding the confirmation message
            graph.update_state(
                config,
                {"messages": [new_message]},
                as_node="get_confirmation"  # This tells LangGraph which node just "produced" this update
            )
            
            # Resume from the interrupt - this will pick up from handle_confirmation
            result = None
            for state in graph.stream(None, config, stream_mode="values"):
                result = state
                print(f"[STREAM] Current node: {state}")
                
        else:
            # New request
            print("[NEW REQUEST] Starting new conversation flow")
            state = {
                "messages": [HumanMessage(content=content)],
                "image_path": image_path or None,
                "pending_action": "",
                "requires_confirmation": False,
                "awaiting_confirmation": False,
                "current_page": current_page,
            }
            
            result = None
            for state in graph.stream(state, config, stream_mode="values"):
                result = state
            
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        
        state = {
            "messages": [HumanMessage(content=content)],
            "image_path": image_path or None,
            "pending_action": "",
            "requires_confirmation": False,
            "awaiting_confirmation": False,
            "current_page": current_page,
        }
        
        result = None
        for state in graph.stream(state, config, stream_mode="values"):
            result = state
    
    # Extract response
    response_text = ""
    if result:
        for msg in reversed(result.get("messages", [])):
            if isinstance(msg, AIMessage):
                response_text = msg.content
                break
    
    if isinstance(response_text, list):
        response_text = " ".join(
            [str(item.get("text", "")) if isinstance(item, dict) else str(item)
             for item in response_text]
        )

    print(f"[AGENT RESPONSE] {response_text}")
    
    # Check if waiting for confirmation
    final_state = graph.get_state(config)
    needs_confirmation = (
        final_state.next and "handle_confirmation" in final_state.next
    ) if final_state else False
    
    # TTS
    audio_output_path = None
    try:
        if response_text:
            audio_output_path = text_to_speech(response_text)
    except Exception as e:
        print(f"[TTS] Failed: {e}")
    
    return {
        "response": response_text or "I received your request.",
        "audio_path": audio_output_path,
        "needs_confirmation": needs_confirmation,
        "thread_id": thread_id
    }

if __name__ == "__main__":
    # Build/compile your graph
    app = build_graph()   # assuming your function returns a compiled graph

    # Get the underlying graph
    graph = app.get_graph()

    # Draw as PNG bytes
    png_bytes = graph.draw_mermaid_png(output_file_path="movi_graph.png")
    
    print("✅ Graph image saved to 'movi_graph.png'")
