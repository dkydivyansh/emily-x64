class MemoryManager:
    def __init__(self, save_memory_callback):
        """
        :param save_memory_callback: Function that accepts one argument (memory dict) and saves it externally.
        """
        self.memory = {}
        self.save_callback = save_memory_callback

    def load_memory(self, memory_data: dict = None):
        """Load memory externally or initialize with default structure."""
        if memory_data and isinstance(memory_data, dict) and self._validate_memory_structure(memory_data):
            self.memory = memory_data
        else:
            self.memory = self._initialize_structure()
            self._save()

    def get_memory(self):
        """Return the full memory object."""
        return self.memory
    
    def list_categories(self):
        return list(self.memory.keys())

    def list_keys(self, category):
        if category in self.memory and isinstance(self.memory[category], dict):
            return list(self.memory[category].keys())
        return []

    def set(self, category, key, value):
        if category not in self.memory:
            self.memory[category] = {}
    
        # Auto-fix if somehow the structure is not dict or list
        if not isinstance(self.memory[category], (dict, list)):
            self.memory[category] = {}
    
        if isinstance(self.memory[category], dict):
            self.memory[category][key] = value
        elif isinstance(self.memory[category], list):
            self.memory[category].append({key: value})
        self._save()


    def get(self, category, key=None):
        if category not in self.memory:
            return None
        if key and isinstance(self.memory[category], dict):
            return self.memory[category].get(key)
        return self.memory[category]

    def set(self, category, key, value):
        if category not in self.memory:
            self.memory[category] = {}
        if isinstance(self.memory[category], dict):
            self.memory[category][key] = value
        elif isinstance(self.memory[category], list):
            self.memory[category].append({key: value})
        self._save()

    def delete(self, category, key=None):
        if category not in self.memory:
            return
        if key and isinstance(self.memory[category], dict):
            self.memory[category].pop(key, None)
        elif not key:
            self.memory[category] = {} if isinstance(self.memory[category], dict) else []
        self._save()

    def clear_all(self):
        """Clear all memory and reinitialize with default structure."""
        self.memory = self._initialize_structure()
        self._save()

    def _save(self):
        if callable(self.save_callback):
            self.save_callback(self.memory)

    def _initialize_structure(self):
        return {
            "personal_info": {},
            "reminders": {},
            "preferences": {},
            "knowledge_bank": {},
            "notes": [],
            "events": {},
            "relationships": {},
            "ai_interactions": []
        }

    def _validate_memory_structure(self, memory):
        required_keys = {
            "personal_info", "reminders", "preferences", "knowledge_bank",
            "notes", "events", "relationships", "ai_interactions"
        }
        return required_keys.issubset(set(memory.keys()))
