@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================
echo   入梦李白 - 启动中...
echo ==============================

:: 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

:: 启动开发服务器并自动打开浏览器
echo 启动开发服务器，浏览器将自动打开...
echo 关闭此窗口可停止服务器
echo ==============================
start "" "http://localhost:5173"
call npm run dev
