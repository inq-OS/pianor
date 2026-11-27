@echo off
rem Starts Pianor (Estonian). Double-click this file. Keep the window that opens; close it to stop the game.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pianor.ps1"
rem a start that failed leaves its message on screen until a key is pressed
if errorlevel 1 pause
