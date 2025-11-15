import requests
import base64
import json
import subprocess
from Crypto.Cipher import AES
import requests.exceptions # Import requests.exceptions for specific error handling
import time

# Placeholder for sensitive credentials.
# It's recommended to load these from a secure location like environment variables or a config file.
USER_AGENT = 'YOUR_PROJECT_USER_AGENT'

COMMON_HEADERS = {'User-Agent': USER_AGENT, 'Content-Type': 'application/json'}


def get_reliable_windows_id():
    try:
        # Hide PowerShell windows by using CREATE_NO_WINDOW flag
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        
        # Get BIOS Serial Number
        bios_serial_cmd = [
            'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command',
            "(Get-CimInstance -Class Win32_BIOS).SerialNumber"
        ]
        bios_serial = subprocess.run(
            bios_serial_cmd, 
            capture_output=True, 
            text=True, 
            startupinfo=startupinfo,
            creationflags=subprocess.CREATE_NO_WINDOW
        ).stdout.strip()

        # Get System UUID
        uuid_cmd = [
            'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command',
            "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"
        ]
        uuid = subprocess.run(
            uuid_cmd, 
            capture_output=True, 
            text=True, 
            startupinfo=startupinfo,
            creationflags=subprocess.CREATE_NO_WINDOW
        ).stdout.strip()

        # Handle possible empty results
        if not bios_serial or not uuid:
            raise ValueError("Missing BIOS Serial or UUID")

        return f"{bios_serial}-{uuid}"

    except Exception as e:
        # printf"[ERROR] Unable to get reliable ID: {e}")
        return None


def refresh_token_hendler(URL, session_token, user_id, device_id, refresh_token):
    payload = {
        "user_id": user_id,
        "device_id": device_id,
        "session_token": session_token,
        "refresh_token": refresh_token
    }
    try:
        response = requests.post(URL, headers=COMMON_HEADERS, json=payload)
        if response.status_code == 200:
            try:
                data = response.json()
                # printf"📄 Response: {json.dumps(data, indent=2)}")
                if data.get('success'):
                    # print"✅ Refresh successful!")
                    return {
                        'success': True,
                        'data': data.get('data', {}),
                        'message': data.get('message', 'Login successful'),
                        'status_code': response.status_code
                    }
                else:
                    # printf"❌ Refresh failed: {data.get('message', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': data.get('message', 'Login failed'),
                        'status_code': response.status_code,
                        'error': data
                    }
            except json.JSONDecodeError:
                # printf"❌ Invalid JSON response: {response.text}")
                return {
                    'success': False,
                    'message': 'Invalid server response',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
        else:
            # printf"❌ HTTP Error {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                return {
                    'success': False,
                    'message': error_data.get('message', f'HTTP {response.status_code} error'),
                    'status_code': response.status_code,
                    'error': error_data
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': f'HTTP {response.status_code} error',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
    except requests.exceptions.RequestException as e:
        # printf"❌ Network error: {str(e)}")
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }
    

def get_user_info(URL, session_token, user_id, device_id):
    payload = {
        "user_id": user_id,
        "device_id": device_id,
        "session_token": session_token
    }
    try:
        response = requests.post(URL, headers=COMMON_HEADERS, json=payload)
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('success'):
                    # print"✅ getting user info successful!")
                    return {
                        'success': True,
                        'data': data.get('data', {}),
                        'message': data.get('message', 'successful'),
                        'status_code': response.status_code
                        }
                else:
                    # printf"❌ Refresh failed: {data.get('message', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': data.get('message', 'Login failed'),
                        'status_code': response.status_code,
                        'error': data
                    }
            except json.JSONDecodeError:
                # printf"❌ Invalid JSON response: {response.text}")
                return {
                    'success': False,
                    'message': 'Invalid server response',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
        else:
            # printf"❌ HTTP Error {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                return {
                    'success': False,
                    'message': error_data.get('message', f'HTTP {response.status_code} error'),
                    'status_code': response.status_code,
                    'error': error_data
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': f'HTTP {response.status_code} error',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
    except requests.exceptions.RequestException as e:
        # printf"❌ Network error: {str(e)}")
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }


def get_app_config(URL, session_token, user_id, device_id):
    payload = {
        "user_id": user_id,
        "device_id": device_id,
        "session_token": session_token
    }
    try:
        response = requests.post(URL, headers=COMMON_HEADERS, json=payload)
        if response.status_code == 200:
            try:
                data = response.json()
                # printf"📄 Response: {json.dumps(data, indent=2)}")
                if data.get('success'):
                    # print"✅ getting app config successful!")
                    return {
                        'success': True,
                        'data': data.get('data', {}),
                        'message': data.get('message', 'successful'),
                        'status_code': response.status_code
                        }
                else:
                    # printf"❌ Refresh failed: {data.get('message', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': data.get('message', 'Login failed'),
                        'status_code': response.status_code,
                        'error': data
                    }
            except json.JSONDecodeError:
                # printf"❌ Invalid JSON response: {response.text}")
                return {
                    'success': False,
                    'message': 'Invalid server response',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
        else:
            # printf"❌ HTTP Error {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                return {
                    'success': False,
                    'message': error_data.get('message', f'HTTP {response.status_code} error'),
                    'status_code': response.status_code,
                    'error': error_data
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': f'HTTP {response.status_code} error',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
    except requests.exceptions.RequestException as e:
        # printf"❌ Network error: {str(e)}")
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }
def logout_session(URL, session_token, user_id, device_id):
    payload = {
        "user_id": user_id,
        "device_id": device_id,
        "session_token": session_token
    }
    try:
        response = requests.post(URL, headers=COMMON_HEADERS, json=payload)
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('success'):
                    # print"✅ logout session successful!")
                    return {
                        'success': True,
                        'message': data.get('message', 'successful'),
                        'status_code': response.status_code
                        }
                else:
                    # printf"❌ Refresh failed: {data.get('message', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': data.get('message', 'Login failed'),
                        'status_code': response.status_code,
                        'error': data
                    }
            except json.JSONDecodeError:
                # printf"❌ Invalid JSON response: {response.text}")
                return {
                    'success': False,
                    'message': 'Invalid server response',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
        else:
            # printf"❌ HTTP Error {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                return {
                    'success': False,
                    'message': error_data.get('message', f'HTTP {response.status_code} error'),
                    'status_code': response.status_code,
                    'error': error_data
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': f'HTTP {response.status_code} error',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
    except requests.exceptions.RequestException as e:
        # printf"❌ Network error: {str(e)}")
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }
def decrypt_data(encrypted_b64, key, iv):
    encrypted = base64.b64decode(encrypted_b64)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(encrypted)
    # Strip padding (PKCS7)
    pad_len = decrypted[-1]
    return decrypted[:-pad_len].decode('utf-8')

