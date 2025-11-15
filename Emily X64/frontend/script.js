// Default configuration (will be overridden by Python backend or window.APP_CONFIG)
const DEFAULT_CONFIG = {
    app_name: 'Emily AI',
    max_message_length: 500,
    allowed_extensions: {
        document: ['.pdf', '.js', '.py', '.txt', '.html', '.css', '.md', '.csv', '.xml', '.rtf'],
        image: ['.jpg', '.jpeg', '.png', '.gif']
    },
    suggestions: [
        'Tell me about yourself',
        'How can you help me?',
        'What are your capabilities?',
        'Show me some examples'
    ],
    user: {
        name: 'User',
        avatar: ''
    }
};

// Use window.APP_CONFIG if available, otherwise use DEFAULT_CONFIG
const APP_CONFIG = window.APP_CONFIG || DEFAULT_CONFIG;

// User info is available in window.USER_INFO or inside APP_CONFIG
const USER_INFO = window.USER_INFO || APP_CONFIG.user || { name: 'User', avatar: '' };

const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const sidebarToggle = document.getElementById('sidebar-toggle');
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const attachmentButton = document.getElementById('attachment-button');
const attachmentDropdown = document.getElementById('attachment-dropdown');
const emptyChatPlaceholder = document.getElementById('empty-chat-placeholder');
const suggestionGrid = document.querySelector('.suggestion-grid');
const settingsButton = document.getElementById('settings-button');
const appNameElement = document.getElementById('app-name');
const profileNameElement = document.getElementById('profile-name');
const profileAvatarElement = document.getElementById('profile-avatar');
const emptyChatTitle = document.getElementById('empty-chat-title');

// New sidebar buttons
const systemInfoButton = document.getElementById('system-info-button');
const accountButton = document.getElementById('account-button');
const logoutButton = document.getElementById('logout-button');
const historyButton = document.getElementById('history-button');
const memoryButton = document.getElementById('memory-button');

// State
let selectedFiles = [];
let selectedNativePath = null;
let isAttachmentDropdownOpen = false;
let isProcessing = false;
let uploadConfig = {
    document: { maxFiles: 3, currentCount: 0 },
    image: { maxFiles: 5, currentCount: 0 }
};
let fileUploadStatusElements = {};

// Add after the USER_INFO declaration
// Utility functions for window management and error handling
const errorTypes = {
    CRITICAL: { title: "Critical Error", destroy: true },
    WARNING: { title: "Warning", destroy: false },
    INFO: { title: "Information", destroy: false },
    AUTHENTICATION: { title: "Authentication Error", destroy: false },
    API_ERROR: { title: "API Error", destroy: false },
    NETWORK: { title: "Network Error", destroy: false },
    SYSTEM: { title: "System Error", destroy: true }
};

/**
 * Destroys the application window
 * @returns {Promise} A promise that resolves when the window is destroyed
 */
function destroyAppWindow() {
    console.log("Destroying application window");
    
    return new Promise((resolve) => {
        // Use the simplest approach first - direct API call to close_window
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close_window === 'function') {
            console.log("Using pywebview.api.close_window");
            try {
                const result = window.pywebview.api.close_window();
                console.log("Window close result:", result);
                return resolve(result || { success: true, message: "Window close initiated" });
            } catch (e) {
                console.error("Error using close_window:", e);
            }
        }
        
        // Use window.destroyWindow as a second option
        if (typeof window.destroyWindow === 'function') {
            console.log("Using window.destroyWindow");
            try {
                const result = window.destroyWindow();
                return resolve(result || { success: true, message: "Window destroy initiated via window.destroyWindow" });
            } catch (e) {
                console.error("Error using window.destroyWindow:", e);
            }
        }
        
        // As a last resort, try to use window.close()
        console.log("Attempting window.close() as fallback");
        try {
            window.close();
            return resolve({ success: true, message: "Used window.close fallback, result unknown" });
        } catch (e) {
            console.error("Error using window.close():", e);
        }
        
        console.error("No method available to destroy window");
        return resolve({ success: false, message: "No method available to destroy window" });
    });
}

// Add a direct debug function to test the window destroy function
function testDestroyWindow() {
    console.log("Testing window destroy function");
    
    // Show information about available functions
    console.log("window.destroyWindow exists:", typeof window.destroyWindow === 'function');
    
    // Check for close_window API method
    const hasCloseWindow = window.pywebview && 
                          window.pywebview.api && 
                          typeof window.pywebview.api.close_window === 'function';
    
    console.log("pywebview.api.close_window exists:", hasCloseWindow);
    
    // Add a message to the chat
    addMessageToChat({
        sender: 'System',
        text: `Testing window destroy function. The window will be destroyed in 3 seconds...\n\nUsing method: ${hasCloseWindow ? 'close_window API' : 'window.destroyWindow'}`,
        isUser: false
    });
    
    // Wait 3 seconds then try to destroy the window
    setTimeout(() => {
        console.log("Calling destroyAppWindow after delay");
        
        // Call the destroy function
        destroyAppWindow()
            .then(result => {
                console.log("Destroy result:", result);
                
                // If the window is still open, show an error message
                setTimeout(() => {
                    addMessageToChat({
                        sender: 'System',
                        text: `Failed to destroy window. Result: ${JSON.stringify(result)}`,
                        isUser: false
                    });
                }, 1000);
            })
            .catch(err => {
                console.error("Error destroying window:", err);
                
                // Show the error in chat
                addMessageToChat({
                    sender: 'System',
                    text: `Error destroying window: ${err}`,
                    isUser: false
                });
            });
    }, 3000);
}

/**
 * Shows an error message with optional window destruction
 * @param {string|Object} error - Error message or error object with predefined type
 * @param {boolean} [destroyWindow=false] - Whether to destroy the window after showing the error
 * @param {string} [errorTitle="Error"] - Title for the error dialog
 * @returns {Promise} A promise that resolves when the error is displayed
 */
function showErrorMessage(error, destroyWindow = false, errorTitle = "Error") {
    let errorDescription = '';
    let shouldDestroyWindow = destroyWindow;
    let title = errorTitle;
    
    // Handle different error parameter types
    if (typeof error === 'object') {
        // Check if it's a predefined error type
        if (error.type && errorTypes[error.type]) {
            const errorType = errorTypes[error.type];
            title = error.title || errorType.title;
            shouldDestroyWindow = error.destroy !== undefined ? error.destroy : errorType.destroy;
        } else {
            // It's a regular error object
            title = error.title || errorTitle;
            shouldDestroyWindow = error.destroy !== undefined ? error.destroy : destroyWindow;
        }
        
        // Get error description
        errorDescription = error.message || error.description || 
                          (error.toString ? error.toString() : "Unknown error");
    } else {
        // It's a string or primitive
        errorDescription = error ? error.toString() : "Unknown error";
    }
    
    console.error("Showing error:", { title, errorDescription, shouldDestroyWindow });
    
    // Use the appropriate method to show the error
    if (typeof window.showError === 'function') {
        return window.showError(shouldDestroyWindow, errorDescription, title);
    } else if (window.pywebview && window.pywebview.api) {
        const showErrorFn = findApiFunction('showError');
        if (showErrorFn) {
            return showErrorFn(shouldDestroyWindow, errorDescription, title);
        }
    }
    
    // Fallback to regular alert
    alert(`${title}: ${errorDescription}`);
    
    // Handle window destruction if needed
    if (shouldDestroyWindow) {
        setTimeout(() => destroyAppWindow(), 1000);
    }
    
    return Promise.resolve({ 
        success: false, 
        message: "Used alert fallback for error",
        details: { title, description: errorDescription, destroyed: shouldDestroyWindow }
    });
}

// Initialize app from config
function initializeApp(config) {
    console.log("Initializing app with config:", config);
    
    // --- First time setup check, moved here to prevent race conditions ---
    if (config) {
        // A new user is one where newuser is missing, or explicitly 'false' (case-insensitive)
        const isNewUser = !config.newuser || String(config.newuser).toLowerCase() === 'false';
        console.log(`New user status from config: ${config.newuser}, isNewUser: ${isNewUser}`);
        if (isNewUser && typeof startFirstSetup === 'function') {
            startFirstSetup();
            return; // Stop further initialization if setup is running
        }
    }
    
    // Ensure we have a valid config
    const appConfig = config || APP_CONFIG || DEFAULT_CONFIG;
    const userInfo = window.USER_INFO || appConfig.user || USER_INFO;
    
    console.log("Using app config:", appConfig);
    console.log("Using user info:", userInfo);
    
    // Update title and app name
    document.title = appConfig.app_name || 'Emily AI';
    if (appNameElement) {
        appNameElement.textContent = appConfig.app_name || 'Emily AI';
    }
    if (emptyChatTitle) {
        emptyChatTitle.textContent = `Welcome to ${appConfig.app_name || 'Emily AI'}`;
    }
    
    // Set user data
    updateUserProfile(userInfo);
    
    // Update message input max length
    if (messageInput) {
        messageInput.maxLength = appConfig.max_message_length || 500;
    }
    
    // Ensure input wrapper has the correct structure
    ensureInputWrapperStructure();
    
    // Clear and recreate suggestions
    createSuggestions(appConfig.suggestions || []);

    // Update user-type box
    updateUserTypeBox();
    // Update subscription button
    updateSubscriptionButton();
    
    // Update language from config
    if (window.APP_CONFIG?.userLang) {
        updateVoiceLanguage(window.APP_CONFIG.userLang);
        console.log('Language initialized from APP_CONFIG:', window.APP_CONFIG.userLang);
    }

    // Initialize isvoiseactive from config
    if (window.APP_CONFIG?.isvoiseactive !== undefined) {
        // Convert string to boolean
        isvoiseactive = String(window.APP_CONFIG.isvoiseactive).toLowerCase() === 'true';
        console.log('AI Voice active initialized from APP_CONFIG:', isvoiseactive);
    }
}

// Update user profile with information
function updateUserProfile(userInfo) {
    const user = userInfo || USER_INFO;
    console.log("Updating user profile with:", user);
    
    // Set user name
    if (profileNameElement) {
        profileNameElement.textContent = user.name || 'User';
        console.log("Set profile name to:", user.name);
    }
    
    // Set user avatar
    if (profileAvatarElement) {
        let avatarUrl = user.avatar;
        // If avatar is null, undefined, empty, or not a valid URL, use default
        if (!avatarUrl || avatarUrl === "null" || avatarUrl === null || !isValidHttpUrl(avatarUrl)) {
            avatarUrl = "./assets/avatar_defolt.gif";
        }
        profileAvatarElement.src = avatarUrl;
        console.log("Set profile avatar to:", avatarUrl);
    }
}

// Create suggestion cards
function createSuggestions(suggestions) {
    if (!suggestionGrid) return;
    
    const suggestionList = suggestions || APP_CONFIG.suggestions || [];
    console.log("Creating suggestions:", suggestionList);
    
    suggestionGrid.innerHTML = '';
    suggestionList.forEach(suggestion => {
        const card = document.createElement('div');
        card.className = 'suggestion-card';
        card.textContent = suggestion;
        card.addEventListener('click', () => {
            messageInput.value = suggestion;
            sendMessage();
        });
        suggestionGrid.appendChild(card);
    });
}

// Ensure input wrapper has the correct structure
function ensureInputWrapperStructure() {
    const inputWrapper = document.querySelector('.input-wrapper');
    if (inputWrapper) {
        // Check if input-row already exists
        if (!inputWrapper.querySelector('.input-row')) {
            // Create the input row
            const inputRow = document.createElement('div');
            inputRow.className = 'input-row';
            
            // Move all direct children to the input row
            while (inputWrapper.firstChild) {
                inputRow.appendChild(inputWrapper.firstChild);
            }
            
            // Append the input row to the wrapper
            inputWrapper.appendChild(inputRow);
        }
    }
}

// Attachment dropdown handlers
attachmentButton.addEventListener('click', (e) => {
    e.stopPropagation();
    isAttachmentDropdownOpen = !isAttachmentDropdownOpen;
    attachmentDropdown.classList.toggle('show', isAttachmentDropdownOpen);
});

// Close attachment dropdown when clicking elsewhere
document.addEventListener('click', () => {
    if (isAttachmentDropdownOpen) {
        isAttachmentDropdownOpen = false;
        attachmentDropdown.classList.remove('show');
    }
});

// Toggle sidebar
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

// Keyboard shortcut for sidebar
document.addEventListener('keydown', (e) => {
    if (e.key === '\\' && e.ctrlKey) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
});

// Handle file selection for different types
document.querySelectorAll('.attachment-option').forEach(option => {
    option.addEventListener('click', () => {
        const type = option.dataset.type;
        
        console.log("Attachment option clicked:", type);
        
        // Skip video type as it's disabled
        if (type === 'video') {
            alert("Video uploads are currently disabled.");
            return;
        }
        
        // Check if we've already reached the limit for this type
        if (uploadConfig[type].currentCount >= uploadConfig[type].maxFiles) {
            alert(`Maximum ${uploadConfig[type].maxFiles} ${type}(s) allowed`);
            return;
        }
        
        // Check total file limit
        const totalFiles = selectedFiles.length;
        if (totalFiles >= 5) {
            alert("Maximum 5 files allowed in total");
            return;
        }
        
        // Create and trigger file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = getAcceptForType(type);
        fileInput.multiple = true; // Enable multiple file selection
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileInput.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const files = Array.from(e.target.files);
                console.log("Files selected:", files.map(f => f.name));
                
                // Check if adding these files would exceed limits
                const newTotalFiles = totalFiles + files.length;
                if (newTotalFiles > 5) {
                    alert("Cannot add more files. Maximum 5 files allowed in total.");
                    return;
                }
                
                const newTypeCount = uploadConfig[type].currentCount + files.length;
                if (newTypeCount > uploadConfig[type].maxFiles) {
                    alert(`Cannot add more ${type} files. Maximum ${uploadConfig[type].maxFiles} allowed.`);
                    return;
                }
                
                // Process each file
                files.forEach(file => {
                    // Check file extension
                    const extension = '.' + file.name.split('.').pop().toLowerCase();
                    const allowedExtensions = APP_CONFIG.allowed_extensions[type] || [];
                    
                    if (!allowedExtensions.includes(extension)) {
                        alert(`Invalid file type for ${file.name}. Allowed extensions for ${type}: ${allowedExtensions.join(', ')}`);
                        return;
                    }
                    
                    // Check file size (max 20MB for Gemini API)
                    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
                    if (file.size > maxSize) {
                        alert(`File ${file.name} exceeds 20MB limit. Please choose a smaller file.`);
                        return;
                    }
                    
                    // Create a FileReader to read the file
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        // Store the file data
                        selectedFiles.push({
                            name: file.name,
                            type: type,
                            data: event.target.result, // Base64 encoded string
                            size: file.size,
                            mimeType: file.type
                        });
                        
                        // Debugging: Log file data for images
                        if (type === 'image') {
                            console.log(`Loaded image ${file.name}, data length: ${event.target.result.length}`);
                        }
                        
                        // Update UI
                        addFilePreview(file.name, type);
                        uploadConfig[type].currentCount++;
                    };
                    
                    // Read the file as data URL
                    reader.readAsDataURL(file);
                });
            }
            
            // Clean up
            document.body.removeChild(fileInput);
        };
        
        // Trigger file input click
        fileInput.click();
    });
});

// Helper function to get accept attribute for file input
function getAcceptForType(type) {
    const extensions = APP_CONFIG.allowed_extensions[type] || [];
    return extensions.join(',');
}

// Add file preview
function addFilePreview(fileName, type) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.innerHTML = `
        <i class="fas fa-${type === 'document' ? 'file' : type}"></i>
        <span>${fileName}</span>
        <button>×</button>
    `;
    
    // File remove handler
    preview.querySelector('button').addEventListener('click', () => {
        preview.remove();
        uploadConfig[type].currentCount--;
        selectedFiles = selectedFiles.filter(file => file.name !== fileName);
    });
    
    // Insert after the textarea in a file-preview-container
    let previewContainer = document.querySelector('.file-preview-container');
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'file-preview-container';
        const inputWrapper = document.querySelector('.input-wrapper');
        inputWrapper.appendChild(previewContainer);
    }
    
    previewContainer.appendChild(preview);
}

// Add thinking animation
function addThinkingAnimation() {
    const thinkingElement = document.createElement('div');
    thinkingElement.className = 'thinking-animation';
    thinkingElement.innerHTML = `
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
    `;
    chatArea.appendChild(thinkingElement);
    chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
    });
    return thinkingElement;
}

// Remove thinking animation
function removeThinkingAnimation(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

// Add new function to show file upload status
function showFileUploadStatus(fileName, status, error = null) {
    // Use fileName as the key (for production, use a unique ID if possible)
    let statusElement = fileUploadStatusElements[fileName];

    // If not exists, create it
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'file-upload-status';
        chatArea.appendChild(statusElement);
        fileUploadStatusElements[fileName] = statusElement;
    }

    // Update the content
    statusElement.innerHTML = `
        <div class="file-upload-info">
            <i class="fas fa-${status === 'uploading' ? 'spinner fa-spin' : 
                              status === 'success' ? 'check-circle' : 
                              status === 'error' ? 'exclamation-circle' : 'file'}"></i>
            <span class="file-name">${fileName}</span>
            <span class="status-text">${status.toUpperCase()}</span>
        </div>
        ${error ? `<div class="error-message">${error}</div>` : ''}
    `;

    // On success/error, remove after a short delay
    if (status === 'success' || status === 'error') {
        setTimeout(() => {
            if (statusElement && statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
                delete fileUploadStatusElements[fileName];
            }
        }, 2000); // 2 seconds
    }

    chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
    });

    return statusElement;
}

