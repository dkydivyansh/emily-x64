# Centralized Authentication System API

## Overview

This document describes the API interface for the Centralized Authentication System. All API operations use a single endpoint with different request types.

## API Architecture

### Endpoint Structure

All requests use a single base endpoint:
```
/api/v1
```

Request type is specified via the `type` parameter:
- In URL query: `/api/v1?type=login`
- In JSON body: `{"type": "login", ...}`

### Authentication Method

All authenticated requests require:
- Session token in the `Authorization` header
- User ID in the `X-User-ID` header (except login)
- Client credentials in the request body

## Core Operations

1. **Login** - Authenticate user credentials
2. **Refresh** - Obtain new session using refresh token
3. **Logout** - Terminate current session
4. **Validate** - Verify session validity
5. **Profile** - Access user profile information

## Authentication Components

| Component | Location | Required For | Lifetime |
|-----------|----------|--------------|----------|
| Client ID | Request body | All requests | Permanent |
| Client Secret | Request body | All requests | Permanent |
| User ID | X-User-ID header | All except login | Permanent |
| Session Token | Authorization header | All except login | 1 hour |
| Refresh Token | Request body | Refresh operation | 30 days |
| Old Session Token | Request body | Refresh operation | Until refreshed |

## Response Format

All API responses include the following standard fields:

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether the request was successful (true/false) |
| message | string | Informative message about the result |
| data | object | The actual response data (varies by endpoint) |

For error responses, additional fields include:
- error_code
- request_id

## API Flows

### 1. Authentication Flow

```
┌──────────┐                                  ┌──────────┐                           
│          │                                  │          │                           
│  Client  │                                  │ Auth     │                           
│  App     │                                  │ Server   │                           
└──────────┘                                  └──────────┘                           
      │                                             │                                
      │  1. Login Request                           │                                
      │  POST /api/v1?type=login                    │                                
      │  Content-Type: application/json             │                                
      │  {                                          │                                
      │    "email": "example_user@example.com",             │                                
      │    "password": "your_password",               │                                
      │    "client_id": "your_client_id",                │
      │    "client_secret": "your_client_secret"     │                                
      │  }                                          │                                
      │ ──────────────────────────────────────────► │                                
      │                                             │                                
      │  2. Login Response                          │                                
      │  {                                          │                                
      │    "success": true,                         │
      │    "message": "Authentication successful",  │
      │    "data": {                                │
      │      "session_token": "your_session_token",     │                               
      │      "refresh_token": "your_refresh_token",     │                               
      │      "expires_in": 3600,                    │                                
      │      "user_id": "your_user_id"                   │                                
      │    }                                        │
      │  }                                          │                                
      │ ◄────────────────────────────────────────── │                                
      │                                             │                                
      │  3. API Request                             │                                
      │  GET /api/v1?type=profile                   │                                
      │  Authorization: Bearer your_session_token       │
      │  X-User-ID: your_user_id                         │
      │  Content-Type: application/json             │
      │  {                                          │
      │    "client_id": "your_client_id",                │
      │    "client_secret": "your_client_secret"     │
      │  }                                          │
      │ ──────────────────────────────────────────► │                                
      │                                             │                                
      │  4. API Response                            │                                
      │  {                                          │                                
      │    "success": true,                         │
      │    "message": "Profile retrieved successfully", │
      │    "data": {                                │
      │      "user": { ... }                        │
      │    }                                        │
      │  }                                          │                                
      │◄────────────────────────────────────────── │                                
```

### 2. Token Refresh Flow

```
┌──────────┐                                  ┌──────────┐
│          │                                  │          │
│  Client  │                                  │ Auth     │
│  App     │                                  │ Server   │
└──────────┘                                  └──────────┘
      │                                             │
      │  1. Refresh Request                         │
      │  POST /api/v1?type=refresh                  │
      │  Authorization: Bearer your_session_token       │
      │  X-User-ID: your_user_id                         │
      │  Content-Type: application/json             │
      │  {                                          │
      │    "refresh_token": "your_refresh_token",       │
      │    "old_session_token": "your_session_token",   │
      │    "client_id": "your_client_id",                │
      │    "client_secret": "your_client_secret"     │
      │  }                                          │
      │ ──────────────────────────────────────────► │
      │                                             │
      │  2. Refresh Response                        │
      │  {                                          │
      │    "success": true,                         │
      │    "message": "Session refreshed successfully", │
      │    "data": {                                │
      │      "session_token": "new_session_token",     │
      │      "refresh_token": "new_refresh_token",     │
      │      "expires_in": 3600                     │
      │    }                                        │
      │  }                                          │
      │ ◄────────────────────────────────────────── │
```

