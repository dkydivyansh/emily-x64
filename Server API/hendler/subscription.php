    <?php
// subscription.php - Handles API subscription redemption requests

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
$redeem_code = $input['redeem_code'] ?? null;

// Check if this is a confirmation request
$is_confirm = isset($_GET['confirm']) && $_GET['confirm'] === 'Yes';

// Validate required fields
if (!$user_id || !$device_id || !$session_token || (!$is_confirm && !$redeem_code)) {
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

// Validate session with auth server
$auth_response = auth_server_validate($user_id, $session_token);
if (!$auth_response['success']) {
    echo json_encode([
        'success' => false,
        'error_code' => $auth_response['error_code'] ?? 'SERVER_ERROR',
        'message' => $auth_response['message']
    ]);
    exit;
}

if (!$is_confirm) {
    // First request - validate code and check if user has already used it
    $code_data = get_subscription_code($redeem_code, $user_id);
    
    if (!$code_data) {
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or expired redemption code'
        ]);
        exit;
    }
    
    if (isset($code_data['error'])) {
        echo json_encode([
            'success' => false,
            'message' => $code_data['error']
        ]);
        exit;
    }

    // Return subscription details for confirmation
    echo json_encode([
        'success' => true,
        'message' => 'Valid redemption code',
        'data' => [
            'plan' => $code_data['plan'],
            'duration' => $code_data['duration'],
            'confirm_url' => $_SERVER['REQUEST_URI'] . '?confirm=Yes'
        ]
    ]);
    exit;
}

// Confirmation request - validate code again and apply the subscription
$code_data = get_subscription_code($redeem_code, $user_id);
if (!$code_data) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or expired redemption code'
    ]);
    exit;
}
if (isset($code_data['error'])) {
    echo json_encode([
        'success' => false,
        'message' => $code_data['error']
    ]);
    exit;
}

// Apply the subscription
$subscription_result = apply_subscription($user_id, $code_data['plan'], $code_data['duration']);
if (!$subscription_result['success']) {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to apply subscription'
    ]);
    exit;
}

// Increment the code usage and record redemption
if (!increment_code_usage($redeem_code, $user_id)) {
    // Log the error but still indicate success since subscription was applied
    error_log("Failed to increment code usage for code $redeem_code by user $user_id");
}

// Return success response
echo json_encode([
    'success' => true,
    'message' => 'Subscription applied successfully',
    'data' => [
        'plan' => $code_data['plan'],
        'expires_at' => $subscription_result['expires_at']
    ]
]);
