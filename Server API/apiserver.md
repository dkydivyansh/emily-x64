# to-do
- home assistent intigration

# 🔐 API Login Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

Endpoint:  
POST /login

Headers:
- User-Agent: project/884938t48y584y5
- Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "password123",
  "device_id": "device_001"
}

---

## 2. 🛡️ API Server Logic

Step 1: Extract `email` and `device_id` from the request body.

Step 2: Use the email to query the database for the associated device ID and status.

SQL Example:
SELECT device_id, status FROM users WHERE external_id = (SELECT external_id FROM email_map WHERE email = 'user@example.com');

- If a record is found:
  - Check user status:
    - If status is NOT 'active':
      → Return:
      {
        "success": false,
        "message": "Account is deactivated. Please contact support."
      }
    - If status is 'active':
      - If `device_id` **matches** the one from the request:
        → Proceed to the auth server login (same device re-login allowed)
      - If `device_id` **does not match**:
        → Return:
        {
          "success": false,
          "message": "Account already logged in on another device"
        }

- If no matching email is found, or device_id is NULL:
  → Proceed to the auth server login


---

## 3. 🔐 Forward Request to Auth Server

POST /api/v1?type=login  
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "password123",
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

4.1 If error_code = INVALID_CREDENTIALS:
Return:
{
  "success": false,
  "message": "Invalid credentials"
}

4.2 If any other error:
- Log the error on the server
- Return:
{
  "success": false,
  "message": "An error occurred on the server. Please try again later."
}

4.3 Check for special message with (error_code = INVALID_CREDENTIALS):
- If `message = "ACCOUNT_DEACTIVE"`:
  Return:
  {
    "success": false,
    "message": "Your account has been deactivated. Please contact support."
  }
4.4 If successful response:
- Else, continue with successful login handling:
  {
    "success": true,
    "message": "Authentication successful",
    "data": {
      "session_token": "session_token_string",
      "refresh_token": "refresh_token_string",
      "expires_in": 3600,
      "user_id": "user_uuid_string"
    }
  }
---

## 5. 🧠 API Server Final Step

Step 1: Check if `user_id` (external_id) exists:
SELECT * FROM users WHERE external_id = 'user_uuid_string';

- take email and device_id from first request made by Client (App)

Step 2: If not found, insert new record with user data:
INSERT INTO users (external_id, device_id, status, email)
VALUES ('user_uuid_string', 'device_001', 'active', 'user@example.com');

Step 3: If user already exists:
UPDATE users SET device_id = 'device_001' WHERE external_id = 'user_uuid_string';

Step 4: In both cases, update last_seen to current time:
UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE external_id = 'user_uuid_string';


---

## 6. 🎉 Final Response to Client

Return:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "session_token": "session_token_string",
    "refresh_token": "refresh_token_string",
    "expires_in": 3600,
    "user_id": "user_uuid_string"
  }
}

---

## 🗂️ Summary Table

Step | Action                  | Description
-----|-------------------------|-------------------------------
1    | Client → API Server     | Sends email, password, device ID
2    | API Server → DB         | Checks device ID bound to email
3    | If OK, → Auth Server    | Forwards login request
4    | API Server ← Auth Server| Handles login result
5    | API Server updates DB   | Insert or update user with email and device ID
6    | API Server → Client     | Sends tokens and success message





# 🔒 API Logout Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

**Endpoint:**
POST /logout

**Headers:**
- User-Agent: project/884938t48y584y5  
- Content-Type: application/json

**Request Body:**
{
  "user_id": "user123",
  "device_id": "device_001",
  "session_token": "sess_abc123xyz"
}

---

## 2. 🛡️ API Server Validation

Step 1: Extract `user_id` and `device_id` from the request.

Step 2: Query the database to verify ownership of the session and check user status.

SQL Example:
SELECT device_id, status FROM users WHERE external_id = 'user123';

- If no record is found:
  Return:
  {
    "success": false,
    "message": "Session does not belong to this server"
  }

- If record is found:
  - If status is NOT 'active':
    Return:
    {
      "success": false,
      "message": "Account is deactivated. Please contact support."
    }
  - If device_id does NOT match `device_001`:
    Return:
    {
      "success": false,
      "message": "Request from unauthorized device"
    }
  - If device_id matches and status is 'active':
    → Proceed to auth server logout

---

## 3. 🔐 Forward Logout to Auth Server

**Endpoint:**
POST /api/v1?type=logout

**Headers:**
- Authorization: Bearer sess_abc123xyz  
- X-User-ID: user123  
- Content-Type: application/json

**Request Body:**
{
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

### 4.1 If response is:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN",
  "request_id": "req_f8da9e70"
}

