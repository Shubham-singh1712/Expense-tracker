' AutoSpend AI Backend Launcher
' Runs backend silently without visible terminal window

Set objShell = CreateObject("WScript.Shell")
strBatchPath = objShell.CurrentDirectory & "\backend\server.py"

' Run Python backend with no visible window (0 = hidden, False = don't wait)
objShell.Run "python """ & strBatchPath & """", 0, False
