' Create AutoSpend Backend Startup Shortcut
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get startup folder path
startupFolder = objShell.SpecialFolders("Startup")

' Create shortcut
Set objLink = objShell.CreateShortcut(startupFolder & "\AutoSpend Backend.lnk")
objLink.TargetPath = "c:\code\AUTOSPEND AI\start-backend-hidden.vbs"
objLink.WorkingDirectory = "c:\code\AUTOSPEND AI"
objLink.Description = "AutoSpend AI Backend - runs on Windows startup"
objLink.Save()

MsgBox "Backend startup shortcut created successfully!" & vbCrLf & vbCrLf & _
        "Location: " & startupFolder & "\AutoSpend Backend.lnk" & vbCrLf & vbCrLf & _
        "The backend will now start automatically when Windows boots.", , "AutoSpend Setup Complete"