Return to app:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN"
}

---

### 4.2 If response is:
{
  "success": false,
  "message": "...",
  "error_code": "ANY_OTHER_ERROR_CODE"
}

- Log the full response internally
- Return to app:
{
  "success": false,
  "message": "Server error",
  "error_code": "SERVER_ERROR"
}

---

### 4.3 If response is:
{
  "success": true,
  "message": "Session terminated successfully",
  "data": []
}

Step 1: Update device_id to NULL for the user

SQL Example:
UPDATE users SET device_id = NULL WHERE external_id = 'user123';

Step 2: Return to app:
{
  "success": true,
  "message": "Session terminated successfully"
}

---

## 🗂️ Summary Table

Step | Action                     | Description
-----|----------------------------|-----------------------------------------------
1    | Client → API Server        | Sends user_id, device_id, session_token
2    | API Server → DB            | Validates session belongs to correct device
3    | API Server → Auth Server   | Sends logout request with auth headers
4    | API Server ← Auth Response | Handles success or failure from auth server
5    | API Server → DB            | Nullifies device_id on successful logout
6    | API Server → Client        | Returns logout confirmation or error message

# 🔄 API Refresh Token Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

**Endpoint:**
POST /refresh

**Headers:**
- User-Agent: project/884938t48y584y5  
- Content-Type: application/json

**Request Body:**
{
  "user_id": "user123",
  "device_id": "device_001",
  "session_token": "sess_abc123xyz",
  "refresh_token": "rtok_def456uvw"
}

---

## 2. 🛡️ API Server Validation

Step 1: Extract `user_id` and `device_id` from the request.

Step 2: Query the database to verify ownership of the session.

SQL Example:
SELECT device_id FROM users WHERE external_id = 'user123';

- If no record is found OR device_id does NOT match `device_001`:
  Return:
  {
    "success": false,
    "message": "Session does not belong to this server or request from unauthorized device"
  }

- If device_id matches:
  → Proceed to auth server token refresh

---

## 3. 🔐 Forward Refresh Request to Auth Server

**Endpoint:**
POST /api/v1?type=refresh

**Headers:**
- Authorization: Bearer sess_abc123xyz  
- X-User-ID: user123  
- Content-Type: application/json