// Update sendMessage function to handle file upload status
function sendMessage() {
    const messageText = messageInput.value.trim();

    if (!messageText && selectedFiles.length === 0) {
        return;
    }

    // Don't allow sending if we're already processing
    if (isProcessing) {
        return;
    }

    // Set processing state
    isProcessing = true;
    sendButton.disabled = true;
    messageInput.disabled = true;

    // Remove empty chat placeholder if it exists
    if (emptyChatPlaceholder && emptyChatPlaceholder.style.display !== 'none') {
        emptyChatPlaceholder.style.display = 'none';
    }

    // Add user message to chat
    addMessageToChat({
        sender: USER_INFO.name || 'You',
        text: messageText,
        isUser: true,
        files: selectedFiles.map(file => ({
            name: file.name,
            type: file.type,
            data: file.data // Include data here for display
        }))
    });

    // Add thinking animation
    const thinkingElement = addThinkingAnimation();

    // Show initial upload status for each file
    const uploadStatusElements = {};
    selectedFiles.forEach(file => {
        uploadStatusElements[file.name] = showFileUploadStatus(file.name, 'uploading');
    });

    // Prepare message data
    const messageData = {
        text: messageText,
        files: selectedFiles.map(file => ({
            name: file.name,
            type: file.type,
            data: file.data, // Include data here for backend
            size: file.size,
            mimeType: file.mimeType
        }))
    };
    console.log("Message data being sent:", messageData);

    // Send to Python backend
    if (window.pywebview && window.pywebview.api) {
        const sendMessageFn = findApiFunction('sendMessageToBackend');
        if (sendMessageFn) {
            // Pass isvoiseactive to the backend
            sendMessageFn(JSON.stringify(messageData), isvoiseactive)
                .then(() => {
                    // Update file upload status to success
                    selectedFiles.forEach(file => {
                        if (uploadStatusElements[file.name]) {
                            uploadStatusElements[file.name].remove();
                            showFileUploadStatus(file.name, 'success');
                        }
                    });
                    
                    // Remove thinking animation
                    removeThinkingAnimation(thinkingElement);
                    
                    // Reset processing state
                    isProcessing = false;
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                    messageInput.focus();
                })
                .catch(error => {
                    console.error('Error sending message:', error);
                    
                    // Update file upload status to error
                    selectedFiles.forEach(file => {
                        if (uploadStatusElements[file.name]) {
                            uploadStatusElements[file.name].remove();
                            showFileUploadStatus(file.name, 'error', error.message || 'Upload failed');
                        }
                    });
                    
                    removeThinkingAnimation(thinkingElement);
                    
                    // Show error message
                    addMessageToChat({
                        sender: 'System',
                        text: 'Error sending message. Please try again.',
                        isUser: false
                    });
                    
                    // Reset processing state
                    isProcessing = false;
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                    messageInput.focus();
                });
        } else {
            console.error("sendMessage function not found in API");
            removeThinkingAnimation(thinkingElement);
            isProcessing = false;
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    }

    // Clear input and file selection
    messageInput.value = '';
    selectedFiles = [];
    document.querySelectorAll('.file-preview').forEach(el => el.remove());
    const previewContainer = document.querySelector('.file-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    
    Object.keys(uploadConfig).forEach(type => {
        uploadConfig[type].currentCount = 0;
    });
    
    // Reset textarea height
    autoResizeTextarea();
}

// Helper function to determine file type from extension
function getFileType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    // Check each category
    for (const [type, extensions] of Object.entries(APP_CONFIG.allowed_extensions)) {
        if (extensions.includes('.' + extension)) {
            return type;
        }
    }
    
    return 'document'; // Default fallback
}

// Function to add copy button to a code block
function addCopyButtonToCodeBlock(preBlock) {
    // Skip if already has a copy button or is in a message bubble
    if (preBlock.parentElement.classList.contains('code-block-wrapper') || 
        preBlock.closest('.message-bubble')) {
        return;
    }

    const codeBlock = preBlock.querySelector('code');
    if (codeBlock) {
        const copyButton = document.createElement('button');
        copyButton.className = 'icon-btn code-copy-btn';
        copyButton.title = 'Copy code';
        copyButton.innerHTML = '<i class="fad fa-copy"></i>';

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                showToast({
                    message: 'Code copied to clipboard!',
                    type: 'success',
                    duration: 2000
                });
            }).catch(err => {
                console.error('Failed to copy code:', err);
                showToast({
                    message: 'Failed to copy code.',
                    type: 'error',
                    duration: 2000
                });
            });
        });

        // Create a wrapper for the button and the pre block for positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        
        preBlock.parentNode.insertBefore(wrapper, preBlock);
        wrapper.appendChild(preBlock);
        wrapper.appendChild(copyButton);
    }
}

// Function to wrap code block in a message bubble
function wrapCodeBlockInMessage(preBlock) {
    // Skip if already in a message bubble
    if (preBlock.closest('.message-bubble')) {
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'message-bubble ai-message';
    
    const textElement = document.createElement('div');
    textElement.className = 'message-text';
    
    preBlock.parentNode.insertBefore(messageElement, preBlock);
    textElement.appendChild(preBlock);
    messageElement.appendChild(textElement);
    
    // Add copy button to the code block
    addCopyButtonToCodeBlock(preBlock);
}

// Add a MutationObserver to handle dynamically added code blocks
document.addEventListener('DOMContentLoaded', function() {
    const chatArea = document.getElementById('chat-area');
    
    // Wrap any existing standalone code blocks
    chatArea.querySelectorAll('pre').forEach(wrapCodeBlockInMessage);
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'PRE') {
                            wrapCodeBlockInMessage(node);
                        } else {
                            node.querySelectorAll('pre').forEach(wrapCodeBlockInMessage);
                        }
                    }
                });
            }
        });
    });

    observer.observe(chatArea, {
        childList: true,
        subtree: true
    });
});

// Function to show a popup with the full-size image
function showImagePopup(imageUrl, imageName) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(8px);
        z-index: 4000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
        background: rgba(20, 16, 40, 0.98);
        border-radius: 18px;
        padding: 1.5rem;
        max-width: 90vw;
        max-height: 90vh;
        color: #fff;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        overflow: hidden;
    `;

    popup.innerHTML = `
        <div style="font-size:1.2rem;font-weight:600;margin-bottom:1rem;text-align:center;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${imageName}</div>
        <img src="${imageUrl}" alt="${imageName}" style="max-width:100%; max-height:calc(90vh - 120px); object-fit:contain; border-radius:12px; margin-bottom:1.5rem;">
        <div style="display:flex;gap:1rem;justify-content:flex-end;width:100%;">
            <button class="icon-btn copy-image-btn" title="Copy Image URL"><i class="fad fa-link"></i></button>
            <button class="icon-btn close-image-popup-btn" title="Close"><i class="fad fa-times"></i></button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listeners for buttons
    popup.querySelector('.copy-image-btn').onclick = function() {
        navigator.clipboard.writeText(imageUrl).then(() => {
            showToast({
                message: 'Image URL copied!',
                type: 'success',
                duration: 2000
            });
        }).catch(err => {
            console.error('Failed to copy image URL:', err);
            showToast({
                message: 'Failed to copy image URL.',
                type: 'error',
                duration: 2000
            });
        });
    };

    popup.querySelector('.close-image-popup-btn').onclick = function() {
        overlay.remove();
    };

    // Close on overlay click
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

// Add message to chat
function addMessageToChat(message) {
    console.log("addMessageToChat received message:", message);
    try {
    const messageElement = document.createElement('div');
    messageElement.className = `message-bubble ${message.isUser ? 'user-message' : 'ai-message'}`;
        messageElement.dataset.markdown = message.text || '';

        // Always stop listening when an AI message arrives (to prevent mishearing audio)
        if (!message.isUser && isVoiceMode) {
            console.log("AI message received, stopping listening immediately");
            safelyStopListening();
            
            // Handle audio playback for voice messages
            if (message.voise_uri && message.voise_uri !== 'none' && isvoiseactive) {
                console.log("Voice URI detected, will play audio:", message.voise_uri);
                // Ensure listening is stopped and set flag to prevent premature restart
                audioPlaybackInProgress = true;
                
                // Short delay to ensure UI updates before audio starts
                setTimeout(() => {
                    playAudio(message.voise_uri, () => {
                        console.log("Audio playback complete, can resume listening now");
                        if (isVoiceMode) {
                            safelyStartListening();
                        }
                    });
                }, 100);
            } else {
                // If no audio to play, we can resume listening after a short delay
                console.log("No voice URI or disabled, resuming listening after delay");
                setTimeout(() => {
                    if (isVoiceMode) {
                        safelyStartListening();
                    }
                }, 800); // Longer delay when no audio, to give time to read the message
            }
        }
    
    const senderElement = document.createElement('div');
    senderElement.className = 'message-sender';
    senderElement.textContent = message.sender;
    
    const textElement = document.createElement('div');
    textElement.className = 'message-text';
    textElement.innerHTML = marked.parse(message.text);
    
        // Add copy button to code blocks
        textElement.querySelectorAll('pre').forEach(addCopyButtonToCodeBlock);
    // Add click handlers for links
    textElement.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
                const url = link.getAttribute('href');
                if (url) {
                    openExternalLink(url);
            }
        });
    });
    
        // Append sender and text first
    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);
    
        // Add file previews if there are any files
    if (message.files && message.files.length > 0) {
            console.log("Message contains files:", message.files);
            const filesContainer = document.createElement('div');
            filesContainer.className = 'message-files-container';

        message.files.forEach(file => {
                const fileDiv = document.createElement('div');
                fileDiv.className = `message-file-item ${file.type}-item`;

                if (file.type === 'image' && file.data) {
                    console.log(`Displaying image ${file.name}, data length: ${file.data.length}`);
                    console.log(`Image data (first 50 chars): ${file.data.substring(0, 50)}...`);
                    fileDiv.innerHTML = `
                        <img src="${file.data}" alt="${file.name}" class="message-image-thumbnail">
                        <div class="file-name">${file.name}</div>
                    `;
                    // Add click event for image popup
                    fileDiv.addEventListener('click', () => showImagePopup(file.data, file.name));
                } else {
                    fileDiv.innerHTML = `
                <div class="file-icon">
                            <i class="fas fa-${file.type === 'document' ? 'file-alt' : file.type}"></i>
                </div>
                <div class="file-name">${file.name}</div>
            `;
                }
                filesContainer.appendChild(fileDiv);
            });
            messageElement.appendChild(filesContainer);
        }

        // Add message actions (copy and maximize buttons)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-bubble-actions';

        const copyButton = document.createElement('button');
        copyButton.className = 'icon-btn copy-btn';
        copyButton.title = 'Copy markdown';
        copyButton.innerHTML = '<i class="fad fa-copy"></i>';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(messageElement.dataset.markdown).then(() => {
                showToast({
                    message: 'Copied to clipboard!',
                    type: 'success',
                    duration: 2000
                });
            });
        };

        const maximizeButton = document.createElement('button');
        maximizeButton.className = 'icon-btn maximize-btn';
        maximizeButton.title = 'Maximize';
        maximizeButton.innerHTML = '<i class="fad fa-expand-arrows"></i>';
        maximizeButton.onclick = () => showMaximizePopup(messageElement.dataset.markdown);

        actionsDiv.appendChild(copyButton);
        actionsDiv.appendChild(maximizeButton);
        messageElement.appendChild(actionsDiv);

        const chatArea = document.getElementById('chat-area');
        console.log("Attempting to append message. ChatArea exists:", !!chatArea, "MessageElement exists:", !!messageElement);
    chatArea.appendChild(messageElement);
        chatArea.scrollTop = chatArea.scrollHeight;
    } catch (error) {
        console.error("Error in addMessageToChat:", error, "Message object:", message);
        showToast({
            message: 'Error displaying message.',
            type: 'error',
            duration: 4000
        });
    }
    // Play audio in text mode if isvoiseactive and voise_uri is present, but do not change any listening logic
    if (!message.isUser && !isVoiceMode && message.voise_uri && message.voise_uri !== 'none' && isvoiseactive) {
        playAudio(message.voise_uri);
    }
}

function showMaximizePopup(markdown) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(6px);
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: rgba(20, 16, 40, 0.98);
        border-radius: 18px;
        padding: 2rem 2.5rem;
        min-width: 90%;
        max-width: 90vw;
        max-height: 100vh;
        color: #fff;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        position: relative;
        overflow-y: auto;
    `;
    popup.innerHTML = `
        <div style="font-size:1.2rem;font-weight:600;margin-bottom:1.2rem;text-align:center;">Full Message</div>
        <textarea readonly style="width:100%;height:60vh;resize:vertical;border-radius:8px;padding:1rem;font-size:1rem;background:rgba(255,255,255,0.07);color:#fff;outline:none;border:none;">${markdown}</textarea>
        <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem;">
            <button class="icon-btn copy-btn" title="Copy"><i class="fad fa-copy"></i></button>
            <button class="icon-btn close-btn" title="Close"><i class="fad fa-times"></i></button>
                </div>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    // Copy in popup
    popup.querySelector('.copy-btn').onclick = function() {
        navigator.clipboard.writeText(markdown).then(() => {
            showToast({
                message: 'Copied to clipboard!',
                type: 'success',
                duration: 2000
            });
        });
    };
    // Close popup
    popup.querySelector('.close-btn').onclick = function() {
        overlay.remove();
    };
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, 120); // Max height 120px
    messageInput.style.height = `${newHeight}px`;
    
    // Also adjust the height of the file preview container if needed
    const filePreviewContainer = document.querySelector('.file-preview-container');
    if (filePreviewContainer) {
        if (filePreviewContainer.children.length > 0) {
            filePreviewContainer.style.minHeight = '40px';
        } else {
            filePreviewContainer.style.minHeight = '0';
        }
    }
}

// Event listeners
messageInput.addEventListener('input', autoResizeTextarea);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);


// Check if pywebview API is initialized
function isPywebviewReady() {
    return (
        typeof window.pywebview !== 'undefined' &&
        window.pywebview !== null &&
        typeof window.pywebview.api !== 'undefined' &&
        window.pywebview.api !== null
    );
}

// Wait for pywebview to be ready
function waitForPywebview(callback, maxAttempts = 10, interval = 500) {
    let attempts = 0;
    
    console.log("Waiting for pywebview API to initialize...");
    
    const checkPywebview = () => {
        attempts++;
        
        if (isPywebviewReady()) {
            console.log("pywebview API is ready");
            callback();
            return;
        }
        
        if (attempts >= maxAttempts) {
            console.error(`Failed to detect pywebview API after ${maxAttempts} attempts`);
            return;
        }
        
        console.log(`Waiting for pywebview API... Attempt ${attempts}/${maxAttempts}`);
        setTimeout(checkPywebview, interval);
    };
    
    checkPywebview();
}

// Load user info directly from API
function loadUserInfo() {
    console.log("Loading user info");
    
    // Use window.USER_INFO if already available
    if (window.USER_INFO) {
        console.log("Using window.USER_INFO:", window.USER_INFO);
        updateUserProfile(window.USER_INFO);
        return;
    }
    
    // Try direct window function 
    if (typeof window.getUserInfo === 'function') {
        console.log("Using direct window.getUserInfo function");
        try {
            window.getUserInfo()
                .then(userInfo => {
                    console.log("Received user info from direct method:", userInfo);
                    if (userInfo) {
                        // Cache the user info
                        window.USER_INFO = userInfo;
                        // Update profile
                        updateUserProfile(userInfo);
                    }
                })
                .catch(err => {
                    console.error("Error getting user info from direct method:", err);
                    fallbackToDefaultUserInfo();
                });
            return;
        } catch (error) {
            console.error("Error calling direct getUserInfo:", error);
        }
    }
    
    // Try pywebview API
    if (isPywebviewReady()) {
        // Find the getUserInfo function (case-insensitive)
        const getUserInfoFn = findApiFunction('getUserInfo');
        
        if (getUserInfoFn) {
            console.log("Calling pywebview.api.getUserInfo function");
            try {
                getUserInfoFn()
                    .then(userInfo => {
                        console.log("Received user info from pywebview API:", userInfo);
                        if (userInfo) {
                            // Cache the user info
                            window.USER_INFO = userInfo;
                            // Update profile
                            updateUserProfile(userInfo);
                        }
                    })
                    .catch(err => {
                        console.error("Error getting user info from pywebview API:", err);
                        fallbackToDefaultUserInfo();
                    });
                return;
            } catch (error) {
                console.error("Error calling pywebview getUserInfo:", error);
            }
        } else {
            console.warn("getUserInfo function not found in pywebview API");
        }
    } else {
        console.warn("pywebview API not available for loading user info");
    }
    
    // Fallback to default user info
    fallbackToDefaultUserInfo();
}

// Helper function to set default user info
function fallbackToDefaultUserInfo() {
    console.log("Using default user info as fallback");
    updateUserProfile(USER_INFO);
}

