<?php
// validate.php - Handles API token validation requests
// Refer to auth_server_api_flow.md for flow and logic

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

header('Content-Type: application/json');

// Only allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// Parse request body
$input = json_decode(file_get_contents('php://input'), true);
$user_id = $input['user_id'] ?? null;
$device_id = $input['device_id'] ?? null;
$session_token = $input['session_token'] ?? null;

// Validate required fields
if (!$user_id || !$device_id || !$session_token) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Check if user exists and validate device ownership
$user = get_user_by_external_id($user_id);
if (!$user) {
    echo json_encode([
        'success' => false,
        'message' => 'Session does not belong to this server'
    ]);
    exit;
}

// Check device_id matches
if ($user['device_id'] !== $device_id) {
    echo json_encode([
        'success' => false,
        'message' => 'Request from unauthorized device'
    ]);
    exit;
}

// Forward validation request to auth server
$auth_response = auth_server_validate($user_id, $session_token);

if (!$auth_response['success']) {
    echo json_encode([
        'success' => false,
        'error_code' => $auth_response['error_code'] ?? 'SERVER_ERROR',
        'message' => $auth_response['message']
    ]);
    exit;
}

// Forward successful response to client
echo json_encode([
    'success' => true,
    'message' => 'Session is valid',
    'data' => [
        'valid' => true,
        'expires_in' => $auth_response['data']['expires_in'],
        'user_id' => $user_id
    ]
]);
