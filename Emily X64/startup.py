import webview
import threading
import os
import time
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'frontend')
SPLASH_PATH = os.path.join(FRONTEND_DIR, 'splash.html')

# Global variables to store window and api references
splash_window = None
splash_api = None
class SplashApi:
    def __init__(self, window):
        self.window = window
    
    def update_text(self, text):
        self.window.evaluate_js(
            f"document.getElementById('status-text').textContent = '{text}';"
        )
    
    def close(self):
        self.window.destroy()

def show_splash():
    """Show the splash screen"""
    global splash_window, splash_api
   
    splash_window = webview.create_window(
        'Booting...',
        SPLASH_PATH,
        width=500,
        height=600,
        resizable=False,
        frameless=True,
        easy_drag=False,
        hidden=False
    )
    splash_api = SplashApi(splash_window)

def update_splash_text(text):
    """Update the splash screen text"""
    global splash_api
    if splash_api:
        splash_api.update_text(text)

def close_splash():
    """Close the splash screen"""
    global splash_api
    if splash_api:
        splash_api.close()

def start_splash(func=None):
    """Start the webview - must be called on main thread"""
    webview.start(func, gui='edgechromium')

def close_application():
    """Properly close the webview application"""
    # print'Closing application...')
    
    try:
        # Close splash window if it exists
        if splash_api:
            splash_api.close()
        
        # Destroy all webview windows
        for window in webview.windows:
            try:
                window.destroy()
            except:
                pass
        
        # Clear the windows list
        webview.windows.clear()
        
        # Small delay to let windows close gracefully
        time.sleep(0.3)
        
    except Exception as e:
        pass
        # printf"Error during shutdown: {e}")
    
    # Force immediate exit - this stops ALL execution
    os._exit(0)

# Alternative more aggressive close function
def force_close_application():
    """Force close application immediately"""
    # print'Force closing application...')
    
    try:
        # Try to close windows gracefully first
        for window in webview.windows:
            try:
                window.destroy()
            except:
                pass
        webview.windows.clear()
    except:
        pass
    
    # Force immediate exit
    os._exit(0)
def setup_process():
    time.sleep(1)  # Give webview time to initialize
    update_splash_text('Booting...')
    time.sleep(1)
    update_splash_text('Connecting to server...')
    time.sleep(1)
    
    # Assuming these functions exist in your code
    # con_sts, con_msg = check_status(headers)
    # For demo purposes, simulating the logic:
    con_sts = True  # Replace with your actual check
    con_msg = "Connected"  # Replace with your actual message
    
    if con_sts:
        # printf"✅ Server is up: {con_msg}")
        update_splash_text(f"✅ Server is up: {con_msg}")
    else:
        # printf"❌ Server error: {con_msg}")
        update_splash_text(f"❌ Server error: {con_msg}")
        # show_native_error_box('Error', f'Server error: {con_msg}')  # Uncomment if you have this function
        close_splash()
        close_application()
        return
    
    time.sleep(1)
    update_splash_text('Checking Application Data...')
    
    # Assuming these functions exist in your code
    # database_sts, database_sts_msg = initialize_databases()
    # For demo purposes:
    database_sts = True  # Replace with your actual check
    database_sts_msg = "Database initialized"  # Replace with your actual message
    
    if database_sts:
        # printf"✅ {database_sts_msg}")
        update_splash_text(f"✅ {database_sts_msg}")
    else:
        # printf"❌ {database_sts_msg}")
        update_splash_text(f"❌ {database_sts_msg}")
        # show_native_error_box('Error', f"❌ {database_sts_msg}")  # Uncomment if you have this function
        close_splash()
        close_application()
        return
    
    time.sleep(2)
    update_splash_text('Starting..')
    time.sleep(0.5)
    close_splash()