// Initialize with backend configuration
function initializeWithBackend() {
    console.log("Initializing with backend configuration");
    
    // Use window.APP_CONFIG if already available
    if (window.APP_CONFIG) {
        console.log("Using window.APP_CONFIG:", window.APP_CONFIG);
        initializeApp(window.APP_CONFIG);
        return;
    }
    
    // Try direct window function
    if (typeof window.getConfig === 'function') {
        console.log("Using direct window.getConfig function");
        try {
            window.getConfig()
                .then(config => {
                    console.log("Received config from direct method:", config);
                    if (config) {
                        // Cache the config
                        window.APP_CONFIG = config;
                        // Initialize app with config
                        initializeApp(config);
                    }
                })
                .catch(err => {
                    console.error("Error fetching config from direct method:", err);
                    initializeApp(DEFAULT_CONFIG);
                });
            return;
        } catch (error) {
            console.error("Error calling direct getConfig:", error);
        }
    }
    
    // Try pywebview API
    if (isPywebviewReady()) {
        console.log("Trying pywebview API for config");
        
        // Find the getConfig function (case-insensitive)
        const getConfigFn = findApiFunction('getConfig');
        
        if (getConfigFn) {
            try {
                getConfigFn()
                    .then(config => {
                        console.log("Received config from pywebview API:", config);
                        if (config) {
                            // Cache the config
                            window.APP_CONFIG = config;
                            // Initialize app with config
                            initializeApp(config);
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching config from pywebview API:", err);
                        initializeApp(DEFAULT_CONFIG);
                    });
                return;
            } catch (error) {
                console.warn("Could not fetch config from pywebview API:", error);
                initializeApp(DEFAULT_CONFIG);
            }
        } else {
            console.warn("getConfig function not found in pywebview API");
        }
    } else {
        console.warn("pywebview API not available");
    }
    
    // Fallback to default config
    console.log("Using default config as fallback");
    initializeApp(DEFAULT_CONFIG);
}

// Helper function to find API functions with case-insensitive matching
function findApiFunction(functionName) {
    if (!window.pywebview || !window.pywebview.api) {
        return null;
    }
    
    // First try exact match
    if (typeof window.pywebview.api[functionName] === 'function') {
        return window.pywebview.api[functionName];
    }
    
    // Try case-insensitive match
    const apiKeys = Object.keys(window.pywebview.api);
    
    // Debug available API functions
    console.log("Available API functions:", apiKeys);
    
    // Look for case-insensitive match
    const matchedKey = apiKeys.find(key => 
        key.toLowerCase() === functionName.toLowerCase()
    );
    
    if (matchedKey && typeof window.pywebview.api[matchedKey] === 'function') {
        console.log(`Found function '${matchedKey}' matching '${functionName}'`);
        return window.pywebview.api[matchedKey];
    }
    
    // Try alternative function names based on common patterns
    const alternatives = [
        functionName,                           // getUserInfo
        functionName.toLowerCase(),             // getuserinfo
        toSnakeCase(functionName),              // get_user_info
        toCamelCase(toSnakeCase(functionName))  // getUserInfo
    ];
    
    for (const alt of alternatives) {
        if (alt !== functionName && typeof window.pywebview.api[alt] === 'function') {
            console.log(`Found alternative function '${alt}' for '${functionName}'`);
            return window.pywebview.api[alt];
        }
    }
    
    console.warn(`Function '${functionName}' not found in API`);
    return null;
}

// Helper function to convert camelCase to snake_case
function toSnakeCase(str) {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

// Helper function to convert snake_case to camelCase
function toCamelCase(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Initialize
window.addEventListener('load', () => {
    console.log("Window loaded, initializing app...");
    
    // The first-time setup check has been moved to initializeApp to avoid race conditions.
    
    // Set initial user profile
    updateUserProfile(USER_INFO);
    
    // Try to load user info directly
    setTimeout(() => {
        loadUserInfo();
    }, 500);
    
    // Hide welcome screen and show an initial message instead
    if (emptyChatPlaceholder) {
        console.log("Hiding empty chat placeholder.");
        emptyChatPlaceholder.style.display = 'none';
        console.log("Empty chat placeholder display status:", emptyChatPlaceholder.style.display);
        
        // Add initial greeting message
        addMessageToChat({
            sender: '- Emily AI',
            text: '**Hello! I\'m Emily AI. How can I help you today?**',
            isUser: false
        });
        console.log("Initial greeting message added.");
    }
    
    // Auto resize textarea on load
    autoResizeTextarea();
    
    // Focus input field
    messageInput.focus();
    
    // Try to initialize right away if we have window.APP_CONFIG
    if (window.APP_CONFIG) {
        console.log("Using window.APP_CONFIG from initialization");
        initializeApp(window.APP_CONFIG);
    }
    // Try to initialize right away if pywebview is already available
    else if (isPywebviewReady()) {
        console.log("pywebview API available immediately");
        initializeWithBackend();
    } else {
        console.log("pywebview API not available yet, waiting...");
        // Wait for pywebview to be ready
        waitForPywebview(() => {
            initializeWithBackend();
            // Try loading user info again after API is ready
            loadUserInfo();
        });
        
        // DO NOT initialize with defaults here to prevent race conditions.
        // The UI will wait for the backend to provide the real config.
    }
    
    // Test echo function if available
    setTimeout(() => {
        if (window.pywebview && window.pywebview.api) {
            const echoFn = findApiFunction('echo');
            if (echoFn) {
                console.log("Testing echo function");
                echoFn("Hello from JavaScript")
                    .then(response => {
                        console.log("Echo response:", response);
                    })
                    .catch(err => {
                        console.error("Echo error:", err);
                    });
            }
        }
    }, 1000);
    

    // After backend config loads, update user-type box
    setTimeout(() => {
        updateUserTypeBox();
    }, 1000);

    // After backend config loads, update subscription button
    setTimeout(() => {
        updateSubscriptionButton();
    }, 1000);

    // Cleanup any pending attachments on load
    cleanupPendingAttachments();
});

// Function to cleanup any pending attachments from previous sessions
function cleanupPendingAttachments() {
    selectedFiles = [];
    document.querySelectorAll('.file-preview').forEach(el => el.remove());
    const previewContainer = document.querySelector('.file-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    Object.keys(uploadConfig).forEach(type => {
        uploadConfig[type].currentCount = 0;
    });
    console.log("Cleaned up pending attachments on load.");
}

// Remove all sidebar event listeners and handler functions for sidebar buttons
// Add new global click handler functions for each sidebar button

function handleSystemInfoClick() {
    // Always get the latest config from window
    const config = window.APP_CONFIG || APP_CONFIG;
    if (!config) {
        showToast({
            message: 'System information not available',
            type: 'error',
            duration: 3000
        });
        return;
    }

    // Mask device ID: show first 4 and last 4 chars
    function maskDeviceId(id) {
        if (!id || typeof id !== 'string') return '';
        if (id.length <= 8) return id;
        return id.slice(0, 4) + '*'.repeat(id.length - 8) + id.slice(-4);
    }

    const latestVersion = config.latest_version_info?.leatest_version || 'N/A';
    const releaseType = config.latest_version_info?.relese_type || 'N/A';
    const currentVersion = config.current_version || 'N/A';
    const currentVersionCode = config.current_version_code || 'N/A';
    const llmModel = config.gemini?.model || 'N/A';
    const deviceId = maskDeviceId(config.devise_id || '');
    const osInfo = config.windows_info || 'N/A';

    // Build popup HTML with two columns
    const devInfo = config.dev_info || '';
    const devInfoIframeId = 'dev-info-iframe';
    const devInfoSection = devInfo ? `
        <div style="margin-top:2.5rem;width:100%;">
            <h3 style="font-size:1.1rem;font-weight:600;margin-bottom:0.7rem;color:var(--primary-color);letter-spacing:0.02em;">Developer Info</h3>
            <iframe id="${devInfoIframeId}" 
                srcdoc="<style>body{margin:0;padding:1rem;} ::-webkit-scrollbar{display:none;} html,body{scrollbar-width:none;-ms-overflow-style:none;}</style>${devInfo.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" 
                style="width:100%;border-radius:12px;border:1px solid var(--border-light);background:rgba(0,0,0,0.08);margin-bottom:0.5rem;overflow:auto;" 
                scrolling="auto" 
                frameborder="0"
                onload="resizeIframe(this)">
            </iframe>
        </div>
    ` : '';

    // Add resizeIframe function to window scope
    window.resizeIframe = function(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                iframe.style.height = iframeDoc.body.scrollHeight + "px";
            }
        } catch (e) {
            console.error('Error resizing iframe:', e);
        }
    };

    const contentHtml = `
        <div class = "system-info-container" style="display:flex;flex-direction:column;gap:1rem;min-width:70%;padding:0.5rem;max-height:80vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--primary-color) rgba(255,255,255,0.1);">
            <style>
                .system-info-container::-webkit-scrollbar {
                    width: 8px;
                }
                .system-info-container::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
                .system-info-container::-webkit-scrollbar-thumb {
                    background: var(--primary-color);
                    border-radius: 4px;
                }
                .system-info-container::-webkit-scrollbar-thumb:hover {
                    background: var(--primary-hover);
                }
            </style>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <!-- Left Column -->
                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <span style="color:var(--text-dim);">Latest Version:</span>
                        <span style="color:var(--text-light);font-weight:500;">${latestVersion}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <span style="color:var(--text-dim);">Current Version:</span>
                        <span style="color:var(--text-light);font-weight:500;">${currentVersion}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <span style="color:var(--text-dim);">LLM Model:</span>
                        <span style="color:var(--text-light);font-weight:500;">${llmModel}</span>
                    </div>
                </div>
                
                <!-- Right Column -->
                <div style="display:flex;flex-direction:column;gap:1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <span style="color:var(--text-dim);">Release Type:</span>
                        <span style="color:var(--text-light);font-weight:500;">${releaseType}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <span style="color:var(--text-dim);">Version Code:</span>
                        <span style="color:var(--text-light);font-weight:500;">${currentVersionCode}</span>
                    </div>
                </div>
            </div>

            <!-- Full Width Items -->
            <div style="display:flex;flex-direction:column;gap:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                    <span style="color:var(--text-dim);">Device ID:</span>
                    <span style="color:var(--text-light);font-weight:500;font-family:monospace;">${deviceId}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;background:rgba(255,255,255,0.05);border-radius:8px;">
                    <span style="color:var(--text-dim);">Operating System:</span>
                    <span style="color:var(--text-light);font-weight:500;">${osInfo}</span>
                </div>
            </div>
            ${devInfoSection}
        </div>
    `;

    showPopupBelowHeader({
        title: 'System & App Information',
        contentHtml,
        proGlow: false
    });
    // After popup is rendered, auto-resize the iframe to fit content and hide scrollbars
    if (devInfo) {
        setTimeout(() => {
            const iframe = document.getElementById(devInfoIframeId);
            if (iframe) {
                // Initial resize
                window.resizeIframe(iframe);
                
                // Also resize on content changes
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                    const observer = new MutationObserver(() => {
                        window.resizeIframe(iframe);
                    });
                        observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
                    } catch (e) {
                    console.error('Error setting up iframe observer:', e);
                    }
            }
        }, 50);
    }
}
function handleHistoryClick() {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_chat_history === 'function') {
        window.pywebview.api.get_chat_history()
            .then(response => {
                if (response.success) {
                    const history = response.history;
                    let historyHtml = '';
                    let isHistoryEmpty = history.length === 0;
                    let clearBtnOnClick = isHistoryEmpty ? "showToast({message: 'There is nothing to clear! Your chat history is already empty.',duration: 3000})" : 'showClearHistoryConfirmation()';
                    let summarizeBtnOnClick = isHistoryEmpty ? "showToast({message: 'There is nothing to summarize! Your chat history is already empty.',duration: 3000})" : 'summarizeHistoryPopup()';
                    if (isHistoryEmpty) {
                        historyHtml = `
                            <div style="
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                height: 40vh;
                                background: transparent;
                                border-radius: 16px;
                                gap: 0.5rem;
                                margin-top: 2rem;
                            ">
                                <div style="
                                    font-size: 4rem;
                                    color: #a3a3a3;
                                    margin-bottom: 0.5rem;
                                ">😔</div>
                                <div style="
                                    font-size: 2rem;
                                    font-weight: 600;
                                    color: #d1d5db;
                                    margin-bottom: 0.5rem;
                                    text-align: center;
                                ">It feels lonely here...</div>
                                <div style="
                                    font-size: 1.1rem;
                                    color: #a3a3a3;
                                    text-align: center;
                                ">No history record found</div>
                            </div>
                        `;
                    } else {
                        historyHtml = history.map((msg, index) => {
                            const isUser = msg.role === 'user';
                            const roleColor = isUser ? 'var(--primary-color)' : 'var(--secondary-color)';
                            // Format timestamp if available
                            let timestampHtml = '';
                            if (msg.timestamp) {
                                let dateObj = new Date(msg.timestamp);
                                if (!isNaN(dateObj.getTime())) {
                                    let dateStr = dateObj.toLocaleDateString();
                                    let timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    timestampHtml = `<div style=\"color:#a3a3a3;font-size:0.85rem;margin-bottom:0.5rem;\">${dateStr} &bull; ${timeStr}</div>`;
                                }
                            }
                            // Use the markdown text for copy/maximize (parts[0].text)
                            const markdown = msg.parts && msg.parts[0] && msg.parts[0].text ? msg.parts[0].text : '';
                            return `
                                <div class=\"history-item\" style=\"
                                    background: rgba(255,255,255,0.05);
                                    border-radius: 12px;
                                    padding: 1rem;
                                    border: 1px solid rgba(255,255,255,0.1);
                                    transition: all 0.2s ease;
                                    margin-bottom: 1rem;
                                \" data-markdown=\"${encodeURIComponent(markdown)}\">
                                    <div style=\"
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        margin-bottom: 0.75rem;
                                        padding-bottom: 0.5rem;
                                        border-bottom: 1px solid rgba(255,255,255,0.1);
                                    \">
                                        <div style=\"
                                            display: flex;
                                            align-items: center;
                                            gap: 0.5rem;
                                        \">
                                            <div style=\"
                                                width: 8px;
                                                height: 8px;
                                                border-radius: 50%;
                                                background: ${roleColor};
                                                box-shadow: 0 0 8px ${roleColor};
                                            \"></div>
                                            <span style=\"
                                                color: ${roleColor};
                                                font-weight: 600;
                                                font-size: 0.9rem;
                                                text-transform: uppercase;
                                                letter-spacing: 0.5px;
                                            \">${msg.role}</span>
                                        </div>
                                        <span style=\"
                                            color: var(--text-dim);
                                            font-size: 0.8rem;
                                        \">#${index + 1}</span>
                                    </div>
                                    ${timestampHtml}
                                    <div class=\"message-text\" style=\"color: var(--text-light);font-size: 0.95rem;line-height: 1.5;white-space: pre-wrap;word-break: break-word;\">${marked.parse(markdown)}</div>
                                    <div class=\"message-bubble-actions\" style=\"margin-top:0.75rem;display:flex;gap:0.5rem;justify-content:flex-end;\">
                                        <button class=\"icon-btn history-copy-btn\" title=\"Copy markdown\"><i class=\"fad fa-copy\"></i></button>
                                        <button class=\"icon-btn history-maximize-btn\" title=\"Maximize\"><i class=\"fad fa-expand-arrows\"></i></button>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }

                    showPopupBelowHeader({
                        title: 'Chat History',
                        contentHtml: `
                            <div style="
                                display: flex;
                                flex-direction: column;
                                gap: 1rem;
                                min-width: 70%;
                                padding: 1.5rem;
                                max-width: 95%;
                                max-height: 80vh;
                                overflow-y: auto;
                                scrollbar-width: thin;
                                scrollbar-color: var(--primary-color) rgba(255,255,255,0.1);
                                background: rgba(13, 2, 33, 0.95);
                                border-radius: 16px;
                                border: 1px solid rgba(255,255,255,0.1);
                                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                            ">
                                <div style="
                                    display: flex;
                                    justify-content: flex-start;
                                    gap: 0.5rem;
                                    margin-bottom: 1rem;
                                ">
                                    <button onclick="${clearBtnOnClick}" style="
                                        background: rgba(239, 68, 68, 0.1);
                                        color: #ef4444;
                                        border: 1px solid rgba(239, 68, 68, 0.3);
                                        padding: 0.5rem 1rem;
                                        border-radius: 8px;
                                        font-weight: 500;
                                        cursor: pointer;
                                        transition: all 0.2s ease;
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                    ">
                                        <i class="fas fa-trash-alt"></i>
                                        Clear History
                                    </button>
                                    <button onclick="${summarizeBtnOnClick}" style="
                                        background: rgba(99, 102, 241, 0.1);
                                        color: #6366f1;
                                        border: 1px solid rgba(99, 102, 241, 0.3);
                                        padding: 0.5rem 1rem;
                                        border-radius: 8px;
                                        font-weight: 500;
                                        cursor: pointer;
                                        transition: all 0.2s ease;
                                        display: flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                    ">
                                        <i class="fas fa-scroll"></i>
                                        Summarize History
                                    </button>
                                </div>
                                <style>
                                    .history-container::-webkit-scrollbar {
                                        width: 8px;
                                    }
                                    .history-container::-webkit-scrollbar-track {
                                        background: rgba(255,255,255,0.1);
                                        border-radius: 4px;
                                    }
                                    .history-container::-webkit-scrollbar-thumb {
                                        background: var(--primary-color);
                                        border-radius: 4px;
                                    }
                                    .history-container::-webkit-scrollbar-thumb:hover {
                                        background: var(--primary-hover);
                                    }
                                    .history-item:hover {
                                        transform: translateY(-2px);
                                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                                        border-color: rgba(255,255,255,0.2);
                                    }
                                </style>
                                <div class="history-container" style="
                                    display: flex;
                                    flex-direction: column;
                                    gap: 1rem;
                                ">
                                    ${historyHtml}
                                </div>
                            </div>
                        `,
                        proGlow: false
                    });

                    // Attach copy/maximize logic to history items
                    setTimeout(() => {
                        document.querySelectorAll('.history-item').forEach(item => {
                            const markdown = decodeURIComponent(item.getAttribute('data-markdown') || '');
                            const copyBtn = item.querySelector('.history-copy-btn');
                            const maxBtn = item.querySelector('.history-maximize-btn');
                            if (copyBtn) {
                                copyBtn.onclick = function() {
                                    navigator.clipboard.writeText(markdown).then(() => {
                                        showToast({
                                            message: 'Copied to clipboard!',
                                            type: 'success',
                                            duration: 2000
                                        });
                                    });
                                };
                            }
                            if (maxBtn) {
                                maxBtn.onclick = function() {
                                    showMaximizePopup(markdown);
                                };
                            }
                        });
                    }, 10);

                    // Attach summarizeHistoryPopup to window for button
                    window.summarizeHistoryPopup = function() {
                        showHistorySummaryPopup(history);
                    };
                } else {
                    showToast({
                        message: response.message || 'Failed to load chat history',
                        type: 'error',
                        duration: 3000
                    });
                }
            })
            .catch(error => {
                showToast({
                    message: 'Failed to load chat history',
                    type: 'error',
                    duration: 3000
                });
            });
    } else {
        showToast({
            message: 'Unable to load chat history',
            type: 'error',
            duration: 3000
        });
    }
}

function showHistorySummaryPopup(history) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(6px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: rgba(20, 16, 40, 0.98);
        border-radius: 18px;
        padding: 2rem 2.5rem;
        min-width: 340px;
        max-width: 90vw;
        max-height: 80vh;
        color: #fff;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        overflow-y: auto;
    `;
    popup.innerHTML = `
        <div style="font-size:1.3rem;font-weight:600;margin-bottom:1.2rem;text-align:center;">Generating history summary...</div>
        <div class="thinking-animation" style="margin-bottom:1.5rem;">
            <div class="thinking-dot"></div>
            <div class="thinking-dot"></div>
            <div class="thinking-dot"></div>
        </div>
        <div id="history-summary-content" style="font-size:1.05rem;line-height:1.6;text-align:left;"></div>
        <button id="close-summary-popup" style="margin-top:2rem;background:rgba(255,255,255,0.08);color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Close</button>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    document.getElementById('close-summary-popup').onclick = () => overlay.remove();

    // Prepare prompt and call Python
    const prompt = 'Generate a detailed summary of the following chat history. The history is provided as a JSON array. Please provide a comprehensive, human-readable summary.';
    const messageData = {
        text: `${prompt}\n\n${JSON.stringify(history, null, 2)}`
    };
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.generate_responce === 'function') {
        window.pywebview.api.generate_responce(JSON.stringify(messageData))
            .then(res => {
                const contentDiv = document.getElementById('history-summary-content');
                if (res.success && res.response) {
                    contentDiv.innerHTML = `<div style='white-space:pre-line;'>${res.response}</div>`;
                    popup.querySelector('.thinking-animation').style.display = 'none';
                    popup.querySelector('div').textContent = 'Chat History Summary';
                } else {
                    contentDiv.innerHTML = `<span style='color:#ef4444;'>${res.message || 'Failed to generate summary.'}</span>`;
                    popup.querySelector('.thinking-animation').style.display = 'none';
                    popup.querySelector('div').textContent = 'Error';
                }
            })
            .catch(err => {
                const contentDiv = document.getElementById('history-summary-content');
                contentDiv.innerHTML = `<span style='color:#ef4444;'>${err.message || 'Failed to generate summary.'}</span>`;
                popup.querySelector('.thinking-animation').style.display = 'none';
                popup.querySelector('div').textContent = 'Error';
            });
    } else {
        const contentDiv = document.getElementById('history-summary-content');
        contentDiv.innerHTML = `<span style='color:#ef4444;'>Python API not available.</span>`;
        popup.querySelector('.thinking-animation').style.display = 'none';
        popup.querySelector('div').textContent = 'Error';
    }
}

function handleMemoryClick() {
    showToast({
        message: 'AI Memory : This feature is currently under development and will be available in future updates.',
        type: 'info',
        duration: 3000
    });
}
function handleAccountClick() {
    // Always get the latest config from window
    const config = window.APP_CONFIG || APP_CONFIG;
    if (!config || !config.user) {
        addMessageToChat({ sender: 'System', text: 'User info not available.', isUser: false });
        return;
    }
    const user = config.user;
    // Mask email: show first 2 and last 2 chars before @, rest as *
    function maskEmail(email) {
        if (!email || typeof email !== 'string') return '';
        const [local, domain] = email.split('@');
        if (!local || !domain) return email;
        if (local.length <= 4) return local[0] + '**' + local.slice(-1) + '@' + domain;
        return local.slice(0,2) + '*'.repeat(Math.max(0, local.length-4)) + local.slice(-2) + '@' + domain;
    }
    // Avatar logic: fallback if null/empty/invalid
    function getAvatarUrl(avatar) {
        if (!avatar || avatar === 'null' || avatar === null || !isValidHttpUrl(avatar)) {
            return './assets/avatar_defolt.gif';
        }
        return avatar;
    }
    const name = user.name || '';
    const dob = user.date_of_birth || '';
    const gender = user.gender || '';
    const email = maskEmail(user.email || '');
    const avatarUrl = getAvatarUrl(user.avatar);
    // Build popup HTML
    const contentHtml = `
        <div style="display:flex;align-items:center;gap:2.5rem;min-width:400px;">
            <div style="flex-shrink:0;">
                <img src="${avatarUrl}" alt="Avatar" style="width:96px;height:96px;border-radius:50%;border:3px solid #6366f1;object-fit:cover;background:#222;" onerror=\"this.onerror=null;this.src='./assets/avatar_defolt.gif'\">
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:0.7rem;font-size:1.1rem;">
                <div><b>Name:</b> <span style="color:#fff;">${name}</span></div>
                <div><b>Date of Birth:</b> <span style="color:#fff;">${dob}</span></div>
                <div><b>Gender:</b> <span style="color:#fff;">${gender}</span></div>
                <div><b>Email:</b> <span style="color:#fff;">${email}</span></div>
            </div>
        </div>
        <div style="margin-top:1.5rem;text-align:center;">
            <button onclick="openExternalLink('https://auth.dkydivyansh.com/dashboard/profile')" style="background:linear-gradient(to right,#6366f1,#4f46e5);color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;font-weight:500;transition:all 0.2s ease;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
                Manage Profile
            </button>
        </div>
    `;
    showPopupBelowHeader({
        title: 'Account Information',
        contentHtml,
        proGlow: false
    });
}
function handleLogoutClick() {
    // Remove any existing popup
    closePopupBelowHeader();

    // Build popup HTML
    const contentHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;min-width:340px;max-width:95vw;">
            <i style="font-size:2.5rem;" class="fad fa-sign-out"></i>
            <div style="font-size:1.3rem;font-weight:600;text-align:center;">Logging out will clear your local data including chat history.<br><span style='color:#f59e42;font-size:1.05rem;'>Long-term memory will <b>not</b> be affected.</span></div>
            <div style="color:#a3a3a3;font-size:1.05rem;text-align:center;">It's a good idea to backup your data before logging out.</div>
            <div style="display:flex;gap:1.2rem;justify-content:center;margin-top:0.5rem;">
                <button id="logout-backup-btn" style="background:linear-gradient(90deg,#6366f1,#4f46e5);color:white;border:none;padding:0.7rem 1.5rem;border-radius:0.7rem;font-weight:500;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.12);">Backup</button>
                <button id="logout-logout-btn" style="background:#ef4444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:0.7rem;font-weight:500;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(239,68,68,0.12);">Logout</button>
            </div>
        </div>
    `;
    showPopupBelowHeader({
        title: 'Logout',
        contentHtml,
        proGlow: false
    });

    // Attach button handlers after popup is rendered
    setTimeout(() => {
        const backupBtn = document.getElementById('logout-backup-btn');
        const logoutBtn = document.getElementById('logout-logout-btn');
        if (backupBtn) {
            backupBtn.onclick = function() {
                // Show loading popup
                const loadingPopup = document.createElement('div');
                loadingPopup.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(4px);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                
                const popupContent = document.createElement('div');
                popupContent.style.cssText = `
                    background: rgba(20, 16, 40, 0.98);
                    border-radius: 14px;
                    padding: 2rem;
                    width: 95vw;
                    max-width: 420px;
                    color: white;
                    text-align: center;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
                `;
                
                popupContent.innerHTML = `
                    <div style="margin-bottom: 1.5rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #6366f1; margin-bottom: 1rem;"></i>
                        <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Creating Backup</h3>
                        <p style="color: var(--text-medium);">Please wait while we prepare your backup...</p>
                    </div>
                `;
                
                loadingPopup.appendChild(popupContent);
                document.body.appendChild(loadingPopup);

                // Call backup function
                if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.backup_data === 'function') {
                    window.pywebview.api.backup_data().then(res => {
                        loadingPopup.remove();
                        
                        if (res && res.success) {
                            // Show success popup with save option
                            const successPopup = document.createElement('div');
                            successPopup.style.cssText = loadingPopup.style.cssText;
                            
                            const successContent = document.createElement('div');
                            successContent.style.cssText = popupContent.style.cssText;
                            
                            successContent.innerHTML = `
                                <div style="margin-bottom: 1.5rem;">
                                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #10b981; margin-bottom: 1rem;"></i>
                                    <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Backup Created</h3>
                                    <p style="color: var(--text-medium);">Your backup is ready to be saved.</p>
                                    <p style="color: red;"> This backup is encrypted with your current account credentials; it will only be restored to the same account.</p>

                                </div>
                                <div style="display: flex; gap: 1rem; justify-content: center;">
                                    <button id="save-backup-btn" style="background: #10b981; color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer;">Save Backup</button>
                                    <button id="close-backup-btn" style="background: rgba(255,255,255,0.1); color: var(--text-light); border: 1px solid rgba(255,255,255,0.2); padding: 0.7rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer;">Close</button>
                                </div>
                            `;
                            
                            successPopup.appendChild(successContent);
                            document.body.appendChild(successPopup);
                            
                            // Handle save button click
                            document.getElementById('save-backup-btn').onclick = function() {
                                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                const filename = `emilyx64_backup_${timestamp}`;
                                
                                if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_file === 'function') {
                                    window.pywebview.api.save_file(filename, res.data).then(saveRes => {
                                        if (saveRes && saveRes.success) {
                                            showToast({ message: 'Backup saved successfully!', type: 'success', duration: 3000 });
                                        } else {
                                            showToast({ message: saveRes.message || 'Failed to save backup.', type: 'error', duration: 4000 });
                                        }
                                        successPopup.remove();
                                    }).catch(err => {
                                        showToast({ message: 'Failed to save backup.', type: 'error', duration: 4000 });
                                        successPopup.remove();
                                    });
                                } else {
                                    showToast({ message: 'Save function not available.', type: 'error', duration: 4000 });
                                    successPopup.remove();
                                }
                            };
                            
                            // Handle close button click
                            document.getElementById('close-backup-btn').onclick = function() {
                                successPopup.remove();
                            };
                        } else {
                            showToast({ 
                                message: res.message || 'Failed to create backup.', 
                                type: 'error', 
                                duration: 4000 
                            });
                        }
                    }).catch(err => {
                        loadingPopup.remove();
                        showToast({ 
                            message: 'Failed to create backup.', 
                            type: 'error', 
                            duration: 4000 
                        });
                    });
                } else {
                    loadingPopup.remove();
                    showToast({ 
                        message: 'Backup function not available.', 
                        type: 'error', 
                        duration: 4000 
                    });
                }
            };
        }
        if (logoutBtn) {
            logoutBtn.onclick = function() {
                showLogoutConfirmationPopup();
            };
        }
    }, 10);
}

function showLogoutConfirmationPopup() {
    // Remove any existing popup
    closePopupBelowHeader();
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: rgba(239, 68, 68, 0.13);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 14px;
        padding: 2rem 2.2rem 1.5rem 2.2rem;
        width: 95vw;
        max-width: 420px;
        color: white;
        text-align: center;
        box-shadow: 0 8px 32px rgba(239,68,68,0.13);
        display: flex;
        flex-direction: column;
        align-items: center;
    `;
    popup.innerHTML = `
        <div style="margin-bottom: 1.2rem;">
            <i class="fas fa-exclamation-triangle" style="color: #ef4444; font-size: 2.2rem; margin-bottom: 0.7rem;"></i>
            <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem; color: #ef4444;">Confirm Logout</h3>
            <p style="color: var(--text-medium); line-height: 1.5;">This will clear all your local data and close the application.<br>Type <b>conform logout</b> below to continue.</p>
        </div>
        <input id="logout-confirm-input" type="text" placeholder="Type: conform logout" style="width:100%;padding:0.7rem 1rem;border-radius:8px;border:1px solid #ef4444;background:rgba(255,255,255,0.08);color:#fff;font-size:1rem;margin-bottom:1.2rem;outline:none;" />
        <div id="logout-confirm-error" style="color:#ef4444;font-size:0.98rem;margin-bottom:1.2rem;display:none;"></div>
        <div style="display:flex;gap:1rem;justify-content:center;">
            <button id="logout-cancel-btn" style="background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Close</button>
            <button id="logout-continue-btn" style="background:#ef4444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Continue</button>
        </div>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    // Button handlers
    document.getElementById('logout-cancel-btn').onclick = () => overlay.remove();
    document.getElementById('logout-continue-btn').onclick = () => {
        const input = document.getElementById('logout-confirm-input').value.trim().toLowerCase();
        const errorDiv = document.getElementById('logout-confirm-error');
        if (input !== 'conform logout') {
            errorDiv.textContent = 'Please type "conform logout" to confirm.';
            errorDiv.style.display = 'block';
            return;
        }
        errorDiv.style.display = 'none';
        // Remove the overlay before showing loading screen
        overlay.remove();
        // Call Python function to clear session and close
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.clear_session_close === 'function') {
            showLoadingWindow('Logging out and clearing data...');
            window.pywebview.api.clear_session_close().then(res => {
                // No need to handle success, app will close
                if (!res.success) {
                    removeLoadingWindow();
                    showToast({ message: res.message || 'Failed to logout.', type: 'error', duration: 4000 });
                }
            }).catch(err => {
                removeLoadingWindow();
                showToast({ message: 'Failed to logout.', type: 'error', duration: 4000 });
            });
        } else {
            showToast({ message: 'Logout function not available.', type: 'error', duration: 4000 });
        }
    };
    document.getElementById('logout-confirm-input').addEventListener('input', function() {
        document.getElementById('logout-confirm-error').style.display = 'none';
    });
}

function handleSettingsClick() {
    const config = window.APP_CONFIG || APP_CONFIG || DEFAULT_CONFIG;
    const userType = (config['user-type'] || 'free').toLowerCase();
    
    const contentHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem 3rem;font-size:1.15rem;">
            <div style="text-align:left;">
                <label for="languageSelect" style="display:block;margin-bottom:0.5rem;color:var(--text-light);">Voice Recognition Language</label>
                <select id="languageSelect" style="width:100%;padding:0.5rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;">
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">Hindi</option>
                    <option value="es-ES">Spanish</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="it-IT">Italian</option>
                    <option value="ja-JP">Japanese</option>
                    <option value="ko-KR">Korean</option>
                    <option value="zh-CN">Chinese (Simplified)</option>
                    <option value="ru-RU">Russian</option>
                    <option value="pt-BR">Portuguese (Brazil)</option>
                    <option value="nl-NL">Dutch</option>
                    <option value="tr-TR">Turkish</option>
                    <option value="pl-PL">Polish</option>
                    <option value="ar-SA">Arabic</option>
                    <option value="he-IL">Hebrew</option>
                    <option value="id-ID">Indonesian</option>
                    <option value="th-TH">Thai</option>
                    <option value="vi-VN">Vietnamese</option>
                    <option value="sv-SE">Swedish</option>
                    <option value="da-DK">Danish</option>
                    <option value="fi-FI">Finnish</option>
                    <option value="el-GR">Greek</option>
                    <option value="cs-CZ">Czech</option>
                    <option value="hu-HU">Hungarian</option>
                    <option value="ro-RO">Romanian</option>
                    <option value="sk-SK">Slovak</option>
                    <option value="uk-UA">Ukrainian</option>
                    <option value="hr-HR">Croatian</option>
                    <option value="bg-BG">Bulgarian</option>
                    <option value="sr-RS">Serbian</option>
                    <option value="sl-SI">Slovenian</option>
                    <option value="et-EE">Estonian</option>
                    <option value="lv-LV">Latvian</option>
                    <option value="lt-LT">Lithuanian</option>
                </select>
            </div>
            <div style="text-align:left;">
                <label for="aiSpeechSelect" style="display:block;margin-bottom:0.5rem;color:var(--text-light);">Enable AI Speech</label>
                <div style="position:relative;">
                    <select id="aiSpeechSelect" style="width:100%;padding:0.5rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;${userType === 'free' ? 'opacity:0.5;pointer-events:none;' : ''}">
                        <option value="true">True</option>
                        <option value="false">False</option>
                    </select>
                    ${userType === 'free' ? '<div style="position:absolute;top:100%;left:0;margin-top:0.5rem;color:#ffd700;font-size:0.9rem;">Available with Pro subscription</div>' : ''}
                </div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2rem;">
            <button id="viewEditAppBtn" style="background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">View/Edit App Opening</button>
            <button id="manageHaBtn" style="background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Manage Home Assistant</button>
            <button id="restoreDataBtn" style="background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Restore Data</button>
            <button id="saveSettingsBtn" style="background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Save Changes</button>
        </div>
    `;

    showPopupBelowHeader({
        title: 'Settings',
        contentHtml,
        proGlow: userType === 'PRO'
    });

    // Set initial values
    document.getElementById('languageSelect').value = userLang;
    document.getElementById('aiSpeechSelect').value = String(isvoiseactive);

    // Add save button handler
    document.getElementById('saveSettingsBtn').onclick = saveSettings;
    // Add view/edit app button handler
    document.getElementById('viewEditAppBtn').onclick = showAppListPopup;
    // Add manage Home Assistant button handler
    document.getElementById('manageHaBtn').onclick = showHomeAssistantPopup;
    // Add restore data button handler
    document.getElementById('restoreDataBtn').onclick = handleRestoreDataClick;
}

// --- App Opening Management Logic ---

function showAppListPopup() {
    // Show loading while fetching
    showLoadingWindow('Loading app list...');
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_app_data === 'function') {
        window.pywebview.api.get_app_data()
            .then(data => {
                removeLoadingWindow();
                let appList = null;
                try {
                    appList = data ? JSON.parse(data) : null;
                } catch (e) {
                    appList = null;
                }
                if (!appList || !Array.isArray(appList.apps) || appList.apps.length === 0) {
                    showPopupBelowHeader({
                        title: 'App Opening List',
                        contentHtml: `<div style=\"padding:2rem;text-align:center;\"><div style='color:#ffd700;margin-bottom:1rem;'>No apps found. Start by adding an app. Click on <b>Edit</b>.</div><button id='editAppListBtn' style='margin-top:1.5rem;background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Add New</button></div>`,
                        onClose: closePopupBelowHeader
                    });
                    setTimeout(() => {
                        const btn = document.getElementById('editAppListBtn');
                        if (btn) {
                            btn.onclick = () => { console.log('[App Validation] Edit/Add button clicked (empty list)'); showAppEditPopup({apps:[]}); };
                            console.log('[App Validation] editAppListBtn handler attached (empty list)');
                        } else {
                            console.error('[App Validation] editAppListBtn not found (empty list)');
                        }
                    }, 100);
                } else {
                    // Render app list
                    let html = `<div style='max-height:60vh;overflow:auto;'>`;
                    html += `<table style='width:100%;border-collapse:collapse;'>`;
                    html += `<thead><tr><th style='text-align:left;padding:8px;'>Name</th><th style='text-align:left;padding:8px;'>Path</th><th style='text-align:left;padding:8px;'>Arguments</th><th style='padding:8px;'>Test</th></tr></thead><tbody>`;
                    for (const app of appList.apps) {
                        html += `<tr>
                            <td style='padding:8px;'>${escapeHtml(app.name)}</td>
                            <td style='padding:8px;'>${escapeHtml(app.path)}</td>
                            <td style='padding:8px;'>${Array.isArray(app.arguments) ? app.arguments.map(escapeHtml).join(' ') : ''}</td>
                            <td style='padding:8px;'><button class='testAppBtn' data-code='${app.code}' style='background:#222;color:white;border:none;padding:0.3rem 1rem;border-radius:6px;cursor:pointer;'>Test</button></td>
                        </tr>`;
                    }
                    html += `</tbody></table></div>`;
                    html += `<div style='display:flex;justify-content:flex-end;margin-top:1.5rem;'><button id='editAppListBtn' style='background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Edit</button></div>`;
                    showPopupBelowHeader({
                        title: 'App Opening List',
                        contentHtml: html,
                        onClose: closePopupBelowHeader
                    });
                    setTimeout(() => {
                        const btn = document.getElementById('editAppListBtn');
                        if (btn) {
                            btn.onclick = () => { console.log('[App Validation] Edit button clicked (app list)'); showAppEditPopup(appList); };
                            console.log('[App Validation] editAppListBtn handler attached (app list)');
                        } else {
                            console.error('[App Validation] editAppListBtn not found (app list)');
                        }
                        document.querySelectorAll('.testAppBtn').forEach(btn => {
                            btn.onclick = function() {
                                const code = this.getAttribute('data-code');
                                const app = appList.apps.find(a => a.code === code);
                                if (app) testAppLaunch(app);
                            };
                        });
                    }, 100);
                }
            })
            .catch(err => {
                removeLoadingWindow();
                showToast({message:'Failed to load app list',type:'error'});
            });
    } else {
        removeLoadingWindow();
        showToast({message:'Backend not available',type:'error'});
    }
}

