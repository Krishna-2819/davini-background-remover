# Create Desktop Shortcut for Background Remover Pro

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$AppPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ShortcutPath = Join-Path $DesktopPath "Background Remover Pro.lnk"
$RunScript = Join-Path $AppPath "run.bat"

# Create WScript.Shell COM object
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# Set shortcut properties
$Shortcut.TargetPath = $RunScript
$Shortcut.WorkingDirectory = $AppPath
$Shortcut.WindowStyle = 1  # Normal window
$Shortcut.Description = "Background Remover Pro - Remove backgrounds and enhance product images with Gemini AI"
$Shortcut.IconLocation = "C:\Windows\System32\cmd.exe,0"

# Save the shortcut
$Shortcut.Save()

Write-Host "✅ Desktop shortcut created successfully!"
Write-Host "📍 Location: $ShortcutPath"
Write-Host "🎨 You can now double-click the shortcut to launch Background Remover Pro"
Write-Host ""
Write-Host "The app will:"
Write-Host "  1. Install dependencies (first time only, may take a few minutes)"
Write-Host "  2. Build the frontend"
Write-Host "  3. Start the server"
Write-Host "  4. Open at http://localhost:8080"