**Request Body:**
{
  "refresh_token": "rtok_def456uvw",
  "old_session_token": "sess_abc123xyz",
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

### 4.1 If response is:
{
  "success": false,
  "message": "Invalid or expired refresh token",
  "error_code": "INVALID_TOKEN",
  "request_id": "req_ced9cc1b"
}

Return to app:
{
  "success": false,
  "message": "Invalid or expired refresh token",
  "error_code": "INVALID_TOKEN"
}

---

### 4.2 If response is:
{
  "success": false,
  "message": "...",
  "error_code": "ANY_OTHER_ERROR_CODE"
}

- Log the full response internally
- Return to app:
{
  "success": false,
  "message": "Server error",
  "error_code": "SERVER_ERROR"
}

---

### 4.3 If response is:
{
  "success": true,
  "message": "Session refreshed successfully",
  "data": {
    "session_token": "new_session_token",
    "refresh_token": "new_refresh_token",
    "expires_in": 3600
  }
}

Step 1: Update the `last_seen` column in the `users` table:
SQL:
UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE external_id = 'user123';

Step 2: Forward directly to app:
{
  "success": true,
  "message": "Session refreshed successfully",
  "data": {
    "session_token": "new_session_token",
    "refresh_token": "new_refresh_token",
    "expires_in": 3600
  }


---

## 🗂️ Summary Table

Step | Action                      | Description
-----|-----------------------------|-----------------------------------------------
1    | Client → API Server         | Sends session_token, refresh_token, user_id, device_id
2    | API Server → DB             | Validates device ownership
3    | API Server → Auth Server    | Sends refresh request with auth headers
4    | API Server ← Auth Response  | Handles success or failure from auth server
5    | API Server → Client         | Forwards refreshed tokens or error response



# ✅ API Token Verify Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

**Endpoint:**  
POST /verify

**Headers:**
- User-Agent: project/884938t48y584y5  
- Content-Type: application/json

**Request Body:**
{
  "user_id": "user123",
  "device_id": "device_001",
  "session_token": "sess_abc123xyz"
}

---

## 2. 🛡️ API Server Validation

Step 1: Extract `user_id` and `device_id` from the request.

Step 2: Query the database to verify ownership of the session.

SQL Example:
SELECT device_id FROM users WHERE external_id = 'user123';

- If no record is found OR device_id does NOT match `device_001`:
  Return:
  {
    "success": false,
    "message": "Session does not belong to this server or request from unauthorized device"
  }

- If device_id matches:
  → Proceed to validate session with auth server

---

## 3. 🔐 Forward Validation Request to Auth Server

**Endpoint:**  
POST /api/v1?type=validate

**Headers:**
- Authorization: Bearer sess_abc123xyz  
- X-User-ID: user123  
- Content-Type: application/json

**Request Body:**
{
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

### 4.1 If response is:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN",
  "request_id": "req_32a235ef"
}

Return to app:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN"
}

---

### 4.2 If response is:
{
  "success": false,
  "message": "...",
  "error_code": "ANY_OTHER_ERROR_CODE"
}

- Log the full response internally
- Return to app:
{
  "success": false,
  "message": "Server error",
  "error_code": "SERVER_ERROR"
}

---

### 4.3 If response is:
{
  "success": true,
  "message": "Session is valid",
  "data": {
    "valid": true,
    "expires_in": 2079,
    "user_id": "dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7"
  }
}

Forward directly to app:
{
  "success": true,
  "message": "Session is valid",
  "data": {
    "valid": true,
    "expires_in": 2079,
    "user_id": "dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7"
  }
}

---

## 🗂️ Summary Table

Step | Action                      | Description
-----|-----------------------------|-----------------------------------------------
1    | Client → API Server         | Sends session_token, user_id, device_id
2    | API Server → DB             | Validates device ownership
3    | API Server → Auth Server    | Sends session validation request
4    | API Server ← Auth Response  | Handles success or failure from auth server
5    | API Server → Client         | Forwards valid result or error response

# 👤 API User Info Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

**Endpoint:**  
POST /user-info

**Headers:**
- User-Agent: project/884938t48y584y5  
- Content-Type: application/json

**Request Body:**
{
  "user_id": "user123",
  "device_id": "device_001",
  "session_token": "sess_abc123xyz"
}

---

## 2. 🛡️ API Server Validation

Step 1: Extract `user_id` and `device_id` from the request.

Step 2: Query the database to verify ownership of the session and check user status.

SQL Example:
SELECT device_id, memory_data, status FROM users WHERE external_id = 'user123';

- If no record is found:
  Return:
  {
    "success": false,
    "message": "Session does not belong to this server"
  }

- If record is found:
  - If status is NOT 'active':
    Return:
    {
      "success": false,
      "message": "Account is deactivated. Please contact support."
    }
  - If device_id does NOT match `device_001`:
    Return:
    {
      "success": false,
      "message": "Request from unauthorized device"
    }
  - If device_id matches and status is 'active':
    → Proceed to fetch user profile from auth server

---

## 3. 🔐 Request User Info from Auth Server

**Endpoint:**  
GET /api/v1?type=profile

**Headers:**
- Authorization: Bearer sess_abc123xyz  
- X-User-ID: user123  
- Content-Type: application/json

**Request Body:**
{
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

### 4.1 If response is:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN",
  "request_id": "req_72c5235d"
}

Return to app:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN"
}

---

### 4.2 If response is:
{
  "success": false,
  "message": "...",
  "error_code": "ANY_OTHER_ERROR_CODE"
}

- Log the full response internally
- Return to app:
{
  "success": false,
  "message": "Server error",
  "error_code": "SERVER_ERROR"
}

---

### 4.3 If response is:
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "user_id": "dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7",
      "email": "mrdkydiv@gmail.com",
      "name": "DIVYANSH YADAV",
      "date_of_birth": "1990-12-17",
      "phone_number": "",
      "profile_photo": "https://auth.dkydivyansh.com/uploads/avatars/dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7_1747040219.png",
      "status": "active",
      "gender": "male",
      "created_at": "2025-04-19 08:15:28",
      "updated_at": "2025-06-01 07:15:34"
    }
  }
}

Step 1: Extract relevant user data:
- email
- name
- date_of_birth
- profile_photo
- gender

Step 2: Query `memory_data` from local DB using:
SELECT memory_data FROM users WHERE external_id = 'user123';

Step 3: Check `subscriptions` table for matching user:
SELECT plan, expires_at, created_at FROM subscriptions WHERE external_id = 'user123';
If subscription not found: "subscription": null
Step 4: Return combined response:
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "email": "mrdkydiv@gmail.com",
    "name": "DIVYANSH YADAV",
    "date_of_birth": "1990-12-17",
    "profile_photo": "https://auth.dkydivyansh.com/uploads/avatars/dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7_1747040219.png",
    "gender": "male",
    "memory_data": { ... },   <-- from database
    "subscription": {
      "plan": "pro",
      "expires_at": "2025-07-01 00:00:00",
      "created_at": "2025-06-01 12:30:00"
    }
  }
}