function showAppEditPopup(appList) {
    console.log('[App Validation] showAppEditPopup called with:', appList);
    // Deep copy to avoid mutating original until save
    let editingList = JSON.parse(JSON.stringify(appList));
    if (!Array.isArray(editingList.apps)) editingList.apps = [];
    let changed = false;
    function render() {
        console.log('[App Validation] render() called in showAppEditPopup. Current editingList:', editingList);
        // Before rendering, update editingList with current DOM values to preserve edits
        for (let i = 0; i < editingList.apps.length; ++i) {
            const nameInput = document.querySelector(`.editAppName[data-idx='${i}']`);
            const pathInput = document.querySelector(`.editAppPath[data-idx='${i}']`);
            const argsInput = document.querySelector(`.editAppArgs[data-idx='${i}']`);
            if (nameInput) editingList.apps[i].name = nameInput.value;
            if (pathInput) editingList.apps[i].path = pathInput.value;
            if (argsInput) {
                let argsStr = argsInput.value.trim();
                editingList.apps[i].arguments = argsStr ? argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
            }
        }
        let html = `<div style='max-height:60vh;overflow:auto;'>`;
        html += `<div style='background:#222;color:#ffd700;padding:10px 16px;border-radius:8px;margin-bottom:12px;font-size:0.98rem;'>
            <b>Note:</b> App name is <b>required</b>, must be <b>unique</b>, and can only contain <b>capital letters (A-Z)</b>, <b>numbers (0-9)</b>, and <b>underscores (_)</b>.
        </div>`;
        html += `<table style='width:100%;border-collapse:collapse;'>`;
        html += `<thead><tr><th style='text-align:left;padding:8px;'>Name</th><th style='text-align:left;padding:8px;'>Path</th><th style='text-align:left;padding:8px;'>Arguments</th><th style='padding:8px;'>Test</th><th style='padding:8px;'>Delete</th></tr></thead><tbody>`;
        for (let i = 0; i < editingList.apps.length; ++i) {
            const app = editingList.apps[i];
            html += `<tr>
                <td style='padding:8px;'><input type='text' maxlength='20' value='${escapeHtml(app.name)}' data-idx='${i}' class='editAppName' style='width:120px;background:#111;color:#fff;border:1px solid #444;border-radius:5px;padding:4px;'/></td>
                <td style='padding:8px;'><input type='text' value='${escapeHtml(app.path)}' data-idx='${i}' class='editAppPath' style='width:220px;background:#111;color:#fff;border:1px solid #444;border-radius:5px;padding:4px;'/></td>
                <td style='padding:8px;'><input type='text' value='${Array.isArray(app.arguments) ? app.arguments.map(escapeHtml).join(' ') : ''}' data-idx='${i}' class='editAppArgs' style='width:120px;background:#111;color:#fff;border:1px solid #444;border-radius:5px;padding:4px;' placeholder='Optional'/></td>
                <td style='padding:8px;'><button class='testAppBtn' data-idx='${i}' style='background:#222;color:white;border:none;padding:0.3rem 1rem;border-radius:6px;cursor:pointer;'>Test</button></td>
                <td style='padding:8px;'><button class='deleteAppBtn' data-idx='${i}' style='background:#c00;color:white;border:none;padding:0.3rem 1rem;border-radius:6px;cursor:pointer;'>Delete</button></td>
            </tr>`;
        }
        html += `</tbody></table></div>`;
        html += `<div style='display:flex;justify-content:space-between;margin-top:1.5rem;gap:1rem;'>
            <div><button id='backToAppListBtn' style='background:#444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Back</button></div>
            <div>
                <button id='addAppBtn' style='background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Add App</button>
                <button id='saveAppListBtn' style='background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;margin-left:0.5rem;'>Save</button>
            </div>
        </div>`;
        showPopupBelowHeader({
            title: 'Edit App Opening List',
            contentHtml: html,
            onClose: closePopupBelowHeader
        });
        setTimeout(() => {
            document.getElementById('backToAppListBtn').onclick = () => showAppListPopup();
            document.getElementById('addAppBtn').onclick = () => {
                // Before adding, update current values
                for (let i = 0; i < editingList.apps.length; ++i) {
                    const nameInput = document.querySelector(`.editAppName[data-idx='${i}']`);
                    const pathInput = document.querySelector(`.editAppPath[data-idx='${i}']`);
                    const argsInput = document.querySelector(`.editAppArgs[data-idx='${i}']`);
                    if (nameInput) editingList.apps[i].name = nameInput.value;
                    if (pathInput) editingList.apps[i].path = pathInput.value;
                    if (argsInput) {
                        let argsStr = argsInput.value.trim();
                        editingList.apps[i].arguments = argsStr ? argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
                    }
                }
                if (editingList.apps.length >= 20) {
                    showToast({message:'Maximum 20 apps allowed',type:'warning'}); return;
                }
                const newCode = Math.random().toString().slice(2,8);
                editingList.apps.push({name:'',code:newCode,path:'',arguments:[]});
                changed = true;
                render();
            };
            document.getElementById('saveAppListBtn').onclick = () => {
                console.log('[App Validation] Save button clicked');
                // Before validating, update all current values
                for (let i = 0; i < editingList.apps.length; ++i) {
                    const nameInput = document.querySelector(`.editAppName[data-idx='${i}']`);
                    const pathInput = document.querySelector(`.editAppPath[data-idx='${i}']`);
                    const argsInput = document.querySelector(`.editAppArgs[data-idx='${i}']`);
                    if (nameInput) editingList.apps[i].name = nameInput.value;
                    if (pathInput) editingList.apps[i].path = pathInput.value;
                    if (argsInput) {
                        let argsStr = argsInput.value.trim();
                        editingList.apps[i].arguments = argsStr ? argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
                    }
                }
                // Validation
                let valid = true;
                let errorMsg = '';
                const nameSet = new Set();
                for (let i = 0; i < editingList.apps.length; ++i) {
                    const app = editingList.apps[i];
                    // Name required
                    if (!app.name) {
                        valid = false;
                        errorMsg = `App #${i+1}: Name is required.`;
                        console.error(`[App Validation] Error: Missing name for app at index ${i}`, app);
                        break;
                    }
                    // Name format: only A-Z, 0-9, _
                    if (!/^[A-Z0-9_]+$/.test(app.name)) {
                        valid = false;
                        errorMsg = `App #${i+1}: Name must use only capital letters (A-Z), numbers (0-9), and underscores (_).`;
                        console.error(`[App Validation] Error: Invalid name format at index ${i}`, app);
                        break;
                    }
                    // No duplicate names
                    if (nameSet.has(app.name)) {
                        valid = false;
                        errorMsg = `App #${i+1}: Duplicate app name '${app.name}' is not allowed.`;
                        console.error(`[App Validation] Error: Duplicate name at index ${i}`, app);
                        break;
                    }
                    nameSet.add(app.name);
                    // Path required
                    if (!app.path) {
                        valid = false;
                        errorMsg = `App #${i+1}: Path is required.`;
                        console.error(`[App Validation] Error: Missing path for app at index ${i}`, app);
                        break;
                    }
                    // Log each app's path for debugging
                    console.log(`[App Validation] App #${i+1} path:`, app.path);
                }
                if (!valid) {
                    console.error(`[App Validation] Validation failed. Error: ${errorMsg}`);
                    showToast({message: errorMsg || 'Please fill all fields (name and path required)',type:'error'});
                    return;
                }
                if (editingList.apps.length > 20) {
                    console.error('[App Validation] Too many apps:', editingList.apps.length);
                    showToast({message:'Maximum 20 apps allowed',type:'warning'}); return;
                }
                // Check if changed
                if (JSON.stringify(editingList) === JSON.stringify(appList)) {
                    console.log('[App Validation] No changes made.');
                    showToast({message:'No changes made',type:'info'}); closePopupBelowHeader(); return;
                }
                // Log the final list before saving
                console.log('[App Validation] Submitting app list:', editingList);
                // Confirm and save
                showConfirmAppSave(editingList);
                console.log('[App Validation] Save handler completed');
            };
            document.querySelectorAll('.deleteAppBtn').forEach(btn => {
                btn.onclick = function() {
                    // Before deleting, update current values
                    for (let i = 0; i < editingList.apps.length; ++i) {
                        const nameInput = document.querySelector(`.editAppName[data-idx='${i}']`);
                        const pathInput = document.querySelector(`.editAppPath[data-idx='${i}']`);
                        const argsInput = document.querySelector(`.editAppArgs[data-idx='${i}']`);
                        if (nameInput) editingList.apps[i].name = nameInput.value;
                        if (pathInput) editingList.apps[i].path = pathInput.value;
                        if (argsInput) {
                            let argsStr = argsInput.value.trim();
                            editingList.apps[i].arguments = argsStr ? argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
                        }
                    }
                    const idx = parseInt(this.getAttribute('data-idx'));
                    editingList.apps.splice(idx,1);
                    changed = true;
                    render();
                };
            });
            document.querySelectorAll('.testAppBtn').forEach(btn => {
                btn.onclick = function() {
                    // Before testing, update current values
                    for (let i = 0; i < editingList.apps.length; ++i) {
                        const nameInput = document.querySelector(`.editAppName[data-idx='${i}']`);
                        const pathInput = document.querySelector(`.editAppPath[data-idx='${i}']`);
                        const argsInput = document.querySelector(`.editAppArgs[data-idx='${i}']`);
                        if (nameInput) editingList.apps[i].name = nameInput.value;
                        if (pathInput) editingList.apps[i].path = pathInput.value;
                        if (argsInput) {
                            let argsStr = argsInput.value.trim();
                            editingList.apps[i].arguments = argsStr ? argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
                        }
                    }
                    const idx = parseInt(this.getAttribute('data-idx'));
                    const app = editingList.apps[idx];
                    console.log('[App Validation] Test button clicked for app:', app);
                    if (app) testAppLaunch(app);
                };
            });
            // Responsive name input: uppercase and allowed chars only
            document.querySelectorAll('.editAppName').forEach(input => {
                input.addEventListener('input', function() {
                    let val = this.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                    if (val.length > 20) val = val.slice(0, 20);
                    if (this.value !== val) this.value = val;
                });
            });
            console.log('[App Validation] Rendered app edit table. Current editingList:', editingList);
        }, 100);
    }
    render();
}

