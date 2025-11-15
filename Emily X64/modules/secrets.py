KEY = b'your_secret_key'
IV = b'your_initialization_vector'
base_api_uri = "https://example.com/Project/api/emilyx64/"
api_uris = {
    "server_sts_url" : f"{base_api_uri}serversts",
    "login_api" : f"{base_api_uri}auth/login",
    "logout_api" : f"{base_api_uri}auth/logout",
    "token_velidation_api" : f"{base_api_uri}auth/validate",
    "token_refresh_api" : f"{base_api_uri}auth/refresh",
    "user_info_api" : f"{base_api_uri}app/userinfo",
    "app_config_api" : f"{base_api_uri}app/config",
    "app_update_api" : f"{base_api_uri}app/update",
    "app_voise_api" : "https://api.v8.unrealspeech.com/speech",
    "subcription_api" : f"{base_api_uri}app/subscription",
    "apply_subscription_api" : f"{base_api_uri}app/subscription?confirm=Yes",

}

headers = {
    'User-Agent': 'your_user_agent',
    'Content-Type': 'application/json'
}
