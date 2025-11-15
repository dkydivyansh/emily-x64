<?php
// userinfo.php - Handles API user info requests
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

// Check if user status is active
if ($user['status'] !== 'active') {
    echo json_encode([
        'success' => false,
        'message' => 'Account is deactivated. Please contact support.'
    ]);
    exit;
}

// Forward user info request to auth server
$auth_response = auth_server_profile($user_id, $session_token);

if (!$auth_response['success']) {
    echo json_encode([
        'success' => false,
        'error_code' => $auth_response['error_code'] ?? 'SERVER_ERROR',
        'message' => $auth_response['message']
    ]);
    exit;
}

// Get user's subscription info
$subscription = get_user_subscription($user_id);

// Prepare the combined response
$response_data = [
    'email' => $auth_response['data']['user']['email'],
    'name' => $auth_response['data']['user']['name'],
    'date_of_birth' => $auth_response['data']['user']['date_of_birth'],
    'profile_photo' => $auth_response['data']['user']['profile_photo'],
    'gender' => $auth_response['data']['user']['gender'],
    'memory_data' => $user['memory_data'],
    'subscription' => $subscription ?: null
];

// Forward successful response to client with combined data
echo json_encode([
    'success' => true,
    'message' => 'User profile retrieved successfully',
    'data' => $response_data
]);
