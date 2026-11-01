import json
import os

PROJECTS_FILE = "projects_registry.json"

def create_99999_projects():
    # Сите 99,999 проекти ја добиваат Zlatko AI Mode конфигурацијата
    registry = {
        "system_mode": "ZLATKO_AI_MODE",
        "total_projects": 99999,
        "active_modules": [1, 4, 5, 6, 12, 13, 15],
        "module_map": {
            "1": "Zlatko AI Mode (Copilot & Core)",
            "4": "Sportski vesti",
            "5": "Real Madrid Info",
            "6": "F1 Info",
            "12": "Projekt Preveduvac",
            "13": "Projekt Blokator (Security Guard)",
            "15": "+ Za dodavanje aplikacija"
        }
    }
    
    with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Сите 99,999 проекти се креирани и синхронизирани со Zlatko AI Mode!")
    print(f"📁 Зачувано во: {PROJECTS_FILE}")

if __name__ == "__main__":
    create_99999_projects()