---

## 🗂️ Summary Table

Step | Action                      | Description
-----|-----------------------------|-----------------------------------------------
1    | Client → API Server         | Sends session_token, user_id, device_id
2    | API Server → DB             | Validates device ownership and fetches memory
3    | API Server → Auth Server    | Requests user profile data
4    | API Server ← Auth Response  | Handles success or failure from auth server
5    | API Server → Client         | Sends combined user info and memory to app





# ⚙️ API App Config Flow Outline

## Participants
- Client (App)
- API Server
- Auth Server

---

## 1. 📲 Client Request to API Server

**Endpoint:**  
POST /app-config

**Headers:**
- User-Agent: project/884938t48y584y5  
- Content-Type: application/json

**Request Body:**
{
  "user_id": "user123",
  "device_id": "device_001",
  "session_token": "sess_abc123xyz"
}

---

## 2. 🛡️ API Server Validation

Step 1: Extract `user_id`, `device_id`, and `session_token` from request.

Step 2: Query the database to verify the device ID and check user status.

SQL Example:
SELECT device_id, status FROM users WHERE external_id = 'user123';

- If no record is found:
  Return:
  {
    "success": false,
    "message": "Session does not belong to this server"
  }

- If record is found:
  - If status is NOT 'active':
    Return:
    {
      "success": false,
      "message": "Account is deactivated. Please contact support."
    }
  - If device_id does NOT match `device_001`:
    Return:
    {
      "success": false,
      "message": "Request from unauthorized device"
    }
  - If device_id matches and status is 'active':
    → Proceed to validate session with Auth Server

---

## 3. 🔐 Session Validation via Auth Server

**Endpoint:**  
POST /api/v1?type=validate

**Headers:**
- Authorization: Bearer sess_abc123xyz  
- X-User-ID: user123  
- Content-Type: application/json

**Request Body:**
{
  "client_id": "client123",
  "client_secret": "client_secret_xyz"
}

---

## 4. 🔁 Handle Auth Server Response

### 4.1 If response is:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN"
}

Return to app:
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN"
}

---

### 4.2 If response is:
{
  "success": false,
  "message": "...",
  "error_code": "ANY_OTHER_ERROR_CODE"
}

- Log the full response internally.
- Return to app:
{
  "success": false,
  "message": "Server error",
  "error_code": "SERVER_ERROR"
}

---

### 4.3 If response is:
{
  "success": true,
  "message": "Session is valid",
  "data": {
    "valid": true,
    "expires_in": 2079,
    "user_id": "user123"
  }
}

→ Call a function (e.g., `getAppConfig(user_id)`) with pass user_id that fetches app config data.

Example function output:
{
  "max_tokens": 2000,
  "support_email": "support@example.com",
  "language": "en",
  "features": ["chat", "analytics", "premium-voice"]
  etc.
}

Return to app:
{
  "success": true,
  "message": "App configuration fetched successfully",
  "data": {app config data from function}
}

---

## 🗂️ Summary Table

Step | Action                      | Description
-----|-----------------------------|-----------------------------------------------
1    | Client → API Server         | Sends session_token, user_id, device_id
2    | API Server → DB             | Validates device ownership
3    | API Server → Auth Server    | Validates session
4    | API Server ← Auth Response  | Handles success or failure from auth server
5    | API Server → Config Logic   | Calls config fetch function (e.g. `getAppConfig()`)
6    | API Server → Client         | Sends config JSON or error message



# all - 
api_key_free
api_key_pro
app_guide
app_logo
dev_info
extra_css
extra_js
latest_version_info
max_message_length_free
max_message_length_pro
modal_free
modal_pro
system_instructions_free
system_instructions_pro
tts_api

#for pro user type

api_key_pro > api_key
app_guide > app_guide
app_logo > app_logo
dev_info > dev_info
extra_css > extra_css
extra_js > extra_js
latest_version_info > latest_version_info
max_message_length_pro > max_message_length
modal_pro > modal
system_instructions_pro > system_instructions
tts_api > tts_api

#for free user type

api_key_free > api_key
app_guide > app_guide
app_logo > app_logo
dev_info > dev_info
extra_css > extra_css
extra_js > extra_js
latest_version_info > latest_version_info
max_message_length_free > max_message_length
modal_free > modal
system_instructions_pro > system_instructions
NULL > tts_api

#Final Responce to send based of free or pro

api_key
app_guide
app_logo
dev_info
extra_css
extra_js
latest_version_info
max_message_length
modal
system_instructions
tts_api
