import json, base64, hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# 🔐 Key Generator: uses static key + custom string
def generate_aes_key_from_custom(static_key: bytes, custom_str: str) -> bytes:
    combined = static_key + custom_str.encode('utf-8')
    return hashlib.sha256(combined).digest()  # 32-byte key

# 🔒 Encrypt JSON
def encrypt_json(json_obj, custom_str: str, static_key: bytes, static_iv: bytes):
    try:
        key = generate_aes_key_from_custom(static_key, custom_str)
        iv = static_iv  # use provided IV

        json_bytes = json.dumps(json_obj).encode()
        padder = padding.PKCS7(128).padder()
        padded = padder.update(json_bytes) + padder.finalize()

        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded) + encryptor.finalize()

        encrypted_data = base64.b64encode(encrypted).decode()
        return {"success": True, "data": encrypted_data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 🔓 Decrypt JSON
def decrypt_json(encrypted_data: str, custom_str: str, static_key: bytes, static_iv: bytes):
    try:
        key = generate_aes_key_from_custom(static_key, custom_str)
        iv = static_iv
        encrypted = base64.b64decode(encrypted_data)

        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()

        unpadder = padding.PKCS7(128).unpadder()
        decrypted = unpadder.update(decrypted_padded) + unpadder.finalize()

        json_obj = json.loads(decrypted.decode())
        return {"success": True, "data": json_obj}
    except Exception as e:
        return {"success": False, "error": str(e)}