function showConfirmAppSave(newList) {
    // Confirm popup
    const overlay = document.createElement('div');
    overlay.id = 'app-save-confirm-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);align-items:center;justify-content:center;display:flex;`;
    const popup = document.createElement('div');
    popup.style.cssText = `background:rgba(20,16,40,0.98);border-radius:18px;padding:2rem 2.5rem;min-width:320px;max-width:90vw;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;`;
    popup.innerHTML = `<div style='font-size:1.2rem;font-weight:600;margin-bottom:1.2rem;text-align:center;'>Save App List?</div><div style='font-size:1.05rem;line-height:1.6;text-align:center;margin-bottom:2rem;'>After saving, the application will restart.</div><div style='display:flex;gap:1.5rem;justify-content:center;'><button id='app-save-cancel' style='background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Cancel</button><button id='app-save-continue' style='background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;'>Save</button></div>`;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    document.getElementById('app-save-cancel').onclick = () => overlay.remove();
    document.getElementById('app-save-continue').onclick = () => {
        overlay.remove();
        showLoadingWindow('Saving app list and restarting...');
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_app_data === 'function') {
            window.pywebview.api.save_app_data(JSON.stringify(newList))
                .then(res => {
                    // The app will restart, so no need to do anything else
                })
                .catch(err => {
                    removeLoadingWindow();
                    showToast({message:'Failed to save app list',type:'error'});
                });
        } else {
            removeLoadingWindow();
            showToast({message:'Backend not available',type:'error'});
        }
    };
}

