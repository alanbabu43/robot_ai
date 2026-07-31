import os
import sys
import subprocess

def main():
    print("Starting Sarvam AI Voice Chatbot...")
    
    # Path to virtual env python
    venv_python = os.path.join("env", "Scripts", "python.exe") if os.name == "nt" else os.path.join("env", "bin", "python")
    
    if not os.path.exists(venv_python):
        print(f"Virtual environment python not found at '{venv_python}'")
        print("Starting with system default python instead...")
        venv_python = "python"

    # Command to run uvicorn
    cmd = [
        venv_python, 
        "-m", 
        "uvicorn", 
        "main:app", 
        "--host", 
        "0.0.0.0", 
        "--port", 
        "8000", 
        "--reload"
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nServer stopped successfully.")
    except Exception as e:
        print(f"Failed to run server: {e}")

if __name__ == "__main__":
    main()
