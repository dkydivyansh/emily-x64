import webview
import os
import json
import sys
import winreg
import subprocess
from typing import Dict, Any
import webbrowser  # Add this import
import startup as splash
from login import show_login_window
from startup import close_application,force_close_application
import time
import sqlite3
import re 
from pathlib import Path
import ctypes
from modules.auth import check_status , decrypt_data, refresh_token_hendler,get_reliable_windows_id,get_app_config,get_user_info,logout_session,AI_VOISE,subcription_manage
from modules.secrets import KEY, IV, base_api_uri, api_uris, headers
from modules.command import *
from modules.command import _clean_message
from loader import start_loader, update_loader_text, add_loader_log, force_close_loader
from google import genai
from google.genai import types
from datetime import datetime
from modules.cryptoenc import encrypt_json, decrypt_json

os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = (
    "--auto-accept-camera-and-microphone-capture "
    "--autoplay-policy=no-user-gesture-required "
    "--disable-features=AudioServiceOutOfProcess "
    "--disable-web-security "
    "--allow-file-access-from-files"
)
def show_native_error_box(title, message):
    MB_ICONERROR = 0x10
    MB_TOPMOST = 0x00040000
    style = MB_ICONERROR | MB_TOPMOST
    ctypes.windll.user32.MessageBoxW(0, message, title, style)
    return
def show_success_box(title, message):
    MB_ICONASTERISK = 0x40  # Same as info icon
    MB_TOPMOST = 0x00040000
    style = MB_ICONASTERISK | MB_TOPMOST
    ctypes.windll.user32.MessageBoxW(0, message, title, style)

def show_info_box(title, message):
    MB_ICONINFORMATION = 0x40  # Identical to MB_ICONASTERISK
    MB_TOPMOST = 0x00040000
    style = MB_ICONINFORMATION | MB_TOPMOST
    ctypes.windll.user32.MessageBoxW(0, message, title, style)


def restart_application():
    release_mutex()
    """Forcefully close the application and restart it"""
    # print'Restarting application...')
    
    try:
        # Try to close windows gracefully
        for window in webview.windows:
            try:
                window.destroy()
            except:
                pass
        webview.windows.clear()
    except:
        pass

    # Get path to the current executable (works with PyInstaller)
    executable = sys.executable

    # Re-run the executable in a new process
    try:
        subprocess.Popen([executable] + sys.argv)
    except Exception as e:
        show_native_error_box('error', e)
        # printf"Failed to restart: {e}")

    # Exit current process
    os._exit(0)

appdata_dir = Path(os.getenv('APPDATA') or '') / "dkydivyansh.com"
appdata_dir.mkdir(parents=True, exist_ok=True)

interaction_db_path = appdata_dir / 'interaction_data.dll'
key_db_path = appdata_dir / 'key_data.dll'
webview_path = appdata_dir / 'Emily-X64_webview_data'

app_config_variables = {
    "app_name": "EmilyX64",
    "app_version": "2.2.0.1 Beta",
    "app_version_code": "2201",
    "history_cont": 10,
}





