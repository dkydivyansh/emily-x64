<?php
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
$session_token = $input['session_token'] ?? null;

// Validate required fields
if (!$user_id || !$session_token) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Step 1 & 2: Verify user and check status
$user = get_user_by_external_id($user_id);
if (!$user) {
    echo json_encode([
        'success' => false,
        'message' => 'Session does not belong to this server'
    ]);
    exit;
}

if ($user['status'] !== 'active') {
    echo json_encode([
        'success' => false,
        'message' => 'Account is deactivated. Please contact support.'
    ]);
    exit;
}

// Verify device_id matches
if ($user['device_id'] !== $input['device_id']) {
    echo json_encode([
        'success' => false,
        'message' => 'Request from unauthorized device'
    ]);
    exit;
}

// Step 3: Forward logout to auth server
$auth_response = auth_server_logout($user_id, $session_token);

// Step 4: Handle auth server response
if (!$auth_response['success']) {
    if ($auth_response['error_code'] === 'INVALID_TOKEN') {
        echo json_encode([
            'success' => false,
            'error_code' => 'INVALID_TOKEN',
            'message' => 'Invalid or expired session'
        ]);
    } else {
        // Log the error and return generic error message
        error_log("Logout error for user $user_id: " . print_r($auth_response, true));
        echo json_encode([
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ]);
    }
    exit;
}

// On successful logout, clear the device_id
update_user_device($user_id, null);

// Return success response
echo json_encode([
    'success' => true,
    'message' => 'Session terminated successfully'
]);