function testAppLaunch(app) {
    if (!app || !app.path || !app.path.toLowerCase().endsWith('.exe')) {
        showToast({message:'Invalid app path',type:'error'}); return;
    }
    showLoadingWindow('Testing app launch...');
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.launch_hidden === 'function') {
        window.pywebview.api.launch_hidden(app.path, app.arguments || [])
            .then(res => {
                removeLoadingWindow();
                if (res === true || (res && res.success !== false)) {
                    showToast({message:'App launched (check your screen)',type:'success'});
                } else {
                    showToast({message:'Failed to launch app',type:'error'});
                }
            })
            .catch(err => {
                removeLoadingWindow();
                showToast({message:'Failed to launch app',type:'error'});
            });
    } else {
        removeLoadingWindow();
        showToast({message:'Backend not available',type:'error'});
    }
}

// --- Home Assistant Management Logic ---

async function isHomeAssistantUp(baseUrl, token) {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/`;
    try {
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            method: 'GET',
        });
        return r.ok;
    } catch (err) {
        console.error('Health‑check failed:', err);
        return false;
    }
}

function showHomeAssistantPopup() {
    showLoadingWindow('Loading Home Assistant data...');
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_ha_data === 'function') {
        window.pywebview.api.get_ha_data()
            .then(data => {
                removeLoadingWindow();
                let haData = null;
                let haEnabled = Boolean(data.ha_enabled);
                
                try {
                    haData = data.ha_data ? JSON.parse(data.ha_data) : null;
                } catch (e) {
                    haData = null;
                }
                
                if (haEnabled && haData) {
                    // Show manage interface for enabled HA
                    showHomeAssistantManagePopup(haData);
                } else {
                    // Show setup interface for disabled/not configured HA
                    showHomeAssistantSetupPopup(haData);
                }
            })
            .catch(err => {
                removeLoadingWindow();
                showToast({message:'Failed to load Home Assistant data',type:'error'});
            });
    } else {
        removeLoadingWindow();
        showToast({message:'Backend not available',type:'error'});
    }
}

function showHomeAssistantSetupPopup(existingData) {
    const contentHtml = `
        <div style="text-align:left;padding:1rem;">
            <div style="margin-bottom:1.5rem;">
                <label for="haUrlInput" style="display:block;margin-bottom:0.5rem;color:var(--text-light);">Home Assistant Base URL</label>
                <input type="text" id="haUrlInput" placeholder="http://192.168.1.2:8123" 
                       value="${existingData ? escapeHtml(existingData.url || '') : ''}"
                       style="width:100%;padding:0.7rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;margin-bottom:1rem;">
                <div style="font-size:0.9rem;color:#888;margin-bottom:1rem;">
                    Enter the full URL including protocol (http:// or https://). If you don't include the protocol, https:// will be automatically added.
                </div>
            </div>
            <div style="margin-bottom:1.5rem;">
                <label for="haTokenInput" style="display:block;margin-bottom:0.5rem;color:var(--text-light);">Long-lived Access Token</label>
                <input type="password" id="haTokenInput" placeholder="Enter your Home Assistant token" 
                       value="${existingData ? escapeHtml(existingData.token || '') : ''}"
                       style="width:100%;padding:0.7rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;">
                <div style="font-size:0.9rem;color:#888;margin-top:0.5rem;">
                    You can create a long-lived access token in your Home Assistant profile settings.
                </div>
            </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2rem;gap:1rem;">
            <button id="haBackBtn" style="background:#444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Back</button>
            <button id="haTestSetupBtn" style="background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Test Connection</button>
            <button id="haEnableBtn" style="background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Enable Home Assistant</button>
        </div>
    `;

    showPopupBelowHeader({
        title: 'Setup Home Assistant',
        contentHtml,
        onClose: closePopupBelowHeader
    });

    setTimeout(() => {
        document.getElementById('haBackBtn').onclick = () => closePopupBelowHeader();
        document.getElementById('haTestSetupBtn').onclick = () => testHomeAssistantSetupConnection();
        document.getElementById('haEnableBtn').onclick = () => enableHomeAssistant();
    }, 100);
}

function showHomeAssistantManagePopup(haData) {
    const contentHtml = `
        <div style="text-align:left;padding:1rem;">
            <div style="background:#222;color:#4ade80;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">
                <strong>✓ Home Assistant is currently enabled</strong><br>
                URL: ${escapeHtml(haData.url)}<br>
                Token: ${escapeHtml(haData.token.substring(0, 10))}...
            </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2rem;gap:1rem;">
            <button id="haBackBtn" style="background:#444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Back</button>
            <button id="haTestManageBtn" style="background:#222;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Test Connection</button>
            <button id="haDisableBtn" style="background:#dc2626;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Disable Home Assistant</button>
        </div>
    `;

    showPopupBelowHeader({
        title: 'Manage Home Assistant',
        contentHtml,
        onClose: closePopupBelowHeader
    });

    setTimeout(() => {
        document.getElementById('haBackBtn').onclick = () => closePopupBelowHeader();
        document.getElementById('haTestManageBtn').onclick = () => testHomeAssistantConnection();
        document.getElementById('haDisableBtn').onclick = () => showDisableHomeAssistantConfirmation();
    }, 100);
}

async function enableHomeAssistant() {
    const urlInput = document.getElementById('haUrlInput');
    const tokenInput = document.getElementById('haTokenInput');
    
    let url = urlInput.value.trim();
    const token = tokenInput.value.trim();
    
    if (!url || !token) {
        showToast({message:'Please fill in both URL and token fields',type:'error'});
        return;
    }
    
    // Auto-add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    showLoadingWindow('Testing Home Assistant connection...');
    
    try {
        const isUp = await isHomeAssistantUp(url, token);
        removeLoadingWindow();
        
        if (isUp) {
            showHomeAssistantRestartConfirmation(url, token, true);
        } else {
            showToast({message:'Failed to connect to Home Assistant. Please check your URL and token.',type:'error'});
        }
    } catch (error) {
        removeLoadingWindow();
        showToast({message:'Error testing connection: ' + error.message,type:'error'});
    }
}

async function testHomeAssistantSetupConnection() {
    // Get values from input fields in setup mode
    const urlInput = document.getElementById('haUrlInput');
    const tokenInput = document.getElementById('haTokenInput');
    
    let url = urlInput.value.trim();
    const token = tokenInput.value.trim();
    
    if (!url || !token) {
        showToast({message:'Please fill in both URL and token fields before testing',type:'error'});
        return;
    }
    
    // Auto-add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    showLoadingWindow('Testing Home Assistant connection...');
    
    try {
        const isUp = await isHomeAssistantUp(url, token);
        removeLoadingWindow();
        
        if (isUp) {
            showToast({message:'Connection successful! Your Home Assistant is accessible.',type:'success'});
        } else {
            showToast({message:'Failed to connect to Home Assistant. Please check your URL and token.',type:'error'});
        }
    } catch (error) {
        removeLoadingWindow();
        showToast({message:'Error testing connection: ' + error.message,type:'error'});
    }
}

async function testHomeAssistantConnection() {
    // Get HA data from backend since we're in manage mode
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_ha_data === 'function') {
        try {
            const data = await window.pywebview.api.get_ha_data();
            let haData = null;
            
            try {
                haData = data.ha_data ? JSON.parse(data.ha_data) : null;
            } catch (e) {
                haData = null;
            }
            
            if (!haData || !haData.url || !haData.token) {
                showToast({message:'No Home Assistant configuration found',type:'error'});
                return;
            }
            
            let url = haData.url.trim();
            const token = haData.token.trim();
            
            // Auto-add https:// if no protocol specified
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            showLoadingWindow('Testing Home Assistant connection...');
            
            try {
                const isUp = await isHomeAssistantUp(url, token);
                removeLoadingWindow();
                
                if (isUp) {
                    showToast({message:'Connection successful!',type:'success'});
                } else {
                    showToast({message:'Failed to connect to Home Assistant. Please check your configuration.',type:'error'});
                }
            } catch (error) {
                removeLoadingWindow();
                showToast({message:'Error testing connection: ' + error.message,type:'error'});
            }
        } catch (error) {
            showToast({message:'Error getting Home Assistant data: ' + error.message,type:'error'});
        }
    } else {
        showToast({message:'Backend not available',type:'error'});
    }
}

function showHomeAssistantRestartConfirmation(url, token, enable) {
    const action = enable ? 'enable' : 'disable';
    const contentHtml = `
        <div style="text-align:center;padding:2rem;">
            <div style="color:#4ade80;font-size:2rem;margin-bottom:1rem;">✓</div>
            <h3 style="margin-bottom:1rem;">Home Assistant ${enable ? 'Enabled' : 'Disabled'}</h3>
            <p style="margin-bottom:2rem;color:#888;">
                ${enable ? 
                    'Your Home Assistant integration has been successfully configured and tested. The application will restart to apply the changes.' :
                    'Home Assistant integration will be disabled. The application will restart to apply the changes.'
                }
            </p>
        </div>
        <div style="display:flex;justify-content:center;gap:1rem;margin-top:2rem;">
            <button id="haContinueBtn" style="background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Continue</button>
            <button id="haCancelBtn" style="background:#444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Cancel</button>
        </div>
    `;

    showPopupBelowHeader({
        title: `Home Assistant ${enable ? 'Enabled' : 'Disabled'}`,
        contentHtml,
        onClose: closePopupBelowHeader
    });

    setTimeout(() => {
        document.getElementById('haContinueBtn').onclick = () => {
            showLoadingWindow('Saving Home Assistant configuration...');
            const haData = JSON.stringify({url, token});
            
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_ha_data === 'function') {
                window.pywebview.api.save_ha_data(haData, enable)
                    .then(result => {
                        if (result.success) {
                            showToast({message:'Home Assistant configuration saved successfully',type:'success'});
                        } else {
                            removeLoadingWindow();
                            showToast({message:'Failed to save configuration: ' + result.message,type:'error'});
                        }
                    })
                    .catch(err => {
                        removeLoadingWindow();
                        showToast({message:'Error saving configuration: ' + err,type:'error'});
                    });
            } else {
                removeLoadingWindow();
                showToast({message:'Backend not available',type:'error'});
            }
        };
        document.getElementById('haCancelBtn').onclick = () => closePopupBelowHeader();
    }, 100);
}

function showDisableHomeAssistantConfirmation() {
    const contentHtml = `
        <div style="text-align:center;padding:2rem;">
            <div style="color:#fbbf24;font-size:2rem;margin-bottom:1rem;">⚠</div>
            <h3 style="margin-bottom:1rem;">Disable Home Assistant?</h3>
            <p style="margin-bottom:2rem;color:#888;">
                Are you sure you want to disable Home Assistant integration? This will remove the ability to control your smart home devices through Emily AI.
            </p>
        </div>
        <div style="display:flex;justify-content:center;gap:1rem;margin-top:2rem;">
            <button id="haDisableConfirmBtn" style="background:#dc2626;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Disable</button>
            <button id="haDisableCancelBtn" style="background:#444;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Cancel</button>
        </div>
    `;

    showPopupBelowHeader({
        title: 'Disable Home Assistant',
        contentHtml,
        onClose: closePopupBelowHeader
    });

    setTimeout(() => {
        document.getElementById('haDisableConfirmBtn').onclick = () => {
            showLoadingWindow('Disabling Home Assistant...');
            
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.save_ha_data === 'function') {
                window.pywebview.api.save_ha_data('', false)
                    .then(result => {
                        if (result.success) {
                            showToast({message:'Home Assistant disabled successfully',type:'success'});
                        } else {
                            removeLoadingWindow();
                            showToast({message:'Failed to disable: ' + result.message,type:'error'});
                        }
                    })
                    .catch(err => {
                        removeLoadingWindow();
                        showToast({message:'Error disabling: ' + err,type:'error'});
                    });
            } else {
                removeLoadingWindow();
                showToast({message:'Backend not available',type:'error'});
            }
        };
        document.getElementById('haDisableCancelBtn').onclick = () => closePopupBelowHeader();
    }, 100);
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c];
    });
}

function closeSettingsWindow() {
    closePopupBelowHeader();
}

function saveSettings() {
    const languageSelect = document.getElementById('languageSelect');
    const newLang = languageSelect.value;
    
    const aiSpeechSelect = document.getElementById('aiSpeechSelect');
    const newAiSpeechValue = aiSpeechSelect.value; // This will be "true" or "false" string
    const newAiSpeechActive = newAiSpeechValue === 'true'; // Convert to boolean

    let settingsChanged = false;

    // Check if language has changed
    if (newLang !== userLang) {
        settingsChanged = true;
        console.log("Language change detected from ", userLang, " to ", newLang);
    }
    // Check AI speech setting
    if (newAiSpeechActive !== isvoiseactive) {
        settingsChanged = true;
        console.log("AI Speech change detected from ", isvoiseactive, " to ", newAiSpeechActive);
    }

    if (settingsChanged) {
        showSettingsChangeConfirmPopup(newLang, newAiSpeechActive);
    } else {
        closeSettingsWindow(); // No changes, just close
        console.log("No settings changed. Closing settings window.");
    }
}

function showSettingsChangeConfirmPopup(newLang, newAiSpeechActive) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'settings-confirm-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index:2000;
        background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); align-items:center; justify-content:center;
        display:flex;
    `;

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'settings-confirm-popup';
    popup.style.cssText = `
        background:rgba(20,16,40,0.98); border-radius:18px; padding:2rem 2.5rem; min-width:320px; max-width:90vw;
        color:#fff; box-shadow:0 8px 32px rgba(0,0,0,0.25); display:flex; flex-direction:column; align-items:center;
    `;

    // Create popup content
    popup.innerHTML = `
        <div style="font-size:1.2rem;font-weight:600;margin-bottom:1.2rem;text-align:center;">Confirm Settings Change?</div>
        <div id="lang-confirm-message" style="font-size:1.05rem;line-height:1.6;text-align:center;margin-bottom:2rem;">Are you sure you want to change the Settings? This will affect immediately.</div>
        <div style="display:flex;gap:1.5rem;justify-content:center;">
            <button id="settings-confirm-cancel" style="background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Cancel</button>
            <button id="settings-confirm-continue" style="background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Continue</button>
        </div>
    `;

    // Add popup to overlay
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Function to remove the popup
    const removePopup = () => {
        const existingOverlay = document.getElementById('settings-confirm-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    };

    // Cancel button handler
    document.getElementById('settings-confirm-cancel').addEventListener('click', function() {
        // Reset select values to original
        document.getElementById('languageSelect').value = userLang;
        document.getElementById('aiSpeechSelect').value = String(isvoiseactive);
        removePopup();
        console.log("Settings change cancelled. UI reset to original values.");
    });

    // Continue button handler
    document.getElementById('settings-confirm-continue').addEventListener('click', async function() {
        try {
            let changesMade = false;

            // Update language if changed
            if (newLang !== userLang) {
                console.log("Applying language change to:", newLang);
                updateVoiceLanguage(newLang);
                if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.add_record === 'function') {
                    await window.pywebview.api.add_record('userLang', newLang);
                    showToast({
                        message: 'Voice recognition language updated successfully',
                        type: 'success',
                        duration: 3000
                    });
                    changesMade = true;
                }
            }

            // Update AI Speech setting if changed
            if (newAiSpeechActive !== isvoiseactive) {
                console.log("Applying AI Speech change to:", newAiSpeechActive);
                if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.add_record === 'function') {
                    await window.pywebview.api.add_record('isvoiseactive', String(newAiSpeechActive));
                    isvoiseactive = newAiSpeechActive;
                    showToast({
                        message: `AI Speech ${newAiSpeechActive ? 'enabled' : 'disabled'} successfully`,
                        type: 'success',
                        duration: 3000
                    });
                    changesMade = true;
                }
            }

            if (changesMade) {
                showToast({
                    message: 'Settings updated successfully',
                    type: 'success',
                    duration: 3000
                });
            }
        } catch (err) {
            console.error("Error saving settings:", err);
            showToast({
                message: 'Error saving settings',
                type: 'error',
                duration: 4000
            });
        } finally {
            removePopup();
            closeSettingsWindow();
            console.log("Settings confirmation closed.");
        }
    });
}

// New function to update AI speech setting
function updateAiSpeechSetting(newValue) {
    isvoiseactive = newValue;
    console.log("Attempting to save isvoiseactive to backend:", String(newValue));
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.add_record === 'function') {
        // Store as string 'True' or 'False' in backend
        window.pywebview.api.add_record('isvoiseactive', String(newValue))
            .then(res => {
                console.log("Backend add_record for isvoiseactive response:", res);
                if (res && res.success) {
                    showToast({
                        message: `AI Speech ${newValue ? 'enabled' : 'disabled'} successfully`,
                        type: 'success',
                        duration: 3000
                    });
                } else {
                    showToast({
                        message: `Failed to save AI Speech setting: ${res?.message || 'Unknown error'}`,
                        type: 'error',
                        duration: 4000
                    });
                }
            })
            .catch(err => {
                console.error("Error calling add_record for isvoiseactive:", err);
                showToast({
                    message: 'Error saving AI Speech setting.',
                    type: 'error',
                    duration: 4000
                });
            });
    }
    console.log('AI Speech setting updated to:', newValue);
}

// --- Restore Data Functionality ---

