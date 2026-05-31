@rem Copyright (c) 2023 Gradle
@rem ...
@echo off
set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
"%DIRNAME%\gradle\wrapper\gradle-wrapper.jar" %*
