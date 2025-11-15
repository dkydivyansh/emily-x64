import subprocess
from pathlib import Path
from typing import Iterable, Union, Optional, Dict, Tuple, List, Any
import json
import os
import re
import requests


def control_home_assistant(entity: str, action: str, params: Optional[Dict[str, Any]] = None, ha_token: Optional[str] = None, ha_url: Optional[str] = None) -> bool:
    domain = entity.split(".")[0]
    url = f"{ha_url}/api/services/{domain}/{action}"
    payload = {"entity_id": entity}
    ha_headers = {
        "Authorization": f"Bearer {ha_token}",
        "Content-Type": "application/json"
    }
    if params:
        payload.update(params)
    try:
        r = requests.post(url, headers=ha_headers, json=payload)
        if r.status_code in (200, 201):
            # printf"[HomeAssistant] {action} on {entity} → OK")
            return True
        else:
            # printf"[HomeAssistant] Failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        # printf"[HomeAssistant] ERROR: {e}")
        return False

def launch_hidden(
    exe: Union[str, Path],
    args: Optional[Iterable[Union[str, Path]]] = None,
) -> bool:
    """
    Start a Windows .exe in the background, hiding its console window.

    Returns True if the process was spawned successfully, else False.
    """
    try:
        exe_path = str(Path(exe).expanduser().resolve(strict=True))
        arg_list = [str(a) for a in args] if args else []

        # DETACHED_PROCESS:   child runs independently of parent console
        # CREATE_NO_WINDOW:   suppresses any console window
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW

        proc = subprocess.Popen(
            [exe_path, *arg_list],
            creationflags=flags,
            close_fds=True,
        )

        # If we reach here, Popen succeeded; extra check that it's running
        return proc.poll() is None

    except (FileNotFoundError, OSError):
        return False



CMD_PATTERN = re.compile(r'@cmd\[(.*?)\]', re.IGNORECASE | re.DOTALL)


def _extract_cmds(text: str) -> List[Dict[str, str]]:
    """Return every @cmd[...] block as a dict of key/value pairs."""
    cmds: List[Dict[str, str]] = []
    for block in CMD_PATTERN.findall(text):
        pairs = {}
        
        # Split by comma, but preserve commas inside braces
        parts = []
        current_part = ""
        brace_level = 0
        
        for char in block:
            if char == '{':
                brace_level += 1
            elif char == '}':
                brace_level -= 1
            elif char == ',' and brace_level == 0:
                parts.append(current_part.strip())
                current_part = ""
                continue
            current_part += char
        
        # Add the last part
        if current_part.strip():
            parts.append(current_part.strip())
        
        # Parse each part
        for part in parts:
            if '=' in part:
                k, v = part.split('=', 1)
                pairs[k.strip().lower()] = v.strip()
        
        cmds.append(pairs)
    return cmds


def _clean_message(text: str) -> str:
    """Remove all @cmd[...] blocks and any surrounding blank lines."""
    cleaned = CMD_PATTERN.sub('', text)
    # Collapse multiple newlines to a single newline
    cleaned = re.sub(r'\n{2,}', '\n', cleaned).strip()
    return cleaned


def _load_app_map(app_json_str: str) -> Dict[str, Dict[str, Any]]:
    """
    Build a map of code -> {'path': ..., 'arguments': [...] }
    from the JSON string in app_list['APP_LIST'].
    """
    data = json.loads(app_json_str)
    app_map = {}
    for entry in data.get("apps", []):
        app_map[entry["code"]] = {
            "path": entry["path"],
            "args": entry.get("arguments", [])
        }
    return app_map

def try_cast_int(value):
    try:
        return int(value)
    except:
        return value

