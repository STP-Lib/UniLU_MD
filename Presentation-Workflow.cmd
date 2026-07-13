@echo off
setlocal
pushd "%~dp0" || exit /b 1
node "scripts\workflow.mjs" %*
set "workflow_exit=%ERRORLEVEL%"
popd
exit /b %workflow_exit%
