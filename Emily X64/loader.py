import webview
import os
import sys
from typing import Optional, Dict, Any
import time
import threading

class LoaderApi:
    def __init__(self, window):
        self.window = window
        self.logs = []
        self.max_logs = 1000  # Maximum number of logs to keep
        self.should_close = False  # Flag to control closing behavior

    def update_text(self, text: str):
        """Update the status text in the loader window"""
        if self.window:
            self.window.evaluate_js(f'document.getElementById("status-text").textContent = "{text}";')

    def add_log(self, text: str, level: str = "info"):
        """Add a log message to the log window"""
        if self.window:
            timestamp = time.strftime("%H:%M:%S")
            log_entry = {
                "timestamp": timestamp,
                "text": text,
                "level": level
            }
            self.logs.append(log_entry)
            
            # Keep only the last max_logs entries
            if len(self.logs) > self.max_logs:
                self.logs = self.logs[-self.max_logs:]
            
            # Update the log window
            self.window.evaluate_js(f'''
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry log-{level}';
                logEntry.innerHTML = `
                    <span class="log-timestamp">[{timestamp}]</span>
                    <span class="log-text">{text}</span>
                `;
                document.getElementById('log-container').appendChild(logEntry);
                document.getElementById('log-container').scrollTop = document.getElementById('log-container').scrollHeight;
            ''')

    def close(self):
        """Close the loader window"""
        if self.window:
            self.should_close = True
            self.window.destroy()

def show_loader(version: str = "1.0.0"):
    """Show the loader window"""
    window = webview.create_window(
        "Loading...",
        os.path.join(getattr(sys, '_MEIPASS', os.path.abspath(".")), 'frontend/loader.html'),
        js_api=LoaderApi,
        width=800,
        height=450,
        resizable=False,
        frameless=True,
        easy_drag=True,
        text_select=False,
        confirm_close=False,
    )
    
    def on_loaded():
        # Set version info after window is loaded
        window.evaluate_js(f'document.getElementById("version-info").textContent = "v{version}";')
        # Disable right-click and dev tools
        window.evaluate_js('''
            document.addEventListener('contextmenu', (e) => e.preventDefault());
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
                    e.preventDefault();
                }
            });
        ''')
    
    window.events.loaded += on_loaded
    return window

def update_loader_text(text: str):
    """Update the loader text"""
    if window:
        window.evaluate_js(f'document.querySelector("#status-text span").textContent = "{text}";')

def add_loader_log(text: str, level: str = "info"):
    """Add a log message to the loader"""
    if window:
        window.evaluate_js(f'''
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry log-{level}';
            logEntry.innerHTML = `
                <span class="log-timestamp">[{time.strftime("%H:%M:%S")}]</span>
                <span class="log-text">{text}</span>
            `;
            document.getElementById('log-container').appendChild(logEntry);
            document.getElementById('log-container').scrollTop = document.getElementById('log-container').scrollHeight;
        ''')

def close_loader():
    """Close the loader window"""
    if window:
        window.destroy()

def force_close_loader():
    """Force close the loader window"""
    global window
    if window:
        try:
            # Try to get the LoaderApi instance
            api = window.evaluate_js('window.pywebview.api')
            if api and hasattr(api, 'should_close'):
                api.should_close = True
            window.destroy()
        except:
            # If we can't access the API, just destroy the window
            window.destroy()
        finally:
            window = None

def start_loader(func=None, version: str = "1.0.0"):
    """Start the loader window and optionally run a function
    
    Args:
        func: Optional function to run while loader is active
        version: Version string to display in the loader (default: "1.0.0")
    """
    global window
    window = show_loader(version)
    
    if func:
        def run_func():
            try:
                func()
            except Exception as e:
                add_loader_log(f"Error: {str(e)}", "error")
            # Removed the automatic closing in finally block
            # The window will stay open until explicitly closed
        
        thread = threading.Thread(target=run_func)
        thread.daemon = True
        thread.start()
    
    webview.start(gui='edgechromium', debug=False)  # Use CEF renderer and disable debug mode

# Global window reference
window: Optional[webview.Window] = None 