def commands_check(message: str, app_list: Dict[str, str], ha_token: Optional[str] = None, ha_url: Optional[str] = None) -> Tuple[str, List[Dict[str, str]]]:
    """
    Parse `message`, execute any `@cmd[...]` directives, and return
    the cleaned plain‑text message plus a list of command dicts executed.

    Parameters
    ----------
    message : str
        Raw response from the AI (may include creative text + @cmd[...] blocks)
    app_list : dict
        Dict that contains key "APP_LIST" whose value is the JSON string
        describing all apps (codes, paths, arguments).

    Returns
    -------
    cleaned_message : str
        Message with all @cmd[...] blocks removed.
    executed_cmds : list[dict]
        Command dictionaries that were recognized and (where applicable) run.
    """
    executed: List[Dict[str, str]] = []
    cmds = _extract_cmds(message)
    app_map = _load_app_map(app_list.get("APP_LIST", "{}"))

    for cmd in cmds:
        ctype = cmd.get("type")
        if ctype == "open":          # open one or many apps
            codes = cmd.get("app", "").split('|')
            for code in codes:
                code = code.strip()
                app_info = app_map.get(code)
                if app_info:
                    ok = launch_hidden(app_info["path"], app_info["args"])
                    # printf"[Launcher] {code}: {'OK' if ok else 'FAILED'}")
                else:
                    # printf"[Launcher] Unknown app code: {code}")
                    pass
            executed.append(cmd)

        elif ctype == "link":               # open one or many URLs
                raw = cmd.get("url", "")
                # Accept either single URL or brace‑wrapped list
                if raw.startswith("{") and raw.endswith("}"):
                    # strip braces then split on commas, handle quotes properly
                    content = raw[1:-1]  # Remove braces
                    urls = []
                    # Split by comma and clean each URL
                    for url_part in content.split(","):
                        url = url_part.strip().strip("'\"")  # Remove quotes and whitespace
                        if url:  # Only add non-empty URLs
                            urls.append(url)
                else:
                    urls = [raw.strip(" '\"")]

                for url in urls:
                    if url.lower().startswith(("http://", "https://")):
                        try:
                            os.startfile(url)
                            # printf"[Browser] Opened {url}")
                        except Exception as e:
                            # printf"[Browser] Could not open {url}: {e}")
                            pass
                    else:
                        pass
                        # printf"[Browser] Skipped non‑URL value: {url}")
                
                # Add the command to executed list
                executed.append(cmd)

        elif cmd.get("action") in {"logout", "clear_data"}:
            # Confirmation logic is assumed to happen upstream (UI layer);
            # here we just record the intent.
            executed.append(cmd)

        elif cmd.get("meta"):
            # Informational / meta commands
            executed.append(cmd)

        elif ctype == "home":  # Home Assistant control
            entity = cmd.get("entity")
            action = cmd.get("action")
            if entity and action:
                # Extract other command parameters (like brightness, temperature)
                extra = {
                    k: try_cast_int(v) for k, v in cmd.items()
                    if k not in {"type", "entity", "action"}
                }
                ok = control_home_assistant(entity, action, extra, ha_token, ha_url)
                # printf"[HA] {entity} {action}: {'OK' if ok else 'FAILED'}")
            else:
                pass
                # printf"[HA] Invalid home command: {cmd}")
            executed.append(cmd)

        # Add more command types here as needed.


    return message, executed



def generate_home_assistant_commands(ha_url: str, ha_token: str) -> str:
    headers = {
        "Authorization": f"Bearer {ha_token}",
        "Content-Type": "application/json",
    }

    def smart_cast(value: str):
        v = str(value).strip().lower()
        if v in {"true", "on", "yes"}: return True
        if v in {"false", "off", "no"}: return False
        if v in {"none", "null"}: return None
        try:
            return int(v) if "." not in v else float(v)
        except ValueError:
            return value

    try:
        entity_states = requests.get(f"{ha_url}/api/states", headers=headers, timeout=10).json()
        services = requests.get(f"{ha_url}/api/services", headers=headers, timeout=10).json()
    except Exception as e:
        return f"::SYSTEM2D2F4G5S3D:: Failed to connect to Home Assistant API: {e}"

    service_map: dict[str, dict[str, list[str]]] = {}
    for svc in services:
        domain = svc["domain"]
        service_map[domain] = {
            name: list(info.get("fields", {}).keys())
            for name, info in svc["services"].items()
        }

    output: list[str] = []

    for ent in entity_states:
        entity_id = ent["entity_id"]
        domain = entity_id.split(".", 1)[0]
        attributes = ent.get("attributes", {})
        if domain not in service_map:
            continue

        # Get friendly name if available
        friendly_name = attributes.get("friendly_name", entity_id)

        for action, fields in service_map[domain].items():
            cmd_parts = [f"type=home", f"action={action}", f"entity={entity_id}"]

            for f in fields:
                if f == "entity_id":
                    continue

                if f == "rgb_color":
                    if "rgb_color" not in attributes and \
                       "rgb" not in attributes.get("supported_color_modes", []):
                        continue
                    cmd_parts.append('rgb_color=[255,0,0]')

                elif f in {"color_temp_kelvin", "color_temp"}:
                    if f not in attributes:
                        continue
                    cmd_parts.append(f"{f}=3000")

                elif f == "brightness":
                    cmd_parts.append("brightness=180")

                elif f == "brightness_pct":
                    cmd_parts.append("brightness_pct=75")

                elif f == "temperature":
                    cmd_parts.append("temperature=24")

                else:
                    cmd_parts.append(f"{f}=value")

            cmd_str = f"# {friendly_name}\n@cmd[" + ", ".join(cmd_parts) + "]"
            output.append(cmd_str)

    return "\n\n".join(output) if output else "::SYSTEM2D2F4G5S3D:: No controllable entities found."