def check_status(headers, server_sts_url, retries=3, timeout=10, backoff=2):
    """
    Check server status with retries and better error handling.

    :param headers: Dict of request headers.
    :param server_sts_url: The URL to check.
    :param retries: Number of times to retry on failure.
    :param timeout: Timeout per request (in seconds).
    :param backoff: Backoff time multiplier after each retry.
    :return: (status: bool, message: str)
    """
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(server_sts_url, headers=headers, timeout=timeout)
            response.raise_for_status()

            try:
                data = response.json()
            except ValueError:
                return False, "Invalid JSON response from server."

            message = data.get('message', 'No message provided.')

            if message.lower() == 'ok':
                return True, message
            else:
                return False, message

        except requests.exceptions.Timeout:
            err_msg = f"Timeout: Attempt {attempt} of {retries}"
        except requests.exceptions.ConnectionError:
            err_msg = f"Connection error: Attempt {attempt} of {retries}"
        except requests.exceptions.HTTPError as e:
            return False, f"HTTP error: {e.response.status_code}"
        except requests.RequestException as e:
            return False, f"Request error: {e}"

        if attempt < retries:
            time.sleep(backoff * attempt)  # Exponential backoff

    return False, err_msg or "Unknown error."
    
def AI_VOISE(text_to_synthesize, url, Voise_key):
    try:
        headers = {
            'Authorization': f'Bearer {Voise_key}', # Correct format for Authorization header
            'Content-Type': 'application/json' # Ensure Content-Type is set for JSON payload
        }
        
        # Construct the JSON payload based on documentation
        json_payload = {
            "Text": text_to_synthesize,
            "VoiceId": "Hannah", # Default voice ID
            "Bitrate": "192k", # Default bitrate
            "AudioFormat": "mp3", # Default audio format
            "OutputFormat": "uri", # Request a URI as output
            "TimestampType": "sentence", # Default timestamp type
            "sync": False # Asynchronous processing
        }

        # Use requests.post with the json parameter to send the JSON payload
        response = requests.post(url, headers=headers, json=json_payload)
        
        # printf"TTS API Response Status Code: {response.status_code}")
        # printf"TTS API Raw Response Text: {response.text}")

        # Parse the response text as JSON
        try:
            response_json = response.json()
        except json.JSONDecodeError:
            return {
                'success': False,
                'message': f'Failed to decode JSON from TTS API response. Raw response: {response.text}',
                'status_code': response.status_code,
                'error': 'JSONDecodeError'
            }
        
        return {
            'success': True,
            'data': response_json,
            'message': 'Voise processed successfully',
            'status_code': response.status_code
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }
    
def subcription_manage(URL, session_token, user_id, device_id,reddem_code):
    payload = {
        "user_id": user_id,
        "device_id": device_id,
        "session_token": session_token,
        "redeem_code": reddem_code
    }
    try:
        response = requests.post(URL, headers=COMMON_HEADERS, json=payload)
        if response.status_code == 200:
            try:
                data = response.json()
                # printf"📄 Response: {json.dumps(data, indent=2)}")
                if data.get('success'):
                    # print"✅ getting subcription successful!")
                    return {
                        'success': True,
                        'data': data.get('data', {}),
                        'message': data.get('message', 'successful'),
                        'status_code': response.status_code
                        }
                else:
                    # printf"❌ Refresh failed: {data.get('message', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': data.get('message', 'Login failed'),
                        'status_code': response.status_code,
                        'error': data
                    }
            except json.JSONDecodeError:
                # printf"❌ Invalid JSON response: {response.text}")
                return {
                    'success': False,
                    'message': 'Invalid server response',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
        else:
            # printf"❌ HTTP Error {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                return {
                    'success': False,
                    'message': error_data.get('message', f'HTTP {response.status_code} error'),
                    'status_code': response.status_code,
                    'error': error_data
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'message': f'HTTP {response.status_code} error',
                    'status_code': response.status_code,
                    'raw_response': response.text
                }
    except requests.exceptions.RequestException as e:
        # printf"❌ Network error: {str(e)}")
        return {
            'success': False,
            'message': f'Network error: {str(e)}',
            'status_code': None,
            'error': str(e)
        }