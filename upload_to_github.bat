@echo off
title NeuraSpend GitHub Uploader
echo ===================================================
echo   NEURASPEND GITHUB UPLOADER
echo ===================================================
echo.

:: Check if git is initialized
if not exist .git (
    echo [INFO] Git is not initialized in this folder yet.
    echo Let's initialize it and link it to your GitHub!
    echo.
    echo Step 1: Initializing Git...
    git init
    if %errorlevel% neq 0 (
        echo [ERROR] Git initialization failed. Please make sure Git is installed on your computer.
        goto end
    )
    echo.
    
    echo Step 2: Linking to your GitHub repository...
    echo Please paste your GitHub repository URL below.
    echo (Example: https://github.com/yourusername/yourproject.git)
    echo.
    set /p REPO_URL="Paste GitHub URL and press Enter: "
    echo.
    
    git remote add origin %REPO_URL%
    git branch -M main
    echo.
)

echo Step 3: Adding files to git...
git add .
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] "git add" failed. Make sure Git is installed and you are in the correct folder.
    goto end
)

echo.
echo Step 4: Committing changes...
git commit -m "Complete deep website audit and UI fixes"
if %errorlevel% neq 0 (
    echo.
    echo [INFO] No new changes to commit or commit already done.
)

echo.
echo Step 5: Pushing to GitHub repository...
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed. 
    echo If this is the first push, please make sure you copied the correct GitHub URL.
    echo If you see a login popup, please log in with your GitHub account.
    goto end
)

echo.
echo ===================================================
echo   SUCCESS! Your files are now uploaded to GitHub!
echo   Vercel will redeploy your website in 1-2 minutes.
echo ===================================================

:end
echo.
pause
