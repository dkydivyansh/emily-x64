<?php
// login.php - Handles API login requests
// Refer to apiserver.md for flow and logic

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = $input['email'] ?? null;
$password = $input['password'] ?? null;
$device_id = $input['device_id'] ?? null;

if (!$email || !$password || !$device_id) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Step 1: Query user by email
$user = get_user_by_email($email);
if ($user) {
    if ($user['status'] !== 'active') {
        echo json_encode(['success' => false, 'message' => 'Account is deactivated. Please contact support.']);
        exit;
    }
    // Only block if device_id is different AND not NULL
    if ($user['device_id'] !== null && $user['device_id'] !== $device_id) {
        echo json_encode(['success' => false, 'message' => 'Account already logged in on another device']);
        exit;
    }
    // Proceed to auth server login (same device re-login or NULL device_id)
}
// If no user, proceed to auth server login

// Forward login to Auth Server
$auth_response = auth_server_login($email, $password);
if (!$auth_response['success']) {
    error_log("Login failed for email: $email - Message: " . $auth_response['message']);
    echo json_encode(['success' => false, 'message' => $auth_response['message']]);
    exit;
}

// On success, update or insert user
$user_id = $auth_response['data']['user_id'];
if (!get_user_by_external_id($user_id)) {
    create_user($user_id, $device_id, $email);
} else {
    update_user_device($user_id, $device_id);
}

// Update last_seen timestamp
update_user_last_seen($user_id);

// Return final response
$response = [
    'success' => true,
    'message' => 'Login successful',
    'data' => [
        'session_token' => $auth_response['data']['session_token'],
        'refresh_token' => $auth_response['data']['refresh_token'],
        'expires_in' => $auth_response['data']['expires_in'],
        'user_id' => $user_id
    ]
];
echo json_encode($response);