function handleRestoreDataClick() {
    // Show confirmation popup first
    const contentHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;min-width:340px;max-width:95vw;">
            <i style="font-size:2.5rem;" class="fad fa-upload"></i>
            <div style="font-size:1.3rem;font-weight:600;text-align:center;">Restore Chat History</div>
            <div style="color:#a3a3a3;font-size:1.05rem;text-align:center;">
                This will replace your current chat history with the backup data.<br>
                <span style='color:#f59e42;font-size:1.05rem;'>Current chat history will be lost.</span>
            </div>
            <div style="color:#a3a3a3;font-size:1.05rem;text-align:center;">
                Only .emily_bp files created with your current account can be restored.
            </div>
            <div style="display:flex;gap:1.2rem;justify-content:center;margin-top:0.5rem;">
                <button id="restore-confirm-btn" style="background:linear-gradient(90deg,#6366f1,#4f46e5);color:white;border:none;padding:0.7rem 1.5rem;border-radius:0.7rem;font-weight:500;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.12);">Select Backup File</button>
                <button id="restore-cancel-btn" style="background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:0.7rem;font-weight:500;cursor:pointer;transition:all 0.2s;">Cancel</button>
            </div>
        </div>
    `;
    
    showPopupBelowHeader({
        title: 'Restore Data',
        contentHtml,
        proGlow: false
    });

    // Attach button handlers after popup is rendered
    setTimeout(() => {
        const confirmBtn = document.getElementById('restore-confirm-btn');
        const cancelBtn = document.getElementById('restore-cancel-btn');
        
        if (confirmBtn) {
            confirmBtn.onclick = function() {
                openRestoreFileDialog();
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                closePopupBelowHeader();
            };
        }
    }, 10);
}

function openRestoreFileDialog() {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.open_restore_file_dialog === 'function') {
        try {
            window.pywebview.api.open_restore_file_dialog();
        } catch (error) {
            console.error('Error opening restore file dialog:', error);
            showToast({ 
                message: 'Error opening file dialog: ' + error.message, 
                type: 'error', 
                duration: 4000 
            });
        }
    } else {
        showToast({ 
            message: 'Restore function not available.', 
            type: 'error', 
            duration: 4000 
        });
    }
}

function handleRestoreFileSelect(filePath) {
    console.log('handleRestoreFileSelect called with:', filePath);
    
    // Close the restore data window first
    closePopupBelowHeader();
    
    if (!filePath) {
        // User cancelled file selection
        console.log('No file path provided, user cancelled');
        return;
    }
    
    // Show loading popup
    const loadingPopup = document.createElement('div');
    loadingPopup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
        background: rgba(20, 16, 40, 0.98);
        border-radius: 14px;
        padding: 2rem;
        width: 95vw;
        max-width: 420px;
        color: white;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    `;
    
    popupContent.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #6366f1; margin-bottom: 1rem;"></i>
            <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Restoring Data</h3>
            <p style="color: var(--text-medium);">Please wait while we restore your backup...</p>
        </div>
    `;
    
    loadingPopup.appendChild(popupContent);
    document.body.appendChild(loadingPopup);

    // Call restore function
    console.log('Calling restore_data with filePath:', filePath);
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.restore_data === 'function') {
        window.pywebview.api.restore_data(filePath).then(res => {
            loadingPopup.remove();
            
            if (res && res.success) {
                // Show success popup
                const successPopup = document.createElement('div');
                successPopup.style.cssText = loadingPopup.style.cssText;
                
                const successContent = document.createElement('div');
                successContent.style.cssText = popupContent.style.cssText;
                
                successContent.innerHTML = `
                    <div style="margin-bottom: 1.5rem;">
                        <i class="fas fa-check-circle" style="font-size: 2rem; color: #10b981; margin-bottom: 1rem;"></i>
                        <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Restore Successful</h3>
                        <p style="color: var(--text-medium);">${res.message}</p>
                        <p style="color: #10b981; font-weight: 500;">${res.restored_count} chat interactions restored.</p>
                        <p style="color: #f59e42; font-size: 0.95rem; margin-top: 1rem;">
                            <i class="fas fa-info-circle"></i> The application will restart to apply the restored data.
                        </p>
                    </div>
                    <div style="display: flex; justify-content: center;">
                        <button id="restore-success-ok" style="background: #10b981; color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer;">Continue</button>
                    </div>
                `;
                
                successPopup.appendChild(successContent);
                document.body.appendChild(successPopup);
                
                // Handle OK button click
                document.getElementById('restore-success-ok').onclick = function() {
                    successPopup.remove();
                    // Show loading window with restart message
                    showLoadingWindow('Restarting application to apply restored data...');
                    
                    // Call backend restart function
                    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.restart_application === 'function') {
                        window.pywebview.api.restart_application();
                    } else {
                        // Fallback to page reload if restart function not available
                        setTimeout(() => {
                            location.reload();
                        }, 2000);
                    }
                };
            } else {
                showToast({ 
                    message: res.message || 'Failed to restore backup.', 
                    type: 'error', 
                    duration: 4000 
                });
            }
        }).catch(err => {
            loadingPopup.remove();
            console.error('Error during restore:', err);
            showToast({ 
                message: 'Failed to restore backup: ' + (err.message || 'Unknown error'), 
                type: 'error', 
                duration: 4000 
            });
        });
    } else {
        loadingPopup.remove();
        showToast({ 
            message: 'Restore function not available.', 
            type: 'error', 
            duration: 4000 
        });
    }
}

function handleSubscriptionClick() {
    // Always get the latest config from window
    const config = window.APP_CONFIG || APP_CONFIG || DEFAULT_CONFIG;
    const userType = (config['user-type'] || 'free').toLowerCase();
    const subscription = config.user && config.user.subscription ? config.user.subscription : {};
    const plan = subscription.plan ? subscription.plan.toUpperCase() : 'FREE';
    const expiresAt = subscription.expires_at || 'N/A';
    const createdAt = subscription.created_at || 'N/A';
    const maxMessageLength = config.max_message_length || 500;
    let remainingDays = 'N/A';
    if (expiresAt && expiresAt !== 'N/A') {
        const now = new Date();
        const expDate = new Date(expiresAt.replace(/-/g, '/'));
        if (!isNaN(expDate.getTime())) {
            const diff = expDate - now;
            remainingDays = diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
        }
    }
    const contentHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem 3rem;font-size:1.15rem;">
            <div style="text-align:left;"><b>User Type:</b> <span style="color:#ffd700;">${userType}</span></div>
            <div style="text-align:left;"><b>Plan:</b> <span style="color:#ffd700;">${plan}</span></div>
            <div style="text-align:left;"><b>Start At:</b> <span style="color:#ffd700;">${createdAt}</span></div>
            <div style="text-align:left;"><b>Expires At:</b> <span style="color:#ffd700;">${expiresAt}</span></div>
            <div style="text-align:left;"><b>Remaining Days:</b> <span style="color:#ffd700;">${remainingDays}</span></div>
            <div style="text-align:left;"><b>Max Message Length:</b> <span style="color:#ffd700;">${maxMessageLength}</span></div>
        </div>
        <div style="margin-top:2rem;text-align:center;">
            <button onclick="showRedeemPopup()" style="background:linear-gradient(to right,#6366f1,#4f46e5);color:white;border:none;padding:0.7rem 1.5rem;border-radius:0.7rem;font-weight:500;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.12);">Redeem Subscription</button>
        </div>
    `;
    showPopupBelowHeader({
        title: 'Subscription Details',
        contentHtml,
        proGlow: userType === 'PRO'
    });
}

function showRedeemPopup() {
    // Close the current subscription popup first
    closePopupBelowHeader();

    const overlay = document.createElement('div');
    overlay.id = 'redeem-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        z-index: 5000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s;
    `;

    const popup = document.createElement('div');
    popup.id = 'redeem-popup';
    popup.style.cssText = `
        background: rgba(20, 16, 40, 0.98);
        border-radius: 18px;
        padding: 2rem 2.5rem;
        width: 95vw;
        max-width: 450px;
        color: #fff;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    `;

    popup.innerHTML = `
        <div id="redeem-step-1">
            <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; text-align: center;">Redeem Subscription</h3>
            <p style="color: var(--text-medium); text-align: center; margin-bottom: 1.5rem;">If you have an already active subscription, the new subscription duration will be added to your current one.</p>
            <input id="redeem-code-input" type="text" placeholder="Enter your redemption code" style="width:100%;padding:0.7rem 1rem;border-radius:8px;border:1px solid var(--border-light);background:rgba(255,255,255,0.08);color:#fff;font-size:1rem;margin-bottom:1.5rem;outline:none;" />
            <div style="display:flex;gap:1rem;justify-content:center;">
                <button id="redeem-cancel-btn" style="background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Cancel</button>
                <button id="redeem-continue-btn" style="background:#6366f1;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Continue</button>
            </div>
        </div>
        <div id="redeem-step-2" style="display:none;">
             <h3 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; text-align: center;">Confirm Subscription</h3>
             <div id="redeem-details" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: left;"></div>
             <p style="color: #ffd700; text-align: center; margin-bottom: 1.5rem;">(Activating subscription will restart the application)</p>
             <div style="display:flex;gap:1rem;justify-content:center;">
                <button id="redeem-back-btn" style="background:rgba(255,255,255,0.1);color:var(--text-light);border:1px solid rgba(255,255,255,0.2);padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Back</button>
                <button id="redeem-confirm-btn" style="background:#10b981;color:white;border:none;padding:0.7rem 1.5rem;border-radius:8px;font-weight:500;cursor:pointer;">Redeem</button>
            </div>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('redeem-cancel-btn').onclick = () => overlay.remove();
    document.getElementById('redeem-back-btn').onclick = () => {
        document.getElementById('redeem-step-2').style.display = 'none';
        document.getElementById('redeem-step-1').style.display = 'block';
    };
    document.getElementById('redeem-continue-btn').onclick = checkRedeemCode;
    document.getElementById('redeem-confirm-btn').onclick = applyRedeemCode;
}

function checkRedeemCode() {
    const codeInput = document.getElementById('redeem-code-input');
    const code = codeInput.value.trim();
    if (!code) {
        showToast({ message: 'Please enter a redemption code.', type: 'error' });
        return;
    }

    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_subcription === 'function') {
        // Show a temporary loading state on the button
        const continueBtn = document.getElementById('redeem-continue-btn');
        continueBtn.disabled = true;
        continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        window.pywebview.api.get_subcription(code)
            .then(response => {
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continue';

                if (response && response.success && response.data) {
                    // Store code for the next step
                    document.getElementById('redeem-popup').dataset.code = code;

                    // Show confirmation step
                    const detailsDiv = document.getElementById('redeem-details');
                    detailsDiv.innerHTML = `
                        <p><strong>Plan:</strong> ${response.data.plan.toUpperCase()}</p>
                        <p><strong>Duration:</strong> ${response.data.duration} days</p>
                    `;
                    document.getElementById('redeem-step-1').style.display = 'none';
                    document.getElementById('redeem-step-2').style.display = 'block';
                } else {
                    showToast({ message: response.message || 'Invalid or expired redemption code.', type: 'error' });
                }
            })
            .catch(err => {
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continue';
                console.error('Error checking subscription code:', err);
                showToast({ message: 'An error occurred while checking the code.', type: 'error' });
            });
    } else {
        showToast({ message: 'Cannot verify code. API not available.', type: 'error' });
    }
}

function applyRedeemCode() {
    const code = document.getElementById('redeem-popup').dataset.code;
    if (!code) {
        showToast({ message: 'Redemption code not found. Please go back and try again.', type: 'error' });
        return;
    }

    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.apply_subcription === 'function') {
        // --- Hide the popup before showing the loader ---
        const overlay = document.getElementById('redeem-overlay');
        if (overlay) {
            overlay.remove();
        }

        // Show full screen loader
        showLoadingWindow('Activating subscription and restarting application...');
        
        window.pywebview.api.apply_subcription(code)
            .then(response => {
                // The python script should restart the app. If it fails, we'll see an error.
                if (response && !response.success) {
                    removeLoadingWindow();
                    showToast({ message: response.message || 'Failed to apply subscription.', type: 'error' });
                }
                // On success, the app restarts, so no need to do anything here.
            })
            .catch(err => {
                removeLoadingWindow();
                console.error('Error applying subscription code:', err);
                showToast({ message: 'An error occurred while applying the subscription.', type: 'error' });
            });
    } else {
        showToast({ message: 'Cannot apply subscription. API not available.', type: 'error' });
    }
}

function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

function showPopupBelowHeader({ title, contentHtml, proGlow = false, onClose = null }) {
    // Remove any existing popup
    closePopupBelowHeader();

    // Insert popup title section in header
    let popupTitleSection = document.getElementById('popup-title-section');
    if (!popupTitleSection) {
        popupTitleSection = document.createElement('div');
        popupTitleSection.id = 'popup-title-section';
        document.querySelector('.header').insertBefore(
            popupTitleSection,
            document.querySelector('.profile-section')
        );
    }
    popupTitleSection.style.display = 'flex';
    popupTitleSection.style.alignItems = 'center';
    popupTitleSection.innerHTML = `<span style="font-size:1.2rem;font-weight:600;">${title}</span>`;

    // Replace sidebar-toggle with close button (same style)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        // Save original button for restoration
        if (!window._originalSidebarToggleHTML) {
            window._originalSidebarToggleHTML = sidebarToggle.outerHTML;
        }
        // Replace icon and click handler
        sidebarToggle.innerHTML = '<i class="fad fa-times"></i>';
        sidebarToggle.onclick = () => {
            closePopupBelowHeader();
            if (onClose) onClose();
        };
        // Remove any previous event listeners
        sidebarToggle.replaceWith(sidebarToggle.cloneNode(true));
        // Re-select and re-apply
        const newSidebarToggle = document.getElementById('sidebar-toggle');
        if (newSidebarToggle) {
            newSidebarToggle.innerHTML = '<i class="fad fa-times"></i>';
            newSidebarToggle.onclick = () => {
                closePopupBelowHeader();
                if (onClose) onClose();
            };
            newSidebarToggle.style.display = '';
        }
    }

    // Create popup under header
    const popup = document.createElement('div');
    popup.className = 'popup-under-header' + (proGlow ? ' pro-glow' : '');
    popup.id = 'popup-under-header';
    popup.innerHTML = contentHtml;
    document.body.appendChild(popup);
}

function closePopupBelowHeader() {
    // Remove popup
    const popup = document.getElementById('popup-under-header');
    if (popup) popup.remove();

    // Remove popup title section
    const popupTitleSection = document.getElementById('popup-title-section');
    if (popupTitleSection) popupTitleSection.style.display = 'none';

    // Restore sidebar-toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle && window._originalSidebarToggleHTML) {
        sidebarToggle.outerHTML = window._originalSidebarToggleHTML;
        // Re-attach sidebar toggle event listener
        const restoredSidebarToggle = document.getElementById('sidebar-toggle');
        if (restoredSidebarToggle) {
            restoredSidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
            });
        }
        window._originalSidebarToggleHTML = null;
    }
}
// Update user-type box with latest value from window.APP_CONFIG
function updateUserTypeBox() {
    const userTypeBox = document.getElementById('user-type-box');
    if (!userTypeBox) return;
    const config = window.APP_CONFIG || APP_CONFIG || DEFAULT_CONFIG;
    console.log('Full APP_CONFIG:', config);
    const userType = (config['user-type'] || 'free').toLowerCase();
    console.log('Loaded user_type from APP_CONFIG:', config['user-type']);
    let iconHtml = '<i class="fad fa-diamond" style="font-size: 1rem;"></i>';
    let label = userType.charAt(0).toUpperCase() + userType.slice(1);
    userTypeBox.innerHTML = iconHtml + '<span>' + label + '</span>';
    if (userType === "pro") {
        userTypeBox.classList.add('pro-glow');
    } else {
        userTypeBox.classList.remove('pro-glow');
    }
}

// Update subscription button based on user type
function updateSubscriptionButton() {
    const subscriptionButton = document.getElementById('subscription-button');
    if (!subscriptionButton) return;
    const config = window.APP_CONFIG || APP_CONFIG || DEFAULT_CONFIG;
    const userType = (config['user-type'] || 'free').toLowerCase();
    if (userType === "pro") {
        subscriptionButton.classList.add('pro-button');
    } else {
        subscriptionButton.classList.remove('pro-button');
    }
    const subBtn = document.getElementById('subscription-button');
    const subIcon = document.getElementById('subscription-icon');
    if (subBtn && subIcon) {
        if (userType === "pro") {
            subBtn.classList.add('pro-glow');
        } else {
            subBtn.classList.remove('pro-glow');
        }
    }

}

// Toast notification system
function showToast({ message, type = 'info', duration = 3000 }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Get icon based on type
    let icon;
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            break;
        default:
            icon = 'fa-info-circle';
    }

    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fad fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto hide after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
            }, 300); // Match transition duration
        }, duration);
    }
}

// Update openExternalLink to use simplified toast notifications
function openExternalLink(url) {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.open_url === 'function') {
        window.pywebview.api.open_url(url)
            .then(response => {
                if (response.success) {
                    showToast({
                        message: 'Profile page opened in browser',
                        type: 'success',
                        duration: 3000
                    });
                } else {
                    showToast({
                        message: response.message || 'Failed to open profile page',
                        type: 'error',
                        duration: 4000
                    });
                }
            })
            .catch(error => {
                showToast({
                    message: 'Failed to open profile page',
                    type: 'error',
                    duration: 4000
                });
            });
    } else {
        showToast({
            message: 'Unable to open external link',
            type: 'error',
            duration: 4000
        });
    }
}

function showClearHistoryConfirmation() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create confirmation popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 12px;
        padding: 1.5rem;
        width: 90%;
        max-width: 400px;
        color: white;
        text-align: center;
    `;

    popup.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <i class="fas fa-exclamation-triangle" style="
                color: #ef4444;
                font-size: 2rem;
                margin-bottom: 1rem;
            "></i>
            <h3 style="
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: #ef4444;
            ">Clear Chat History</h3>
            <p style="
                color: var(--text-medium);
                line-height: 1.5;
            ">Are you sure you want to clear AI's history? This action cannot be undone and will close the application.</p>
        </div>
        <div style="
            display: flex;
            gap: 1rem;
            justify-content: center;
        ">
            <button onclick="closeClearHistoryConfirmation()" style="
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-light);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            ">Cancel</button>
            <button onclick="confirmClearHistory()" style="
                background: #ef4444;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            ">Continue</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function closeClearHistoryConfirmation() {
    const overlay = document.querySelector('div[style*="backdrop-filter: blur(4px)"]');
    if (overlay) {
        overlay.remove();
    }
}

