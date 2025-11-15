<?php
// user_helper_functions.php

function auth_server_login($email, $password) {    // Construct URL as per API documentation    // Make sure base url has trailing slash like in Python test
    $base_url = rtrim(AUTH_SERVER_URL, '/') . '/api/v1/';
    $url = $base_url . '?type=login';
    
    // Log raw request data for debugging
    error_log("Raw request data: " . print_r([
        'url' => $url,
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], true));
    
    // Construct payload exactly like Python test
    $payload = json_encode([
        'email' => $email,
        'password' => $password,
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    
    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . AUTH_USER_AGENT,
        'Accept: application/json'
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Log the response for debugging
    error_log("Auth server response: HTTP $http_code - URL: $url - Request: " . print_r([
        'headers' => $headers,
        'payload' => $payload
    ], true) . " - Response: $result");
    
    if (!$result) {
        return ['success' => false, 'message' => 'An error occurred on the server. Please try again later.'];
    }
    
    $data = json_decode($result, true);
      // Handle error responses according to API spec
    if (!isset($data['success']) || !$data['success']) {
        // Log the error for debugging
        error_log("Auth server error: HTTP $http_code - URL: $url - Payload: $payload - Response: $result");

        // Handle specific error codes
        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'INVALID_CREDENTIALS') {
                if (isset($data['message']) && $data['message'] === 'ACCOUNT_DEACTIVE') {
                    return [
                        'success' => false,
                        'message' => 'Your account has been deactivated by auth server. Please contact support.'
                    ];
                }
                return [
                    'success' => false,
                    'message' => 'Invalid credentials'
                ];
            }
        }

        // For any other error, return generic message
        return [
            'success' => false,
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    return ['success' => true, 'data' => $data['data']];
}

function get_user_by_email($email){
    global $pdo;
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $result = $stmt->fetch();
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function get_user_by_external_id($external_id) {
    global $pdo;
    $stmt = $pdo->prepare('SELECT * FROM users WHERE external_id = ?');
    $stmt->execute([$external_id]);
    $result = $stmt->fetch();
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function create_user($external_id, $device_id, $email) {
    global $pdo;
    $stmt = $pdo->prepare('INSERT INTO users (external_id, device_id, status, email) VALUES (?, ?, \'active\', ?)');
    $result = $stmt->execute([$external_id, $device_id, $email]);
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function update_user_device($external_id, $device_id) {
    global $pdo;
    $stmt = $pdo->prepare('UPDATE users SET device_id = ? WHERE external_id = ?');
    $result = $stmt->execute([$device_id, $external_id]);
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function get_user_subscription($external_id) {
    global $pdo;
    $stmt = $pdo->prepare('SELECT * FROM subscriptions WHERE external_id = ? ORDER BY expires_at DESC LIMIT 1');
    $stmt->execute([$external_id]);
    $result = $stmt->fetch();
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function auth_server_logout($user_id, $session_token) {
    // Construct URL as per API documentation
    $base_url = rtrim(AUTH_SERVER_URL, '/') . '/api/v1/';
    $url = $base_url . '?type=logout';
    
    // Construct payload as per API documentation
    $payload = json_encode([
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    
    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . AUTH_USER_AGENT,
        'Accept: application/json',
        'Authorization: Bearer ' . $session_token,
        'X-User-ID: ' . $user_id
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Log the response for debugging
    error_log("Auth server logout response: HTTP $http_code - URL: $url - Request: " . print_r([
        'headers' => $headers,
        'payload' => $payload
    ], true) . " - Response: $result");
    
    if (!$result) {
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    $data = json_decode($result, true);
      if (!isset($data['success']) || !$data['success']) {
        // Handle specific error cases
        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'INVALID_TOKEN') {
                return [
                    'success' => false,
                    'error_code' => 'INVALID_TOKEN',
                    'message' => 'Invalid or expired session token'
                ];
            }
            // Check for account deactivation message
            if (isset($data['message']) && $data['message'] === 'ACCOUNT_DEACTIVE') {
                return [
                    'success' => false,
                    'error_code' => 'ACCOUNT_DEACTIVE',
                    'message' => 'Your account has been deactivated by auth server. Please contact support.'
                ];
            }
        }
        
        // Log unknown errors and return generic error
        error_log("Auth server unknown logout error: HTTP $http_code - Response: $result");
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    return ['success' => true];
}

function auth_server_refresh($user_id, $session_token, $refresh_token) {
    // Construct URL as per API documentation
    $base_url = rtrim(AUTH_SERVER_URL, '/') . '/api/v1/';
    $url = $base_url . '?type=refresh';
    
    // Construct payload as per API documentation
    $payload = json_encode([
        'refresh_token' => $refresh_token,
        'old_session_token' => $session_token,
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    
    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . AUTH_USER_AGENT,
        'Accept: application/json',
        'Authorization: Bearer ' . $session_token,
        'X-User-ID: ' . $user_id
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Log the response for debugging
    error_log("Auth server refresh response: HTTP $http_code - URL: $url - Request: " . print_r([
        'headers' => $headers,
        'payload' => $payload
    ], true) . " - Response: $result");
    
    if (!$result) {
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    $data = json_decode($result, true);
      if (!isset($data['success']) || !$data['success']) {
        // Handle specific error cases
        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'INVALID_TOKEN') {
                return [
                    'success' => false,
                    'error_code' => 'INVALID_TOKEN',
                    'message' => 'Invalid or expired refresh token'
                ];
            }
            // Check for account deactivation message
            if (isset($data['message']) && $data['message'] === 'ACCOUNT_DEACTIVE') {
                return [
                    'success' => false,
                    'error_code' => 'ACCOUNT_DEACTIVE',
                    'message' => 'Your account has been deactivated by auth server. Please contact support.'
                ];
            }
        }
        
        // Log unknown errors and return generic error
        error_log("Auth server unknown refresh error: HTTP $http_code - Response: $result");
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    return ['success' => true, 'data' => $data['data']];
}

function auth_server_validate($user_id, $session_token) {
    // Construct URL as per API documentation
    $base_url = rtrim(AUTH_SERVER_URL, '/') . '/api/v1/';
    $url = $base_url . '?type=validate';
    
    // Construct payload as per API documentation
    $payload = json_encode([
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    
    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . AUTH_USER_AGENT,
        'Accept: application/json',
        'Authorization: Bearer ' . $session_token,
        'X-User-ID: ' . $user_id
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Log the response for debugging
    error_log("Auth server validate response: HTTP $http_code - URL: $url - Request: " . print_r([
        'headers' => $headers,
        'payload' => $payload
    ], true) . " - Response: $result");
    
    if (!$result) {
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    $data = json_decode($result, true);
      if (!isset($data['success']) || !$data['success']) {
        // Handle specific error cases
        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'INVALID_TOKEN') {
                return [
                    'success' => false,
                    'error_code' => 'INVALID_TOKEN',
                    'message' => 'Invalid or expired session token'
                ];
            }
            // Check for account deactivation message
            if (isset($data['message']) && $data['message'] === 'ACCOUNT_DEACTIVE') {
                return [
                    'success' => false,
                    'error_code' => 'ACCOUNT_DEACTIVE',
                    'message' => 'Your account has been deactivated by auth server. Please contact support.'
                ];
            }
        }
        
        // Log unknown errors and return generic error
        error_log("Auth server unknown validate error: HTTP $http_code - Response: $result");
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    return ['success' => true, 'data' => $data['data']];
}

function update_user_last_seen($external_id) {
    global $pdo;
    $stmt = $pdo->prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE external_id = ?');
    $result = $stmt->execute([$external_id]);
    $stmt->closeCursor();
    $stmt = null;
    return $result;
}

function auth_server_profile($user_id, $session_token) {
    // Construct URL as per API documentation
    $base_url = rtrim(AUTH_SERVER_URL, '/') . '/api/v1/';
    $url = $base_url . '?type=profile';
    
    // Construct payload as per API documentation
    $payload = json_encode([
        'client_id' => AUTH_CLIENT_ID,
        'client_secret' => AUTH_CLIENT_SECRET
    ], JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    
    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . AUTH_USER_AGENT,
        'Accept: application/json',
        'Authorization: Bearer ' . $session_token,
        'X-User-ID: ' . $user_id
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Log the response for debugging
    error_log("Auth server profile response: HTTP $http_code - URL: $url - Request: " . print_r([
        'headers' => $headers,
        'payload' => $payload
    ], true) . " - Response: $result");
    
    if (!$result) {
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    $data = json_decode($result, true);
    
    if (!isset($data['success']) || !$data['success']) {
        // Handle specific error cases
        if (isset($data['error_code'])) {
            if ($data['error_code'] === 'INVALID_TOKEN') {
                return [
                    'success' => false,
                    'error_code' => 'INVALID_TOKEN',
                    'message' => 'Invalid or expired session token'
                ];
            }
            // Check for account deactivation message
            if (isset($data['message']) && $data['message'] === 'ACCOUNT_DEACTIVE') {
                return [
                    'success' => false,
                    'error_code' => 'ACCOUNT_DEACTIVE',
                    'message' => 'Your account has been deactivated by auth server. Please contact support.'
                ];
            }
        }
        
        // Log unknown errors and return generic error
        error_log("Auth server unknown profile error: HTTP $http_code - Response: $result");
        return [
            'success' => false,
            'error_code' => 'SERVER_ERROR',
            'message' => 'An error occurred on the server. Please try again later.'
        ];
    }
    
    return ['success' => true, 'data' => $data['data']];
}

/**
 * Retrieves application configuration settings from the database
 * 
 * @param string $user_id The ID of the user requesting configuration
 * @return array Array with 'success' boolean and either 'data' array of config or 'message' error string
 */
function getAppConfig($user_id) {
    global $pdo;
    
    try {
        // Define plan types
        $free_plans = ['free'];
        $pro_plans = ['pro', 'premium', 'professional']; // Add more pro plan types as needed
          // First, get all app config settings
        $stmt = $pdo->prepare("SELECT type, value FROM app_config");
        $stmt->execute();
        $config_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt->closeCursor();
        $stmt = null;
        
        if (!$config_rows) {
            return [
                'success' => false,
                'message' => 'App configuration not found in database'
            ];
        }
        
        // Convert rows to key-value array
        $all_config = [];
        foreach ($config_rows as $row) {
            // Try to decode as JSON first, if not, use as string
            $value = json_decode($row['value'], true);
            $all_config[$row['type']] = $value !== null ? $value : $row['value'];
        }
          // Check user subscription
        $stmt = $pdo->prepare("
            SELECT plan 
            FROM subscriptions 
            WHERE external_id = ? 
            AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC 
            LIMIT 1
        ");        $stmt->execute([$user_id]);
        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();
        $stmt = null;
        
        // Determine user type
        $user_type = 'free'; // default
        
        if ($subscription) {
            $plan = $subscription['plan'];
            if (in_array($plan, $pro_plans)) {
                $user_type = 'pro';
            } elseif (in_array($plan, $free_plans)) {
                $user_type = 'free';
            }
        } else {
            // No subscription found, default to free
            $user_type = 'free';
        }
        
        // Map configuration based on user type
        $final_config = [];
        
        if ($user_type === 'pro') {
            // Pro user mappings
            $final_config['api_key'] = $all_config['api_key_pro'] ?? null;
            $final_config['app_guide'] = $all_config['app_guide'] ?? null;
            $final_config['app_logo'] = $all_config['app_logo'] ?? null;
            $final_config['dev_info'] = $all_config['dev_info'] ?? null;
            $final_config['extra_css'] = $all_config['extra_css'] ?? null;
            $final_config['extra_js'] = $all_config['extra_js'] ?? null;
            $final_config['latest_version_info'] = $all_config['latest_version_info'] ?? null;
            $final_config['max_message_length'] = $all_config['max_message_length_pro'] ?? null;
            $final_config['modal'] = $all_config['modal_pro'] ?? null;
            $final_config['system_instructions'] = $all_config['system_instructions_pro'] ?? null;
            $final_config['tts_api'] = $all_config['tts_api'] ?? null;
            $final_config['model_temp'] = $all_config['model_temp'] ?? null;
            $final_config['max_output_tokens'] = $all_config['max_output_tokens_pro'] ?? null;
        } else {
            // Free user mappings
            $final_config['api_key'] = $all_config['api_key_free'] ?? null;
            $final_config['app_guide'] = $all_config['app_guide'] ?? null;
            $final_config['app_logo'] = $all_config['app_logo'] ?? null;
            $final_config['dev_info'] = $all_config['dev_info'] ?? null;
            $final_config['extra_css'] = $all_config['extra_css'] ?? null;
            $final_config['extra_js'] = $all_config['extra_js'] ?? null;
            $final_config['latest_version_info'] = $all_config['latest_version_info'] ?? null;
            $final_config['max_message_length'] = $all_config['max_message_length_free'] ?? null;
            $final_config['modal'] = $all_config['modal_free'] ?? null;
            $final_config['system_instructions'] = $all_config['system_instructions_free'] ?? null;
            $final_config['tts_api'] = null; // NULL for free users
            $final_config['model_temp'] = $all_config['model_temp'] ?? null;
            $final_config['max_output_tokens'] = $all_config['max_output_tokens_free'] ?? null;
        }
          // Add user-type to final_config
        $final_config['user-type'] = $user_type;

        return [
            'success' => true,
            'data' => $final_config
        ];
        
    } catch (PDOException $e) {
        // Log the database error
        if (defined('ENVIRONMENT') && ENVIRONMENT === 'development') {
            error_log('Database error in getAppConfig: ' . $e->getMessage());
        }
        
        return [
            'success' => false,
            'message' => 'Database error occurred'
        ];
    } catch (Exception $e) {
        // Log other errors
        if (defined('ENVIRONMENT') && ENVIRONMENT === 'development') {
            error_log('General error in getAppConfig: ' . $e->getMessage());
        }
        
        return [
            'success' => false,
            'message' => 'An unexpected error occurred'
        ];
    }
}

function get_subscription_code($code, $external_id = null) {
    global $pdo;
    
    // First check if code exists and is valid
    $stmt = $pdo->prepare('SELECT * FROM subscription_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > NOW()) AND redeemed_count < redeem_limit');
    $stmt->execute([$code]);
    $result = $stmt->fetch();
    $stmt->closeCursor();
    
    if (!$result) {
        return null;
    }
    
    // If external_id is provided, check if user has already used this code
    if ($external_id) {
        $stmt = $pdo->prepare('SELECT COUNT(*) as used FROM code_redemptions WHERE code = ? AND external_id = ?');
        $stmt->execute([$code, $external_id]);
        $usage = $stmt->fetch();
        $stmt->closeCursor();
        
        if ($usage['used'] > 0) {
            return ['error' => 'You have already redeemed this code'];
        }
    }
    
    return $result;
}

function increment_code_usage($code, $external_id) {
    global $pdo;
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        // Increment the usage count
        $stmt = $pdo->prepare('UPDATE subscription_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?');
        $result = $stmt->execute([$code]);
        
        if (!$result) {
            throw new Exception('Failed to update code usage count');
        }
        
        // Record the redemption for this user
        $stmt = $pdo->prepare('INSERT INTO code_redemptions (code, external_id) VALUES (?, ?)');
        $result = $stmt->execute([$code, $external_id]);
        
        if (!$result) {
            throw new Exception('Failed to record code redemption');
        }
        
        // Commit transaction
        $pdo->commit();
        return true;
        
    } catch (Exception $e) {
        // Rollback on error
        $pdo->rollBack();
        error_log('Error incrementing code usage: ' . $e->getMessage());
        return false;
    }
}

function apply_subscription($external_id, $plan, $duration) {
    global $pdo;
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        // Check current subscription
        $stmt = $pdo->prepare('SELECT id, expires_at FROM subscriptions WHERE external_id = ? ORDER BY expires_at DESC LIMIT 1');
        $stmt->execute([$external_id]);
        $current_sub = $stmt->fetch();
        $stmt->closeCursor();
        
        // Calculate new expiration date
        $now = new DateTime();
        if ($current_sub && strtotime($current_sub['expires_at']) > time()) {
            // Add duration to existing expiration
            $expires_at = new DateTime($current_sub['expires_at']);
            $expires_at->add(new DateInterval("P{$duration}D"));
        } else {
            // Set duration from now
            $expires_at = $now->add(new DateInterval("P{$duration}D"));
        }

        if ($current_sub) {
            // Update existing subscription
            $stmt = $pdo->prepare('UPDATE subscriptions SET plan = ?, expires_at = ? WHERE id = ?');
            $result = $stmt->execute([$plan, $expires_at->format('Y-m-d H:i:s'), $current_sub['id']]);
        } else {
            // Insert new subscription only if none exists
            $stmt = $pdo->prepare('INSERT INTO subscriptions (external_id, plan, expires_at) VALUES (?, ?, ?)');
            $result = $stmt->execute([$external_id, $plan, $expires_at->format('Y-m-d H:i:s')]);
        }
        $stmt->closeCursor();
        
        // Commit transaction
        $pdo->commit();
        
        return [
            'success' => true,
            'expires_at' => $expires_at->format('Y-m-d H:i:s')
        ];
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $pdo->rollBack();
        error_log('Error applying subscription: ' . $e->getMessage());
        return [
            'success' => false,
            'message' => 'Failed to apply subscription'
        ];
    }
}