## API Reference

### Login

**Request:**
```
POST /api/v1?type=login
Content-Type: application/json

{
  "email": "example_user@example.com",
  "password": "your_password",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

**Response:**
```
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "session_token": "your_session_token",
    "refresh_token": "your_refresh_token",
    "expires_in": 3600,
    "user_id": "your_user_id"
  }
}
```

**Error Response:**
```
{
  "success": false,
  "message": "Invalid credentials provided",
  "error_code": "INVALID_CREDENTIALS",
  "request_id": "your_request_id"
}
```

### Refresh

**Request:**
```
POST /api/v1?type=refresh
Authorization: Bearer your_session_token
X-User-ID: your_user_id
Content-Type: application/json

{
  "refresh_token": "your_refresh_token",
  "old_session_token": "your_session_token",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

**Response:**
```
{
  "success": true,
  "message": "Session refreshed successfully",
  "data": {
    "session_token": "new_session_token",
    "refresh_token": "new_refresh_token",
    "expires_in": 3600
  }
}
```

**Error Response:**
```
{
  "success": false,
  "message": "Invalid or expired refresh token",
  "error_code": "INVALID_TOKEN",
  "request_id": "your_request_id"
}
```

### Logout

**Request:**
```
POST /api/v1?type=logout
Authorization: Bearer your_session_token
X-User-ID: your_user_id
Content-Type: application/json

{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

**Response:**
```
{
  "success": true,
  "message": "Session terminated successfully",
  "data": {}
}
```

### Validate

**Request:**
```
POST /api/v1?type=validate
Authorization: Bearer your_session_token
X-User-ID: your_user_id
Content-Type: application/json

{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

**Response:**
```
{
  "success": true,
  "message": "Session is valid",
  "data": {
    "valid": true,
    "expires_in": 2845,
    "user_id": "your_user_id"
  }
}
```

**Error Response:**
```
{
  "success": false,
  "message": "Invalid session",
  "error_code": "INVALID_TOKEN",
  "request_id": "your_request_id"
}
```

### Profile

**Request:**
```
GET /api/v1?type=profile
Authorization: Bearer your_session_token
X-User-ID: your_user_id
Content-Type: application/json

{
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

**Response:**
```
{
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
        "user": {
            "user_id": "user_id_example",
            "email": "user@example.com",
            "name": "User Name",
            "date_of_birth": "YYYY-MM-DD",
            "phone_number": "",
            "profile_photo": "https://auth.dkydivyansh.com/uploads/avatars/dc4375bd-42fe-4def-9cd5-73c4bcc1d6c7_1747040219.png",
            "status": "active",
            "gender": "male",
            "created_at": "YYYY-MM-DD HH:MM:SS",
            "updated_at": "YYYY-MM-DD HH:MM:SS"
        }
    }
}
```

## Error Handling

All errors follow a consistent format:

```
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": "ERROR_CODE_HERE",
  "request_id": "your_request_id" // For support reference
}
```

### Common Error Codes

| Code | Description | Sample Message |
|------|-------------|----------------|
| INVALID_CREDENTIALS | Email or password incorrect | "Invalid credentials provided" |
| EXPIRED_TOKEN | Session token has expired | "Session expired, please login again" |
| INVALID_TOKEN | Session token is invalid | "Invalid session token" |
| MISSING_PARAMETER | Required parameter is missing | "Missing required parameter: client_id" |
| MISSING_HEADER | Required header is missing | "Missing required header: X-User-ID" |
| USER_MISMATCH | User ID header doesn't match token | "User ID in header doesn't match session" |
| CLIENT_ERROR | Client ID or secret invalid | "Invalid client credentials" |
| SERVER_ERROR | Internal server error | "An internal error occurred" |
| RATE_LIMITED | Too many requests | "Rate limit exceeded, try again later" |

## Security Considerations

1. **Authentication Chain** - Session tokens chain to refresh tokens for secure renewal
2. **Triple Verification** - Each request verified by session token, client credentials, and user ID header
3. **TLS Required** - All API communications require HTTPS
4. **Token Expiration** - Short-lived session tokens (1 hour)
5. **Credential Protection** - Client secrets must be protected with appropriate measures
6. **Request Logging** - All authentication events are logged for security auditing
7. **Header Validation** - User ID in header must match the user associated with the session token

## Implementation Guidelines


2. Include proper error handling for token expiration
3. Implement automatic token refresh when session expires
4. Always validate server SSL certificates
5. Never include tokens in URL parameters
6. Always send user ID in header for all authenticated requests
7. Rate-limit authentication attempts from the same IP address
8. Log all authentication failures for security monitoring