function showLoadingWindow(message = 'Loading...') {
    // Remove any existing loading window first
    removeLoadingWindow();
    
    // Create loader
    const loader = document.createElement('div');
    loader.id = 'global-loading-window';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        z-index: 1001;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 1rem;
    `;
    loader.innerHTML = `
        <div class="thinking-animation">
            <div class="thinking-dot"></div>
            <div class="thinking-dot"></div>
            <div class="thinking-dot"></div>
        </div>
        <div style="color: white; font-size: 1.1rem;">${message}</div>
    `;
    document.body.appendChild(loader);
}

function removeLoadingWindow() {
    const existingLoader = document.getElementById('global-loading-window');
    if (existingLoader) {
        existingLoader.remove();
    }
}

function confirmClearHistory() {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.clear_history_and_restart === 'function') {
        // Show loading window
        showLoadingWindow('Clearing history and closing application...');

        // Call Python function
        window.pywebview.api.clear_history_and_restart()
            .then(response => {
                if (!response.success) {
                    showToast({
                        message: response.message || 'Failed to clear history',
                        type: 'error',
                        duration: 3000
                    });
                    removeLoadingWindow();
                }
            })
            .catch(error => {
                showToast({
                    message: 'Failed to clear history',
                    type: 'error',
                    duration: 3000
                });
                removeLoadingWindow();
            });
    } else {
        showToast({
            message: 'Unable to clear history',
            type: 'error',
            duration: 3000
        });
    }
}

// Voice Chat functionality
let voiceRecognition = null;
let isVoiceMode = false;
let isListening = false;
let finalTranscript = '';
let isProcessingResponse = false;
let userLang = 'en-US'; // Default language
let isRecognitionActive = false; // Track if recognition is currently active
let isvoiseactive = false; // New global variable for AI voice activation

// Function to check microphone availability
async function checkMicrophoneAvailability() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after checking
        return true;
    } catch (error) {
        console.error('Microphone access error:', error);
        return false;
    }
}

// Function to update language
function updateVoiceLanguage(newLang) {
    userLang = newLang;
    if (voiceRecognition) {
        voiceRecognition.lang = userLang;
        console.log('Voice recognition language updated to:', userLang);
    }
}

// --- Add a new function to safely manage voice recognition state ---
function safelyStopListening() {
    if (isRecognitionActive) {
        try {
            voiceRecognition.stop();
            console.log('Safely stopped voice recognition');
        } catch (error) {
            console.error('Error stopping recognition safely:', error);
        }
        isRecognitionActive = false;
        isListening = false;
    }
}

function safelyStartListening() {
    // Never start listening during audio playback
    if (audioPlaybackInProgress) {
        console.log('Audio playback in progress, cannot start listening now');
        return false;
    }

    if (!isVoiceMode) {
        console.log('Not in voice mode, will not start listening');
        return false;
    }
    
    if (isRecognitionActive) {
        console.log('Recognition already active, no need to start');
        return true;
    }

    try {
        // Add small delay before starting to prevent potential race conditions
        setTimeout(() => {
            if (isVoiceMode && !isRecognitionActive && !audioPlaybackInProgress) {
    try {
        isRecognitionActive = true;
        voiceRecognition.start();
                    console.log('Started voice recognition after delay');
    } catch (error) {
                    console.error('Error starting delayed recognition:', error);
        isRecognitionActive = false;
                    
                    // If error is "already started", don't retry to avoid loops
                    if (!(error.name === 'InvalidStateError' && error.message.includes('already started'))) {
                        setTimeout(() => safelyStartListening(), 500);
                    }
                }
            }
        }, 300);
        return true;
    } catch (error) {
        console.error('Error preparing to start recognition:', error);
        isRecognitionActive = false;
        return false;
    }
}

function startListening() {
    safelyStartListening();
}

function stopListening() {
    safelyStopListening();
}

function initVoiceChat() {
    const voiceButton = document.getElementById('voice-button');
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        voiceButton.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceRecognition = new SpeechRecognition();
    
    // Configure voice recognition settings
    voiceRecognition.lang = userLang;
    console.log('Voice recognition initialized with language:', userLang);
    voiceRecognition.continuous = false;    // Stop listening after one phrase
    voiceRecognition.maxAlternatives = 1;   // Only get the best transcription
    voiceRecognition.interimResults = true; // Enable live updates
    voiceRecognition.filterProfanities = false;


    voiceButton.addEventListener('click', async () => {
        if (!isVoiceMode) {
            // Check microphone availability before switching to voice mode
            const hasMicrophone = await checkMicrophoneAvailability();
            if (!hasMicrophone) {
                showToast({
                    message: 'Microphone access denied. Please allow microphone access to use voice input.',
                    type: 'error',
                    duration: 5000
                });
                return;
            }
            
            isVoiceMode = true;
            voiceButton.innerHTML = '<i class="fas fa-comments"></i>';
            messageInput.placeholder = 'Listening...';
            messageInput.readOnly = true;
            messageInput.style.cursor = 'not-allowed';
            messageInput.style.opacity = '0.7';
            sendButton.style.display = 'none';
            startListening();
        } else {
            // Switching to text mode
            isVoiceMode = false;
            if (isRecognitionActive) {
                try {
                    voiceRecognition.stop();
                } catch (error) {
                    console.log('Error stopping recognition:', error);
                }
            }
            // Reset all states
            isListening = false;
            isRecognitionActive = false;
            finalTranscript = '';
            messageInput.value = '';
            voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            messageInput.placeholder = 'Type your message...';
            messageInput.readOnly = false;
            messageInput.style.cursor = 'text';
            messageInput.style.opacity = '1';
            sendButton.style.display = 'flex';
            updateVoiceUI();
        }
    });

    voiceRecognition.onstart = () => {
        if (!isVoiceMode) {
            voiceRecognition.stop();
            return;
        }
        isListening = true;
        updateVoiceUI();
        finalTranscript = '';
        messageInput.value = '';
    };

    voiceRecognition.onend = () => {
        isListening = false;
        isRecognitionActive = false;
        if (isVoiceMode) {
            // Only restart if we're still in voice mode and not in an error state
            setTimeout(() => {
                if (isVoiceMode && !isRecognitionActive) {
                    startListening();
                }
            }, 100);
        }
        updateVoiceUI();
    };

    voiceRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecognitionActive = false;
        isListening = false;
        
        // Don't show error if we're switching to text mode
        if (!isVoiceMode) {
            return;
        }
        
        if (event.error === 'audio-capture') {
            showToast({
                message: 'No microphone detected. Please check your microphone connection.',
                type: 'error',
                duration: 5000
            });
            isVoiceMode = false;
        } else if (event.error === 'not-allowed') {
            showToast({
                message: 'Microphone access denied. Please allow microphone access to use voice input.',
                type: 'error',
                duration: 5000
            });
            isVoiceMode = false;
        } else if (event.error === 'aborted' || event.error === 'network') {
            // Handle temporary errors
            if (isVoiceMode) {
                setTimeout(() => {
                    if (isVoiceMode && !isRecognitionActive) {
                        startListening();
                    }
                }, 1000);
            }
        }
        
        updateVoiceUI();
    };

    voiceRecognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
                messageInput.value = finalTranscript;
                // If we have a valid sentence, send it
                if (finalTranscript.trim().length > 0) {
                    handleVoiceMessage(finalTranscript);
                }
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (interimTranscript) {
            messageInput.value = interimTranscript;
        }
    };

    // Prevent editing in voice mode
    messageInput.addEventListener('keydown', (e) => {
        if (isVoiceMode) {
            e.preventDefault();
        }
    });
}

function handleVoiceMessage(message) {
    isProcessingResponse = true;
    stopListening();
    
    // Clear the input
    finalTranscript = '';
    messageInput.value = '';
    
    // Set the message in the input before sending
    messageInput.value = message;
    
    // Send the message using the original sendMessage function
    if (typeof sendMessage === 'function') {
        sendMessage();
    }
}

function updateVoiceUI() {
    const voiceButton = document.getElementById('voice-button');
    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    
    if (isVoiceMode) {
        if (isListening) {
            voiceButton.innerHTML = '<i class="fas fa-comments"></i>';
            voiceButton.className = 'w-12 h-12 flex items-center justify-center rounded-full ' +
                'bg-gradient-to-r from-blue-600 to-blue-500 ' +
                'text-white shadow-lg hover:from-blue-500 hover:to-blue-400 ' +
                'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
                'transition-all transform hover:scale-105 active:scale-95';
            messageInput.placeholder = 'Listening...';
            messageInput.readOnly = true;
            messageInput.style.cursor = 'not-allowed';
            messageInput.style.opacity = '0.7';
            sendButton.style.display = 'none';
        } else {
            voiceButton.innerHTML = '<i class="fas fa-comments"></i>';
            voiceButton.className = 'w-12 h-12 flex items-center justify-center rounded-full ' +
                'bg-gradient-to-r from-gray-600 to-gray-500 ' +
                'text-white shadow-lg hover:from-gray-500 hover:to-gray-400 ' +
                'focus:outline-none focus:ring-2 focus:ring-gray-500 ' +
                'transition-all transform hover:scale-105 active:scale-95';
            messageInput.placeholder = isProcessingResponse ? 
                'Processing response...' : 
                'Voice mode active - Click to switch to text';
            messageInput.readOnly = true;
            messageInput.style.cursor = 'not-allowed';
            messageInput.style.opacity = '0.7';
            sendButton.style.display = 'none';
        }
    } else {
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.className = 'w-12 h-12 flex items-center justify-center rounded-full ' +
            'bg-gradient-to-r from-indigo-600 to-purple-500 ' +
            'text-white shadow-lg hover:from-indigo-500 hover:to-purple-400 ' +
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 ' +
            'transition-all transform hover:scale-105 active:scale-95';
        messageInput.placeholder = 'Type your message...';
        messageInput.readOnly = false;
        messageInput.style.cursor = 'text';
        messageInput.style.opacity = '1';
        sendButton.style.display = 'flex';
    }
}

// Initialize voice chat when the app starts
document.addEventListener('DOMContentLoaded', () => {
    initVoiceChat();
});

let currentAudio = null;
let audioContext = null;
let analyser = null;
let visualizerCanvas = null;
let visualizerContext = null;
let animationFrame = null;
let audioCache = {}; // New: In-memory cache for audio data
let gainNode = null; // New: GainNode for volume control

// --- 1. Add a global to track audio playback completion callback ---
let audioPlaybackCompleteCallback = null;

// --- Add a flag to track audio playback ---
let audioPlaybackInProgress = false;

function initAudioVisualizer() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Ensure AudioContext is not suspended initially if possible
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed initially.');
            }).catch(e => console.error('Error resuming AudioContext at init:', e));
        }
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // Create and configure GainNode
        gainNode = audioContext.createGain();
        gainNode.gain.value = 1.5; // Set initial volume gain (e.g., 1.5 for 50% louder)
    }
    
    if (!visualizerCanvas) {
        visualizerCanvas = document.getElementById('audio-visualizer-canvas');
        visualizerContext = visualizerCanvas.getContext('2d');
        visualizerCanvas.width = 200;
        visualizerCanvas.height = 40;
    }
}

function drawVisualizer() {
    if (!analyser || !visualizerContext) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    visualizerContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    visualizerContext.fillStyle = 'rgba(99, 102, 241, 0.2)';
    
    const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
        visualizerContext.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
    
    animationFrame = requestAnimationFrame(drawVisualizer);
}

function stopAudioPlayback() {
    console.log("Stopping audio playback.");
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    const audioPlayerPopup = document.getElementById('audio-player-popup');
    if (audioPlayerPopup) {
        audioPlayerPopup.style.display = 'none';
    }
    
    // Mark audio playback as completed
    audioPlaybackInProgress = false;
    
    // If a callback is set, call it after a short delay to prevent race conditions
    if (typeof audioPlaybackCompleteCallback === 'function') {
        const callback = audioPlaybackCompleteCallback;
        audioPlaybackCompleteCallback = null;
        // Longer delay to ensure everything is cleaned up before starting listening
        setTimeout(callback, 500);
    }
}

function playAudio(url, onComplete) {
    console.log("Attempting to play audio from URL:", url);
    stopAudioPlayback();
    
    // Mark that audio playback is in progress
    audioPlaybackInProgress = true;
    
    // Set the callback for when playback finishes
    audioPlaybackCompleteCallback = typeof onComplete === 'function' ? onComplete : null;
    
    const audioPlayerPopup = document.getElementById('audio-player-popup');
    if (!audioPlayerPopup) {
        console.error("Audio player popup not found.");
        showToast({
            message: 'Audio player not available.',
            type: 'error',
            duration: 3000
        });
        audioPlaybackInProgress = false;
        // Still call the completion callback even if we couldn't play
        if (typeof audioPlaybackCompleteCallback === 'function') {
            setTimeout(audioPlaybackCompleteCallback, 500);
        }
        return;
    }

    // Function to handle audio setup and playback
    const setupAudioPlayback = (audio) => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully.');
                initAudioVisualizer();
                const source = audioContext.createMediaElementSource(audio);
                source.connect(analyser);
                analyser.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                audio.play().catch(e => {
                    console.error("Audio play failed after resume:", e);
                    stopAudioPlayback();
                });
                audioPlayerPopup.style.display = 'block';
                drawVisualizer();
            }).catch(e => {
                console.error("Error resuming AudioContext:", e);
                stopAudioPlayback();
            });
        } else {
            initAudioVisualizer();
            const source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            audio.play().catch(e => {
                console.error("Audio play failed:", e);
                stopAudioPlayback();
            });
            audioPlayerPopup.style.display = 'block';
            drawVisualizer();
        }
    };

    // Check cache first
    if (audioCache[url]) {
        console.log("Playing audio from cache:", url);
        const audio = new Audio(audioCache[url]);
        currentAudio = audio;

        audio.onended = () => {
            console.log("Audio playback ended (cached).");
            stopAudioPlayback();
        };
        
        audio.onerror = (e) => {
            console.error("Audio error (cached):", e);
            showToast({
                message: 'Error playing cached audio.',
                type: 'error',
                duration: 3000
            });
            stopAudioPlayback();
        };
        
        setupAudioPlayback(audio);
        return;
    }

    // If not in cache, fetch directly
    const audio = new Audio(url);
    currentAudio = audio;
    
    audio.onended = () => {
        console.log("Audio playback ended.");
        stopAudioPlayback();
    };
    
    audio.onerror = (e) => {
        console.error("Audio error:", e);
        showToast({
            message: 'Error playing audio.',
            type: 'error',
            duration: 3000
        });
        stopAudioPlayback();
    };
    
    setupAudioPlayback(audio);
}

// Add this function to handle backend calls to playAudio
function playAudioResponse(url) {
    console.log("playAudioResponse called with URL:", url);
    
    // Always stop listening first
    safelyStopListening();
    
    // Stop any current audio
    stopAudioPlayback();
    
    // Use our standard playAudio function with a callback to resume listening in voice mode
    playAudio(url, () => {
        console.log("playAudioResponse playback complete");
        if (isVoiceMode) {
            safelyStartListening();
        }
    });
}

// Make playAudioResponse available globally (for backend calls)
window.playAudioResponse = playAudioResponse;

// Add event listener for stop button
document.getElementById('audio-stop-btn').addEventListener('click', stopAudioPlayback);
function finishSetup() {
    // Show loading screen
    document.getElementById('loadingScreen').classList.add('active');
    
    // Collect settings
    const settings = {
        voiceLanguage: document.getElementById('languageSelectsetup').value,
        aiSpeechEnabled: aiSpeechEnabled
    };
    
    // Simulate setup time
    setTimeout(() => {
        // Hide setup overlay and loading screen
        document.getElementById('setupOverlay').classList.remove('active');
        //document.getElementById('loadingScreen').classList.remove('active');
        
        // Call the Python backend finishsetup function if available
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.finishsetup === 'function') {
            window.pywebview.api.finishsetup(settings).then(() => {
                // Optionally show a message or reload
                console.log('Python finishsetup called with:', settings);
            }).catch((err) => {
                console.error('Error calling Python finishsetup:', err);
                alert('Setup completed, but failed to notify backend.');
            });
        } else if (typeof window.finishSetup === 'function') {
            window.finishSetup(settings);
        } else {
            console.log('Setup error');
            alert('Error, please restart.');
        }
    }, 3000);
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'F11') {
        e.preventDefault(); // prevent default browser fullscreen
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.toggle_fullscreen();
        }
    }
});