def remove_record(id):
    try:
        conn = sqlite3.connect(key_db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM key WHERE type = ?', (id,))
        conn.commit()
        conn.close()
        return cursor.rowcount  # Number of rows affected
    except sqlite3.Error as e:
        # printf"An error occurred: {e}")
        show_native_error_box('Error', f"An error occurred: {e}")
        force_close_application()
        return -1

def add_record(id, value):
    try:
        conn = sqlite3.connect(key_db_path)
        cursor = conn.cursor()
        # First check if record exists
        cursor.execute('SELECT type FROM key WHERE type = ?', (id,))
        exists = cursor.fetchone()
        
        if exists:
            # Update existing record
            cursor.execute('UPDATE key SET value = ? WHERE type = ?', (value, id))
        else:
            # Insert new record
            cursor.execute('INSERT INTO key (type, value) VALUES (?, ?)', (id, value))
            
        conn.commit()
        conn.close()
    except sqlite3.Error as e:
        # printf"An error occurred: {e}")
        show_native_error_box('Error', f"An error occurred: {e}")
        force_close_application()

def get_value_by_id(id):
    try:
        conn = sqlite3.connect(key_db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM key WHERE type = ?', (id,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None
    except sqlite3.Error as e:
        # printf"An error occurred: {e}")
        show_native_error_box('Error', f"An error occurred: {e}")
        force_close_application()
        return None

def check_session_data():
    try:
        session_token = get_value_by_id('session_token')
        refresh_token = get_value_by_id('refresh_token')
        user_id = get_value_by_id('user_id')
        if session_token == None or refresh_token == None or user_id == None:
            remove_record('session_token')
            remove_record('refresh_token')
            remove_record('user_id')
            # print"Session data not found, showing login window...")
            return False
        else:
            # print"Session data found, Verifying with user ID:", user_id)
            responce  = refresh_token_hendler(api_uris['token_refresh_api'], session_token, user_id , device_id, refresh_token)
            if responce['success']:
                remove_record('session_token')
                remove_record('refresh_token')
                add_record('session_token', responce['data']['session_token'])
                add_record('refresh_token', responce['data']['refresh_token'])
                # print"Session data verified successfully.")
                return True
            else:
                # print"Session data verification failed, showing login window...")
                remove_record('session_token')
                remove_record('refresh_token')
                remove_record('user_id')
                show_info_box('Session Expired', f'Your session has expired. Please login again. \n Reason : {responce["message"]}')
                return False
    except Exception as e:
        # printf"An error occurred while checking session data: {e}")
        show_native_error_box('Error', f"An error occurred while checking session data: {e}")
        force_close_application()

def get_interactions(history_cont,timestamp=False):
    limit = str(history_cont)  # ensure this is a number as string
    conn = sqlite3.connect(interaction_db_path)
    cursor = conn.cursor()
    if timestamp:
        cursor.execute('''
            SELECT role, parts, timestamp
            FROM interactions
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
    else:
        cursor.execute('''
            SELECT role, parts
            FROM interactions 
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
    rows = cursor.fetchall()
    conn.close()

    # Format correctly for Gemini
    if timestamp:
        return [
            {
                "role": role,
                "parts": [{"text": parts}],
                "timestamp": timestamp_val
            }
            for role, parts, timestamp_val in rows
        ]
    else:
        return [
            {
                "role": role,
                "parts": [{"text": parts}]
            }
            for role, parts in rows
        ]

def empty_database():
    conn = sqlite3.connect(interaction_db_path)
    cursor = conn.cursor()
    cursor.execute('''
        DELETE FROM interactions
    ''')
    conn.commit()
    conn.close()


def insert_into_db(role, parts):
    conn = sqlite3.connect(interaction_db_path)
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO interactions (role, parts, timestamp)
    VALUES (?, ?, ?)
    ''', (role, parts, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def setdefolts():
    try:
        # Check if userLang already exists
        existing_lang = get_value_by_id('userLang')
        if existing_lang is None:
            # Only add if it doesn't exist
            add_record('userLang', 'en-IN')
        existing_isvoiseactive = get_value_by_id('isvoiseactive')
        if existing_isvoiseactive is None:
            # Only add if it doesn't exist
            add_record('isvoiseactive', 'True')
        existing_newuser = get_value_by_id('newuser')
        if existing_newuser is None:
            # Only add if it doesn't exist
            add_record('newuser', 'false')
            
    except Exception as e:
        # printf"Error setting defaults: {e}")
        show_native_error_box('Error', f"Error setting defaults: {e}")

def initialize_databases():
    try:
        # Create interaction database if it doesn't exist
        if not interaction_db_path.exists():
            splash.update_splash_text('Creating User Credentials..') 
            conn = sqlite3.connect(interaction_db_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS interactions (
                    ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    parts TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
            ''')
            conn.commit()
            conn.close()

        # Create key database if it doesn't exist
        if not key_db_path.exists():
            splash.update_splash_text('Creating User Data..')
            conn = sqlite3.connect(key_db_path)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS key (
                    type TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL
                )
            ''')
            conn.commit()
            conn.close()
        setdefolts()
        return True, "Data initialized successfully."

    except Exception as e:
        return False, f"Failed to initialize data: {e}"
def get_windows_info():
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                           r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        name = winreg.QueryValueEx(key, "ProductName")[0]
        major = winreg.QueryValueEx(key, "CurrentMajorVersionNumber")[0]
        minor = winreg.QueryValueEx(key, "CurrentMinorVersionNumber")[0] 
        build = winreg.QueryValueEx(key, "CurrentBuildNumber")[0]
        winreg.CloseKey(key)
        
        # Fix Windows 11 detection (build 22000+)
        if int(build) >= 22000:
            if "Windows 10" in name:
                name = name.replace("Windows 10", "Windows 11")
            version = f"11.0.{build}"
        else:
            version = f"{major}.{minor}.{build}"
            
        return f"{name} (Version: {version})"
    
    except:
        # Fallback to platform module
        return f"unknown"
def clean_text_for_tts(text):
    text = text.replace('**', '')
    text = re.sub(r'[^\w\s,.!?\'\":-]', '', text)
    text = text.replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def setup_process():
    time.sleep(2)
    splash.update_splash_text('Booting...')
    time.sleep(0.5)
    splash.update_splash_text('Connecting to server...')
    time.sleep(0.1)
    con_sts, con_msg = check_status(headers, server_sts_url= api_uris['server_sts_url'])
    if con_sts:
        # printf"✅ Server is up: {con_msg}")
        splash.update_splash_text(f"✅ Server is up: {con_msg}")
    else:
        # printf"❌ Server error: {con_msg}")
        splash.update_splash_text(f"❌ Server error: {con_msg}")
        show_native_error_box('Error', f'Server error: {con_msg}')
        splash.close_splash()
        force_close_application()
    time.sleep(0.5)
    splash.update_splash_text('Checking Application Data...')
    database_sts, satabase_sts_msg = initialize_databases()
    if database_sts:
        # printf"✅ {satabase_sts_msg}")
        splash.update_splash_text(f"✅ {satabase_sts_msg}")
    else:
        # printf"❌ {satabase_sts_msg}")
        splash.update_splash_text(f"❌ {satabase_sts_msg}")
        show_native_error_box('Error', f"❌ {satabase_sts_msg}")
        splash.close_splash()
        force_close_application()
    time.sleep(0.1)
    splash.update_splash_text(f'Setting')
    time.sleep(0.5)
    splash.close_splash()




def main_entry():
    time.sleep(2)
    try:
        update_loader_text("Booting up ...")
        global APP_CONFIG
        global SYSTEM_CONFIG
        global genai_client
        APP_CONFIG = {}
        add_loader_log("Checking network connection...", "info")
        con_sts, con_msg = check_status(headers, server_sts_url= api_uris['server_sts_url'])
        if con_sts:
            # printf"✅ Server is up: {con_msg}")
            add_loader_log(f"Server is up: {con_msg}", "success")
        else:
            # printf"❌ Server error: {con_msg}")
            add_loader_log(f"Server error: {con_msg}", "error")
            force_close_application()
            show_native_error_box('Error', f'Server error: {con_msg}')
        session_token = get_value_by_id('session_token')
        user_id = get_value_by_id('user_id')
        update_loader_text("Getting user data...")
        add_loader_log("Getting app config...", "info")
        win_info = get_windows_info()
        app_config_data = get_app_config(api_uris['app_config_api'], session_token, user_id, device_id)
        add_loader_log("Getting User info...", "info")
        user_info_data = get_user_info(api_uris['user_info_api'], session_token, user_id, device_id)
        if app_config_data['success'] and user_info_data['success']:
            # print"✅ Application configuration loaded successfully.")
            # printf"Raw app_config_data received: {app_config_data}")
            # printf"tts_api from raw data: {app_config_data.get('data', {}).get('tts_api')}")
            add_loader_log("Successfuly recived user info.", "success")
            add_loader_log("Requesting app configuration.", "info")
            try:
                SYSTEM_CONFIG = {
                    "APP_LIST" : get_value_by_id('APPLISTDATA')
                }
                APP_CONFIG = {
                "app_name": app_config_variables['app_name'],
                "app_logo": app_config_data['data']['app_logo'],
                "system_instruction": app_config_data['data']['system_instructions'] ,
                "max_message_length": app_config_data['data']['max_message_length'],
                "app_guide": app_config_data['data']['app_guide'],
                "dev_info": app_config_data['data']['dev_info'],
                "extra_css": app_config_data['data']['extra_css'],
                "extra_js": app_config_data['data']['extra_js'],
                "tts_api": app_config_data['data']['tts_api'],
                "user-type": app_config_data['data']['user-type'],
                "userLang": get_value_by_id('userLang'),
                "isvoiseactive" : get_value_by_id('isvoiseactive'),
                "latest_version_info": {
                    "leatest_version": app_config_data['data']['latest_version_info']['leatest_version'],
                    "relese_type": app_config_data['data']['latest_version_info']['relese_type'],
                },
                "current_version": app_config_variables['app_version'],
                "current_version_code": app_config_variables['app_version_code'],
                "devise_id": device_id,
                "windows_info": win_info,
                "allowed_extensions": {
                    "document": [".pdf", ".js", ".py", ".txt", ".html", ".css", ".md", ".csv", ".xml", ".rtf"],
                    "image": [".jpg", ".jpeg", ".png", ".gif"]
                },
                "suggestions": [
                    "Tell me about yourself",
                    "How can you help me?",
                    "What are your capabilities?",
                    "Show me some examples"
                ],
                "user": {
                    "email" : user_info_data['data']['email'],
                    "name": user_info_data['data']['name'],
                    "avatar": user_info_data['data']['profile_photo'],
                    "date_of_birth": user_info_data['data']['date_of_birth'],
                    "gender" : user_info_data['data']['gender'],
                    "memory_data" : user_info_data['data']['memory_data'],
                    "subscription" : user_info_data['data']['subscription'],
                },
                "gemini": {
                    "api_key": app_config_data['data']['api_key'],  # Replace with your actual API key
                    "model": app_config_data['data']['modal'],
                    "model_temp": app_config_data['data']['model_temp'],
                    "max_output_tokens": app_config_data['data']['max_output_tokens']
                }}
                # print"✅ APP_CONFIG initialized successfully.")
                # printSYSTEM_CONFIG)
                # printjson.dumps(APP_CONFIG, indent=2))
                add_loader_log("App configuration loaded successfully.", "success")
                update_loader_text("Initializing Emily client...")
                add_loader_log("Initializing Emily configuration", "info")
                add_loader_log("Checking for updates", "info")
                if int(APP_CONFIG["latest_version_info"]["leatest_version"]) > int(APP_CONFIG["current_version_code"]):
                    add_loader_log("Update available", "error")
                    show_info_box('Update Available', f'A new version of Emily AI is available. Please update to the latest version.')
                    webbrowser.open("https://dkydivyansh.com/emily-ai/")
                    force_close_application()
                else:
                    add_loader_log("No updates available", "success")
                try:
                    genai_client = genai.Client(api_key=APP_CONFIG["gemini"]["api_key"])
                    # print"Gemini API client initialized successfully")
                    add_loader_log("Emily client initialized successfully.", "success")
                    force_close_loader()
                    return
                except Exception as e:
                    genai_client = None
                    # printf"Error initializing Gemini API client: {e}")
                    add_loader_log("Error initializing Gemini API client", "success")
                    show_native_error_box('Error', f"Error initializing AI client: {e}")
                    force_close_application()
            except KeyError as e:
                # printf"❌ Missing key in app config data: {e}")
                show_native_error_box('Error', f"Missing key in app config data: {e}")
                force_close_application()
            except Exception as e:
                # printf"❌ Error initializing APP_CONFIG: {e}")
                show_native_error_box('Error', f"Error initializing APP_CONFIG: {e}")
                force_close_application()
        else:
            # printf"❌ Failed to load application configuration: {app_config_data['message']}")
            show_native_error_box('Error', f"Failed to load application or user configuration: {app_config_data['message']}")
            force_close_application()
    except Exception as e:
        # printf"❌ An error occurred during the main entry process: {e}")
        show_native_error_box('Error', f"An error occurred during the main entry process: {e}")
        force_close_application()



window = None
# Single chat instance for the user
gemini_chat = None
gemini_generate_content = None




# API class for better functionality organization and exposure to JavaScript
class API:
    def toggle_fullscreen(self):
        webview.windows[0].toggle_fullscreen() 

    def finishsetup(self, settings):
        try:
            voice_lang = str(settings['voiceLanguage'])
            ai_speech_enabled = str(settings['aiSpeechEnabled'])
            home_assistant_enabled = settings.get('homeAssistantEnabled', False)
            home_assistant_url = settings.get('homeAssistantUrl', '')
            home_assistant_token = settings.get('homeAssistantToken', '')
            
            # print'saving settings: ' + voice_lang + ', ' + ai_speech_enabled + ', HA: ' + str(home_assistant_enabled))
            
            # Save basic settings
            add_record('userLang', voice_lang)
            add_record('isvoiseactive', ai_speech_enabled)
            add_record('newuser', 'true')  # Mark setup as complete
            
            # Save Home Assistant settings if enabled
            if home_assistant_enabled and home_assistant_url and home_assistant_token:
                ha_data = json.dumps({
                    'url': home_assistant_url,
                    'token': home_assistant_token
                })
                
                add_record('HA_DATA', ha_data)
                add_record('HAEnabled', 'true')
                # print'Home Assistant settings saved')
            else:
                add_record('HAEnabled', 'false')
                # print'Home Assistant disabled')
            
            restart_application()
        except Exception as e:
            # printf"An error occurred while saving data: {e}")
            show_native_error_box('Error', f"An error occurred while saving data: {e}")
            force_close_application()


    # No __init__ or __del__ needed here, as we'll call global functions
    def get_subcription(self,code):
        session_token = get_value_by_id('session_token')
        user_id = get_value_by_id('user_id')
        return subcription_manage(api_uris["subcription_api"], session_token, user_id, device_id,code)
    def apply_subcription(self,code):
        session_token = get_value_by_id('session_token')
        user_id = get_value_by_id('user_id')
        responce = subcription_manage(api_uris["apply_subscription_api"], session_token, user_id, device_id,code)
        if responce['success']:
            restart_application()
            return {"success": True, "message": "Subcription applyed successfully"}
        else:
            return {"success": False, "message": f"Failed to apply subcription: {responce['message']}"}

    def remove_record(self, id):
        """API method to remove a record from the key database, calling the global function."""
        return remove_record(id)

    def add_record(self, id, value):
        """API method to add or update a record in the key database, calling the global function."""
        return add_record(id, value)

    def get_value_by_id(self, id):
        """API method to get a value from the key database by ID, calling the global function."""
        return get_value_by_id(id)

    def close_window(self):
        """
        Simple function to close the window directly
        This matches the approach in the working example
        """
        # print"API close_window called")
        if window:
            window.destroy()
            return {"success": True, "message": "Window closed successfully"}
        return {"success": False, "message": "Window not found"}
    
    def clear_history_and_restart(self):
        """Clear chat history and restart the application"""
        try:
            # Call empty_database function (to be implemented)
            empty_database()
            time.sleep(3)
            restart_application()
            return {"success": True, "message": "History cleared successfully"}

        except Exception as e:
            # printf"Error clearing history: {e}")
            return {"success": False, "message": str(e)}
        
    def save_app_data(self,data):
        try:
            add_record('APPLISTDATA', data)
            restart_application()
            return {"success": True, "message": "saved successfully"}
        except Exception as e:
            # printf"Error saving app data: {e}")
            return {"success": False, "message": str(e)}
    
    def save_ha_data(self,data,sts):
        try:
            add_record('HA_DATA', data)
            add_record('HAEnabled', str(sts))
            # printf"HA data: {data}")
            # printf"HA enabled: {sts}")
            restart_application()
            return {"success": True, "message": "saved successfully"}
        except Exception as e:
            # printf"Error saving HA data: {e}")
            return {"success": False, "message": str(e)}
        
    def get_app_data(self):
        return get_value_by_id('APPLISTDATA')

    def get_ha_data(self):
        """Get Home Assistant data"""
        ha_data = get_value_by_id('HA_DATA')
        ha_enabled_raw = get_value_by_id('HAEnabled')
        
        # Convert ha_enabled to proper boolean
        ha_enabled = False
        if ha_enabled_raw is not None:
            if isinstance(ha_enabled_raw, str):
                ha_enabled = ha_enabled_raw.lower() in ['true', '1', 'yes']
            elif isinstance(ha_enabled_raw, (int, float)):
                ha_enabled = bool(ha_enabled_raw)
            else:
                ha_enabled = bool(ha_enabled_raw)
        
        # printf"HA data: {ha_data}")
        # printf"HA enabled raw: {ha_enabled_raw}, converted: {ha_enabled}")
        return {
            "ha_data": ha_data,
            "ha_enabled": ha_enabled
        }

    def backup_data(self):
        """Backup user data to a file"""
        try:
            user_chat_history = get_interactions(50, timestamp=True)
            if not user_chat_history:
                return {"success": False, "message": "No chat history found to backup."}
            else:
                backup_data = {
                    "user_chat_history": user_chat_history,
                }
                UUID = get_value_by_id('user_id')
                # Convert UUID to string if it's not already
                UUID_str = str(UUID)
                # print"uuid "+UUID_str)
                enc_data = encrypt_json(backup_data, UUID_str, KEY, IV)
                if enc_data['success']:
                    return {
                        "success": True,
                        "message": "Data backed up successfully",
                        "data": enc_data['data']
                    }
                else:
                    # printf"Error encrypting data: {enc_data['error']}")
                    return {"success": False, "message": enc_data['error']}
        except Exception as e:
            # printf"Error backing up data: {e}")
            return {"success": False, "message": str(e)}

    def restore_data(self, file_path: str):
        """Restore user data from a backup file"""
        # printf"restore_data called with file_path: {file_path}")
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                # printf"File not found: {file_path}")
                return {"success": False, "message": "Backup file not found."}
            
            # Check if file has correct extension
            if not file_path.endswith('.emily_bp'):
                # printf"Invalid file extension: {file_path}")
                return {"success": False, "message": "Invalid backup file format. File must have .emily_bp extension."}
            
            # printf"File exists and has correct extension, reading file...")
            # Read the encrypted data from file
            with open(file_path, 'r') as f:
                encrypted_data = f.read().strip()
            
            # printf"Read {len(encrypted_data)} characters from file")
            
            if not encrypted_data:
                return {"success": False, "message": "Backup file is empty."}
            
            # Get current user ID for decryption
            UUID = get_value_by_id('user_id')
            if not UUID:
                return {"success": False, "message": "User session not found. Please login first."}
            
            UUID_str = str(UUID)
            # printf"Attempting to decrypt backup with user ID: {UUID_str}")
            
            # Decrypt the data
            dec_data = decrypt_json(encrypted_data, UUID_str, KEY, IV)
            if not dec_data['success']:
                return {"success": False, "message": f"This backup file does not belong to your current account. Backup files are encrypted with account-specific credentials and can only be restored to the same account they were created with. Error: {dec_data['error']}"}
            
            # Extract the backup data
            backup_data = dec_data['data']
            user_chat_history = backup_data.get('user_chat_history', [])
            
            if not user_chat_history:
                return {"success": False, "message": "No chat history found in backup file."}
            
            # Clear existing database
            empty_database()
            
            # Restore chat history
            restored_count = 0
            for interaction in user_chat_history:
                try:
                    role = interaction.get('role')
                    parts = interaction.get('parts', [{}])[0].get('text', '')
                    timestamp = interaction.get('timestamp', datetime.now().isoformat())
                    
                    if role and parts:
                        insert_into_db(role, parts)
                        restored_count += 1
                except Exception as e:
                    # printf"Error restoring interaction: {e}")
                    continue
            
            if restored_count > 0:
                return {
                    "success": True, 
                    "message": f"Successfully restored {restored_count} chat interactions.",
                    "restored_count": restored_count
                }
            else:
                return {"success": False, "message": "No valid chat interactions found in backup."}
                
        except Exception as e:
            # printf"Error restoring data: {e}")
            return {"success": False, "message": f"Error restoring data: {str(e)}"}

    def open_restore_file_dialog(self):
        """Opens a file dialog specifically for selecting backup files"""
        try:
            if window:
                # print"Opening restore file dialog")
                # printf"Window object: {window}")
                # printf"Window type: {type(window)}")
                
                # Try different file_types formats
                result = None
                try:
                    result = window.create_file_dialog(
                        webview.OPEN_DIALOG,
                        allow_multiple=False,
                        file_types=('Emily Backup Files (*.emily_bp)',)
                    )
                except Exception as format_error:
                    # printf"Error with tuple format: {format_error}")
                    # Try list format
                    try:
                        result = window.create_file_dialog(
                            webview.OPEN_DIALOG,
                            allow_multiple=False,
                            file_types=[('Emily Backup Files (*.emily_bp)', '*.emily_bp')]
                        )
                    except Exception as list_error:
                        # printf"Error with list format: {list_error}")
                        # Try without file_types
                        try:
                            result = window.create_file_dialog(
                                webview.OPEN_DIALOG,
                                allow_multiple=False
                            )
                        except Exception as no_filter_error:
                            # printf"Error without file_types: {no_filter_error}")
                            # Last resort - try minimal parameters
                            try:
                                result = window.create_file_dialog(webview.OPEN_DIALOG)
                            except Exception as minimal_error:
                                # printf"Error with minimal parameters: {minimal_error}")
                                result = None

                # printf"File dialog result: {result}")
                # printf"Result type: {type(result)}")

                if result:
                    # Handle both list and tuple results
                    if isinstance(result, (list, tuple)) and len(result) > 0:
                        selected_path = result[0].replace('\\', '\\\\')
                        # printf"Restore file dialog selected: {selected_path}")
                        # Send the selected path back to JavaScript
                        window.evaluate_js(f"handleRestoreFileSelect('{selected_path}')")
                    elif isinstance(result, str):
                        # Single string result
                        selected_path = result.replace('\\', '\\\\')
                        # printf"Restore file dialog selected: {selected_path}")
                        window.evaluate_js(f"handleRestoreFileSelect('{selected_path}')")
                    else:
                        # printf"Unexpected result format: {type(result)}")
                        window.evaluate_js("handleRestoreFileSelect(null)")
                else:
                    # print"Restore file dialog cancelled or no file selected.")
                    window.evaluate_js("handleRestoreFileSelect(null)")
            else:
                # print"Error: Window object not found for opening restore file dialog.")
                if window:
                    window.evaluate_js("handleRestoreFileSelect(null)")

        except Exception as e:
            # printf"Error opening restore file dialog: {e}")
            if window:
                window.evaluate_js("handleRestoreFileSelect(null)")

    def clear_session_close(self):
        """Clear session data and close the application"""
        session_token = get_value_by_id('session_token')
        user_id = get_value_by_id('user_id')
        result = logout_session(api_uris['app_config_api'], session_token, user_id, device_id)
        if result['success']:
            try:
                # Remove session data from database
                self.remove_record('session_token')
                self.remove_record('refresh_token')
                self.remove_record('user_id')
                self.remove_record('newuser')
                self.remove_record('HA_DATA')
                self.remove_record('HAEnabled')
                empty_database()
                time.sleep(3)
                restart_application()
                return {"success": True, "message": "Session cleared successfully"}
            except Exception as e:
                # printf"Error clearing session: {e}")
                return {"success": False, "message": str(e)}
        else:
            return {"success": False, "message": f"Failed to clear session: {result['message']}"}

    def get_chat_history(self):
        """Get chat history for display in frontend"""
        try:
            history = get_interactions(50, timestamp=True)  # Get last 50 interactions with timestamps
            
            # Clean each message in the history
            cleaned_history = []
            for interaction in history:
                cleaned_interaction = interaction.copy()
                # Clean the parts text (remove @cmd[...] blocks)
                if 'parts' in cleaned_interaction and len(cleaned_interaction['parts']) > 0:
                    cleaned_interaction['parts'][0]['text'] = _clean_message(cleaned_interaction['parts'][0]['text'])
                cleaned_history.append(cleaned_interaction)
            
            return {"success": True, "history": cleaned_history}
        except Exception as e:
            # printf"Error getting chat history: {e}")
            return {"success": False, "message": str(e)}
    def generate_responce(self, message_data_json: str) -> None:
        """
        Receives message data from the frontend, processes it,
        and sends a response back using Gemini API if available.
        """
        try:
            message_data = json.loads(message_data_json)
            user_message = message_data.get('text', '') 
            # print"--------------------")
            error_message = "I encountered an error processing your request."
            tools = [
                types.Tool(google_search=types.GoogleSearch()),
                types.Tool(url_context=types.UrlContext()),
            ]
            genai_config_content = types.GenerateContentConfig(
                system_instruction=APP_CONFIG["system_instruction"],
                tools=tools,
                response_mime_type="text/plain",
                max_output_tokens=APP_CONFIG["gemini"]["max_output_tokens"],
                temperature=APP_CONFIG["gemini"]["model_temp"]
            )
            response = genai_client.models.generate_content(
                model=APP_CONFIG["gemini"]["model"],
                contents=user_message,
                config=genai_config_content
            )
            return {"success": True, "response": response.text}
        except Exception as e:
            # printf"Error generating response: {e}")
            return {"success": False, "message": str(e)}
    
    def quick_commands(self, response_text):
        
        # Define command list for meta=list_commands
        Command_list = """Available Commands:
        
1. App Opening: 
   - Emily can open app's based on the user's request.
   - needs to be enabled in the settings.

2. URL Opening:
   - Opens URLs in default browser
   - it can open websites based on the user's request.

3. Home Assistant Control:
   - Controls Home Assistant devices
   - needs to be enabled in the settings.

4. System Commands:
   - Clear chat history
   - Exit application
   - Enable voice mode
   - Disable voice mode
   - Show this command list
5. Other Commands:
    - Get live time
    - live information from internet

"""
        
        runs = []
        
        # Check for meta=list_apps command
        if '@cmd[meta=list_apps]' in response_text:
            if gemini_chat:
                                    applistmain = [(a["name"], a["code"]) for a in (__import__("json").loads(SYSTEM_CONFIG["APP_LIST"])["apps"] if SYSTEM_CONFIG.get("APP_LIST") else [])] or None
                                    gemini_chat.send_message(f"list of apps that can be opened by you and their codes. \n {applistmain}")
                                    app_list_text = "**Supported Apps:**\n"
                                    if applistmain:
                                        for name, code in applistmain:
                                            app_list_text += f"• **{name}**\n"
                                    else:
                                        app_list_text += "No apps configured."
                                    response_text = response_text.replace('@cmd[meta=list_apps]', app_list_text)
                                    # print"[Quick Commands] App list inserted into response")
        
        # Check for clear_data command
        if '@cmd[action=clear_data]' in response_text:
            if window:
                window.evaluate_js('confirmClearHistory()')
            # print"[Quick Commands] Clear data command detected and executed")
            runs.append({"action": "clear_data"})
        
        # Check for Exit command
        if '@cmd[action=Exit]' in response_text:
            # print"[Quick Commands] Exit command detected")
            runs.append({"action": "Exit"})
            force_close_application()
        
        # Check for meta=list_commands
        if '@cmd[meta=list_commands]' in response_text:
            # print"[Quick Commands] Found meta=list_commands command")
            response_text = response_text.replace('@cmd[meta=list_commands]', Command_list)
            # print"[Quick Commands] Command list inserted")
            # printf"[Quick Commands] Response after replacement: {response_text[:200]}...")
        
        # Check for speech_on command
        if '@cmd[config=speech_on]' in response_text:
            if window:
                window.evaluate_js('''
                    const voiceButton = document.getElementById('voice-button');
                    if (voiceButton && !isVoiceMode) {
                        voiceButton.click();
                    }
                ''')
            # print"[Quick Commands] Speech on command detected and executed")
            runs.append({"config": "speech_on"})
        
        # Check for speech_off command
        if '@cmd[config=speech_off]' in response_text:
            if window:
                window.evaluate_js('''
                    const voiceButton = document.getElementById('voice-button');
                    if (voiceButton && isVoiceMode) {
                        voiceButton.click();
                    }
                ''')
            # print"[Quick Commands] Speech off command detected and executed")
            runs.append({"config": "speech_off"})
        
        return response_text, runs


    def send_message_to_backend(self, message_data_json: str, isvoiseactive: bool) -> None:
        """
        Receives message data from the frontend, processes it,
        and sends a response back using Gemini API if available.
        """
        try:
            message_data = json.loads(message_data_json)
            user_message = message_data.get('text', '')
            files_info = message_data.get('files', [])

            # print"--------------------")
            # printf"Received message: {user_message}")
            # printf"Number of files: {len(files_info)}")
            
            # Default error message if things go wrong
            error_message = "I encountered an error processing your request."

            # Generate response using Gemini API if available
            if genai_client:
                try:
                    # Handle file uploads if present
                    uploaded_files = []
                    if files_info:
                        for file_info in files_info:
                            try:
                                # Send initial upload status
                                if window:
                                    window.evaluate_js(f'''
                                        showFileUploadStatus(
                                            "{file_info['name']}", 
                                            "uploading"
                                        )
                                    ''')
                                
                                # Decode base64 data
                                import base64
                                import io
                                file_data = base64.b64decode(file_info['data'].split(',')[1])
                                
                                # Create a BytesIO object
                                file_buffer = io.BytesIO(file_data)
                                
                                # Determine MIME type based on file extension
                                mime_type = None
                                file_extension = file_info['name'].split('.')[-1].lower()
                                
                                # Map file extensions to MIME types
                                mime_type_map = {
                                    'pdf': 'application/pdf',
                                    'js': 'application/x-javascript',
                                    'py': 'application/x-python',
                                    'txt': 'text/plain',
                                    'html': 'text/html',
                                    'css': 'text/css',
                                    'md': 'text/markdown',
                                    'csv': 'text/csv',
                                    'xml': 'text/xml',
                                    'rtf': 'application/rtf',
                                    'jpg': 'image/jpeg',
                                    'jpeg': 'image/jpeg',
                                    'png': 'image/png',
                                    'gif': 'image/gif'
                                }
                                
                                mime_type = mime_type_map.get(file_extension)
                                
                                if mime_type:
                                    # printf"Uploading file: {file_info['name']} with MIME type: {mime_type}")
                                    
                                    uploaded_file = genai_client.files.upload(
                                        file=file_buffer,
                                        config=dict(mime_type=mime_type)
                                    )
                                    uploaded_files.append(uploaded_file)
                                    # printf"File {file_info['name']} uploaded successfully")
                                    
                                    if window:
                                        window.evaluate_js(f'''
                                            showFileUploadStatus(
                                                "{file_info['name']}", 
                                                "success"
                                            )
                                        ''')
                                else:
                                    error_msg = f"Unsupported file type: {file_extension}"
                                    # printerror_msg)
                                    
                                    # Send error status
                                    if window:
                                        window.evaluate_js(f'''
                                            showFileUploadStatus(
                                                "{file_info['name']}", 
                                                "error",
                                                "{error_msg}"
                                            )
                                        ''')
                                    raise ValueError(error_msg)
                                    
                            except Exception as e:
                                error_msg = str(e)
                                # printf"Error uploading file {file_info['name']}: {error_msg}")
                                
                                # Send error status
                                if window:
                                    window.evaluate_js(f'''
                                        showFileUploadStatus(
                                            "{file_info['name']}", 
                                            "error",
                                            "{error_msg}"
                                        )
                                    ''')
                                raise

                    # Generate response using the appropriate method
                    global gemini_chat
                    homeassistent_raw = get_value_by_id('HAEnabled')
                    
                    # Convert homeassistent to proper boolean
                    homeassistent = False
                    if homeassistent_raw is not None:
                        if isinstance(homeassistent_raw, str):
                            homeassistent = homeassistent_raw.lower() in ['true', '1', 'yes']
                        elif isinstance(homeassistent_raw, (int, float)):
                            homeassistent = bool(homeassistent_raw)
                        else:
                            homeassistent = bool(homeassistent_raw)
                    
                    if gemini_chat is None:
                            tools = [
                                types.Tool(google_search=types.GoogleSearch()),
                                types.Tool(url_context=types.UrlContext()),
                            ]
                            gemini_chat = genai_client.chats.create(
                                model=APP_CONFIG["gemini"]["model"],
                                config=types.GenerateContentConfig(system_instruction=APP_CONFIG["system_instruction"],tools=tools,response_mime_type="text/plain",max_output_tokens=APP_CONFIG["gemini"]["max_output_tokens"],temperature=APP_CONFIG["gemini"]["model_temp"]),
                                history=get_interactions(25),
                            )
                            applistmain = [(a["name"], a["code"]) for a in (__import__("json").loads(SYSTEM_CONFIG["APP_LIST"])["apps"] if SYSTEM_CONFIG.get("APP_LIST") else [])] or None
                            if homeassistent:
                                # Get actual HA data for commands
                                ha_data_raw = get_value_by_id('HA_DATA')
                                if ha_data_raw:
                                    try:
                                        ha_data = json.loads(ha_data_raw)
                                        command = generate_home_assistant_commands(ha_data.get('url', 'http://localhost:8123'), ha_data.get('token', ''))
                                    except:
                                        command = "home assistant commands are not available (invalid configuration)"
                                else:
                                    command = "home assistant commands are not available (no configuration)"
                            else:
                                command = "home assistant commands are not available"
                            setup_message = f"::SYSTEM2D2F4G5S3D:: No need to reply on this message. this is a system message, it contains the user and system information. \n User's name is {APP_CONFIG['user']['name']}\nlist of apps that can be opened by you and their codes. \n {applistmain}\n These are the avalable home assistant commands to control devises: \n {command}"
                            gemini_chat.send_message(setup_message)
                            # printf"\n\nsetup message is : \n {setup_message}")
                    if uploaded_files:
                        # print"Using generate_content for file processing")
                        contents = []
                    
                        for file in uploaded_files:
                            contents.append(file)
                        contents.append("Analyze the files and provide detailed description of the content.")
                            
                        # printf"Sending request to Gemini API with {len(contents)} contents")
                        tools = [
                            types.Tool(google_search=types.GoogleSearch()),
                            types.Tool(url_context=types.UrlContext()),
                        ]
                        genai_config = types.GenerateContentConfig(system_instruction=APP_CONFIG["system_instruction"],tools=tools,response_mime_type="text/plain",max_output_tokens=APP_CONFIG["gemini"]["max_output_tokens"],temperature=APP_CONFIG["gemini"]["model_temp"])
                        response = genai_client.models.generate_content(
                            model=APP_CONFIG["gemini"]["model"],
                            contents=contents,
                            config=genai_config
                        )
                        response_text = response.text
                        response = gemini_chat.send_message(f"::SYSTEM2D2F4G5S3D:: reply based on the file analysis and user message [File Analysis - {response_text} ] {user_message if user_message else 'User message: What are these files about?'}")
                        response_text = response.text
                    else:
                        # print"Using chat for text-only message")
                        # Create chat if it doesn't exist
                        # Send message and get response
                        response = gemini_chat.send_message(user_message)
                        # printresponse.json())
                        response_text = response.text
                    
                    
                    # printf"\n\nbefore commands check Response from Gemini API: {response_text}\n\n")


                    try:
                        app_list_data = SYSTEM_CONFIG.get("APP_LIST")
                        if not app_list_data:
                            app_list_data = "{\"apps\": []}"
                        
                        # Get HA data for commands_check
                        ha_token = None
                        ha_url = None
                        if homeassistent:
                            ha_data_raw = get_value_by_id('HA_DATA')
                            if ha_data_raw:
                                try:
                                    ha_data = json.loads(ha_data_raw)
                                    ha_token = ha_data.get('token')
                                    ha_url = ha_data.get('url')
                                except:
                                    show_native_error_box('error', "Failed to parse HA data for commands_check")
                                    # print"Failed to parse HA data for commands_check")
                        
                        if response_text:
                            # Store original response with commands for database
                            original_response_with_commands = response_text
                            
                            response_text, quick_runs = self.quick_commands(response_text)
                            response_text, cmd_runs = commands_check(response_text, {"APP_LIST": app_list_data}, ha_token, ha_url)
                            
                            
                            # Combine runs from both quick_commands and commands_check
                            all_runs = quick_runs + cmd_runs
                            
                            # Remove all @cmd[...] blocks for frontend display
                            clean_response_for_frontend = _clean_message(response_text)
                            
                            # Include runs information with app names instead of codes for frontend display
                            if all_runs:
                                # Parse app_list_data to create a mapping of codes to names
                                app_mapping = {}
                                try:
                                    app_data = json.loads(app_list_data)
                                    for app in app_data.get("apps", []):
                                        app_mapping[app["code"]] = app["name"]
                                except:
                                    pass
                                
                                # Create markdown formatted runs
                                runs_markdown = []
                                for run in all_runs:
                                    if run.get('type') == 'open' and 'app' in run:
                                        app_codes = run['app'].split('|')
                                        app_names = []
                                        for code in app_codes:
                                            app_names.append(app_mapping.get(code.strip(), code.strip()))
                                        runs_markdown.append(f"* **Opened App**: {', '.join(app_names)}")
                                    elif run.get('type') == 'link' and 'url' in run:
                                        urls = run['url']
                                        if urls.startswith('{') and urls.endswith('}'):
                                            # Handle multiple URLs
                                            url_list = [u.strip(" '\"") for u in urls[1:-1].split(",") if u.strip()]
                                            for url in url_list:
                                                runs_markdown.append(f"* **Opened Link**: [{url}]({url})")
                                        else:
                                            runs_markdown.append(f"* **Opened Link**: [{urls}]({urls})")
                                    elif run.get('type') == 'home':
                                        entity = run.get('entity', '')
                                        action = run.get('action', '')
                                        runs_markdown.append(f"* **Home Assistant**: {action} on {entity}")
                                    elif run.get('action') == 'clear_data':
                                        runs_markdown.append("* **Clear Data**: Chat history cleared")
                                    elif run.get('action') == 'Exit':
                                        runs_markdown.append("* **Exit**: Application closed")
                                    elif run.get('config') == 'speech_on':
                                        runs_markdown.append("* **Voice Mode**: Enabled")
                                    elif run.get('config') == 'speech_off':
                                        runs_markdown.append("* **Voice Mode**: Disabled")
                                    elif run.get('meta') == 'list_commands':
                                        runs_markdown.append("* **Meta**: Command list displayed")
                                    else:
                                        runs_markdown.append(f"* **Command**: {run}")
                                
                                # Add runs to clean response for frontend display
                                clean_response_for_frontend += f"\n\n---\n\n## **Commands Results:**\n\n" + "\n".join(runs_markdown)
                        else:
                            response_text = ""
                            original_response_with_commands = ""
                            clean_response_for_frontend = ""
                            runs = []
                    
                    except Exception as e:
                        # printf"An error occurred while processing Commands: {e}")
                        show_native_error_box('Error', f"An error occurred while processing Commands: {e}")

                        force_close_application()

                    # printf"Response from Gemini API: {response_text[:100]}...")
                    # Save original response with commands to database
                    insert_into_db("model", original_response_with_commands)
                    insert_into_db("user", user_message)
                    try:
                        if APP_CONFIG["user-type"] == "pro" and isvoiseactive:
                            if len(clean_response_for_frontend) < 4900:
                               # printf"TTS API Key: {APP_CONFIG.get("tts_api", "N/A")[:5]}...") # Print first 5 chars of API key
                               # printf"TTS API URL: {api_uris.get("app_voise_api", "N/A")}")
                               voise_data = AI_VOISE(clean_text_for_tts(clean_response_for_frontend), api_uris["app_voise_api"],APP_CONFIG["tts_api"])
                            else:
                                voise_data = AI_VOISE("Sorry, the response is too long to read please view chat window.", api_uris["app_voise_api"],APP_CONFIG["tts_api"])
                            if voise_data['success']:
                                try:
                                    voise_uri = voise_data['data']['OutputUri']
                                    # Send clean message to frontend with audio URI
                                    reply = {
                                        "sender": "Emily AI",
                                        "text": clean_response_for_frontend,
                                        'voise_uri': voise_uri,
                                        "isUser": False
                                    }
                                    if window:
                                        window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
                                except KeyError:
                                    voise_uri = None
                                    reply = {
                                        "sender": "Emily AI",
                                        "text": clean_response_for_frontend,
                                        "isUser": False
                                    }
                                    if window:
                                        window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
                            else:
                                # printf"Error generating TTS data: {voise_data['message']}")
                                reply = {
                                    "sender": "Emily AI",
                                    "text": clean_response_for_frontend,
                                    "isUser": False
                                }
                                if window:
                                    window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
                        else:
                            reply = {
                                "sender": "Emily AI",
                                "text": clean_response_for_frontend,
                                "isUser": False
                            }
                            if window:
                                window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
                    except Exception as e:
                        # printf"Error generating TTS data: {e}")
                        reply = {
                            "sender": "Emily AI",
                            "text": f"Error generating TTS data: {e}",
                            "isUser": False
                        }
                        if window:
                            window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
                    
                except Exception as e:
                    # printf"Error calling Gemini API: {e}")
                    # Fallback response in case of API error
                    reply = {
                        "sender": "Emily AI",
                        "text": f"{error_message} Error details: {str(e)}",
                        "isUser": False
                    }
                    if window:
                        window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')
            else:
                # Fallback response if Gemini API is not available
                if not user_message and not files_info:
                    error_details = "empty message and no files"
                elif not genai_client:
                    error_details = "Gemini client not initialized"
                else:
                    error_details = "unknown reason"
                
                fallback_msg = f"I've received your message but couldn't process it ({error_details}). Please ensure Google Generative AI is installed and configured correctly."
                
                reply = {
                    "sender": "Emily AI",
                    "text": fallback_msg,
                    "isUser": False
                }
                
                if window:
                    window.evaluate_js(f'addMessageToChat({json.dumps(reply)})')

        except json.JSONDecodeError:
            show_native_error_box('error', "Error: Received invalid JSON data from frontend.")
            # print"Error: Received invalid JSON data from frontend.")
        except Exception as e:
            show_native_error_box('error', f"Error processing message: {e}")
            # printf"Error processing message: {e}")

    def open_file_dialog(self, file_type: str = None) -> None:
        """
        Opens a native file dialog for selecting files.
        Filters files based on the specified type.
        """
        # printf"Opening file dialog for type: {file_type}")
        try:
            # Default to document if no type specified
            file_type = file_type if file_type else "document"
            
            # Get allowed extensions for the selected type
            allowed_extensions = APP_CONFIG["allowed_extensions"].get(file_type, [])
            
            # Create file_types list for dialog
            file_types = []
            if allowed_extensions:
                display_name = f"{file_type.capitalize()} files"
                # Create proper format for each OS
                if os.name == 'nt':  # Windows
                    # Combine all extensions into a single filter
                    extensions = ';'.join(f"*{ext}" for ext in allowed_extensions)
                    file_types = [(display_name, extensions)]
                else:  # macOS, Linux
                    # For non-Windows, create a single filter with all extensions
                    extensions = ';'.join(f"*{ext}" for ext in allowed_extensions)
                    file_types = [(display_name, extensions)]
            
            # Always add All Files option
            file_types.append(('All files', '*.*'))

            if window:
                # printf"Calling create_file_dialog with file_types: {file_types}")
                result = window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    allow_multiple=False,
                    file_types=file_types
                )

                if result and isinstance(result, list) and len(result) > 0:
                    selected_path = result[0].replace('\\', '\\\\')
                    # printf"Native file dialog selected: {selected_path}")
                    # Send the selected path and type back to JavaScript
                    window.evaluate_js(f"handleNativeFileSelect('{selected_path}', '{file_type}')")
                else:
                    # print"Native file dialog cancelled or no file selected.")
                    window.evaluate_js("handleNativeFileSelect(null, null)")
            else:
                # print"Error: Window object not found for opening file dialog.")
                window.evaluate_js("handleNativeFileSelect(null, null)")

        except Exception as e:
            # printf"Error opening file dialog: {e}")
            if window:
                window.evaluate_js("handleNativeFileSelect(null, null)")

    def file_upload(self, file_type=None):
        """
        Alternative method for file uploading - simpler approach
        """
        return self.open_file_dialog(file_type)

    def get_config(self) -> Dict:
        """Returns the application configuration"""
        # print"Config requested from frontend")
        # Don't send API key to frontend for security
        config_copy = APP_CONFIG.copy()
        if "gemini" in config_copy:
            if "api_key" in config_copy["gemini"]:
                config_copy["gemini"]["api_key"] = "API_KEY_HIDDEN"
        
        # newuser status is now handled in on_loaded for initial setup
        
        # printf"Sending config: {json.dumps(config_copy, indent=2)}")
        return config_copy

    def get_user_info(self):
        """Returns only user information"""
        # print"User info requested")
        return APP_CONFIG.get("user", {"name": "User", "avatar": ""})

    def echo(self, message):
        """Simple echo function to test API functionality"""
        # printf"Echo called with: {message}")
        return f"Echo: {message}"
    

    def open_url(self, url: str) -> Dict[str, Any]:
        """
        Opens a URL in the default web browser
        
        Args:
            url: The URL to open
            
        Returns:
            Dictionary with success status and message
        """
        try:
            webbrowser.open(url)
            return {
                "success": True,
                "message": f"Opened URL: {url}"
            }
        except Exception as e:
            # printf"Error opening URL: {e}")
            return {
                "success": False,
                "message": f"Error opening URL: {str(e)}"
            }
        
    def append(self, category, value):
        if category not in self.memory or not isinstance(self.memory[category], list):
            self.memory[category] = []
        self.memory[category].append(value)
        self._save()

    def save_file(self, filename, data):
        """Save backup data to a file"""
        try:
            # Use the global window instance for file dialog
            file_path = window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory='',
                save_filename=filename,
                file_types=('Backup Files (*.emily_bp)',)
            )
            
            if file_path:
                # Ensure the file has .backup extension
                if not file_path.endswith('.emily_bp'):
                    file_path += '.emily_bp'
                
                # Write the data to the file
                with open(file_path, 'w') as f:
                    f.write(data)
                
                return {
                    "success": True,
                    "message": "Backup saved successfully",
                    "file_path": file_path
                }
            else:
                return {
                    "success": False,
                    "message": "Save operation cancelled by user"
                }
                
        except Exception as e:
            # printf"Error saving backup file: {e}")
            return {
                "success": False,
                "message": str(e)
            }

    def launch_hidden(self, exe, args=None):
        try:
            result = launch_hidden(exe, args)
            return result
        except Exception as e:
            # printf"Error launching app: {e}")
            return False

    def restart_application(self):
        """Restart the application"""
        try:
            # print"Restarting application from API call...")
            restart_application()
            return {"success": True, "message": "Application restarting..."}
        except Exception as e:
            # printf"Error restarting application: {e}")
            return {"success": False, "message": f"Error restarting application: {str(e)}"}

def main():
    global window
    # Print Python version and platform info for debugging
    # printf"Python version: {sys.version}")
    # printf"Platform: {sys.platform}")
    
    # Initialize the API instance
    api_instance = API()
    
    # Create window with HTML file
    # print"Creating PyWebView window...")
    window = webview.create_window(
        APP_CONFIG["app_name"]+ " - " + app_config_variables['app_version'],
        os.path.join(getattr(sys, '_MEIPASS', os.path.abspath(".")), 'frontend/gui.html'),
        js_api=api_instance,
        width=1200,
        height=800,
        resizable=True,
        confirm_close=True,
        min_size=(1200, 800),  # Minimum window size=
    )
    
    # Initialize app config as soon as window is created
    def on_loaded():
        # print"Window loaded, verifying API...")
        
        # Serialize the APP_CONFIG to JSON (remove API key for security)
        config_copy = APP_CONFIG.copy()

        # --- Explicitly set newuser status to prevent race conditions ---
        config_copy['newuser'] = get_value_by_id('newuser') or 'false'

        if "gemini" in config_copy:
            if "api_key" in config_copy["gemini"]:
                config_copy["gemini"]["api_key"] = "API_KEY_HIDDEN"
        
        app_config_json = json.dumps(config_copy)
        # Also use the modified config_copy for user info
        user_info_json = json.dumps(config_copy.get("user", {}))
        
        # Create directly accessible global functions
        window.evaluate_js(f"""
            // Store configuration directly in JavaScript
            window.APP_CONFIG = {app_config_json};
            window.USER_INFO = {user_info_json};
            
            // Add direct window destroy method
            window.destroyWindow = function() {{
                console.log('Calling window destroy function');
                
                // Call the simple close_window function that directly maps to the Python API
                if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_window === 'function') {{
                    console.log('Using pywebview.api.close_window');
                    return window.pywebview.api.close_window();
                }}
                
                // Fallback - try window.close()
                console.log('Using window.close fallback');
                window.close();
                return {{ success: false, message: "Used window.close fallback" }};
            }};
            
            // Log that destroyWindow function has been created
            console.log('window.destroyWindow function created:', typeof window.destroyWindow === 'function');
            
            // Initialize app with config immediately
            if (typeof initializeApp === 'function') {{
                initializeApp(window.APP_CONFIG);
                
                // Set user profile
                const profileNameElement = document.getElementById('profile-name');
                const profileAvatarElement = document.getElementById('profile-avatar');
                
                if (profileNameElement && window.USER_INFO.name) {{
                    profileNameElement.textContent = window.USER_INFO.name;
                }}
                
                if (profileAvatarElement && window.USER_INFO.avatar) {{
                    profileAvatarElement.src = window.USER_INFO.avatar;
                }}
            }}
        """)
    
    window.events.loaded += on_loaded

    # Start the application
    # print"Starting pywebview event loop")

    #webview.start(debug=True)
    webview.start(gui='edgechromium',private_mode=False,storage_path=str(webview_path))
def main_check():
    sessionval_sts = check_session_data()
    if sessionval_sts:
        # print"Session data is valid, proceeding to main entry.")
        start_loader(main_entry, app_config_variables["app_version"])
        main()  
    else:
        # print"❌ Session data is invalid or not found, showing login window.")
        result = show_login_window(api_uris['login_api'], device_id)
        if result and result.get('success'):
            # print"Login successful!", result['data'])
            add_record('session_token', result['data']['session_token'])
            add_record('refresh_token', result['data']['refresh_token'])
            add_record('user_id', result['data']['user_id'])
            # print"Session data saved successfully.")
            show_success_box('Login Successful', 'You have successfully logged in. Restarting Application...')
            startup()
        else:
            # print"Login failed:", result.get('message'))
            show_native_error_box('Login Failed', 'closing Application - ' + result.get('message', 'Unknown error occurred during login.'))
            force_close_application()
def check_single_instance(mutex_name="Global\\EmilyAI"):
    global mutex_handle
    # Create the named mutex
    mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, False, mutex_name)
    
    # ERROR_ALREADY_EXISTS = 183
    if ctypes.windll.kernel32.GetLastError() == 183:
        show_native_error_box("Error", "Another instance of Emily AI is already running...")
        force_close_application()
def release_mutex():
    global mutex_handle
    if mutex_handle:
        # Release the mutex
        ctypes.windll.kernel32.ReleaseMutex(mutex_handle)
        # Close the handle
        ctypes.windll.kernel32.CloseHandle(mutex_handle)
        mutex_handle = None

def startup():
    global device_id
    device_id = get_reliable_windows_id()
    if device_id is None:
        show_native_error_box('Error', 'Unable to get device Information. DEVISE_ID_ERORR')
        force_close_application()
        return
    splash.show_splash()
    splash.start_splash(setup_process)
    main_check()

if __name__ == '__main__':
    check_single_instance()
    startup()
