import webview
import json
from typing import Optional
import requests
import os   
import sys
# Store login result here
_login_result = None

class LoginAPI:
    def __init__(self, login_url, device_id, window):
        self.login_url = login_url
        self.device_id = device_id
        self.window = window

    def submit_login(self, email, password):
        global _login_result
        result = login(self.login_url, email, password, self.device_id)
        _login_result = result
        if result.get('success'):
            # Just close the window, no confirmation
            self.window.events.closing.clear()  # Remove all close confirmation handlers
            self.window.destroy()
        return result

    def close_window(self):
        self.window.destroy()

def show_login_window(LOGIN_URL: str, device_id: str, width: int = 500, height: int = 700) -> dict:
    global _login_result
    _login_result = None
    window = webview.create_window(
        'Login',
        os.path.join(getattr(sys, '_MEIPASS', os.path.abspath(".")), 'frontend/login.html'),
        width=width,
        height=height,
        resizable=True,
        confirm_close=False  # Remove close confirmation
    )
    api = LoginAPI(LOGIN_URL, device_id, window)
    window.expose(api.submit_login, api.close_window)

    def on_loaded():
        window.evaluate_js(f"window.LOGIN_URL = '{LOGIN_URL}'; window.DEVICE_ID = '{device_id}';")

    window.events.loaded += on_loaded

    def on_closed():
        # If closed without login, set a default result
        global _login_result
        if _login_result is None:
            _login_result = {'success': False, 'message': 'Login cancelled by user'}
    window.events.closed += on_closed

    webview.start(debug=False)
    
    return _login_result if _login_result is not None else {'success': False, 'message': 'Login cancelled by user'}

# --- HTTP login function ---
def login(LOGIN_URL, email, password, device_id):
    headers = {
        'User-Agent': 'your_user_agent',
        'Content-Type': 'application/json'
    }
    payload = {
        "email": email,
        "password": password,
        "device_id": device_id
    }
    try:
        response = requests.post(LOGIN_URL, headers=headers, json=payload)
        # printf"📊 Status Code: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                # printf"📄 Response: {json.dumps(data, indent=2)}")
                if data.get('success'):
                    # print"✅ Login successful!")
                    return {
                        'success': True,
                        'data': data.get('data', {}),
                        'message': data.get('message', 'Login successful'),
                        'status_code': response.status_code
                    }
                else:
                    # printf"❌ Login failed: {data.get('message', 'Unknown error')}")
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
