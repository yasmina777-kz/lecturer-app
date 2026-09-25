#!/usr/bin/env python3
"""Local development launcher. Secrets are loaded without shell evaluation."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
from settings import load_environment

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / 'local.config.json'
try:
    ENV = load_environment(ROOT, dict(os.environ))
except (ValueError, OSError) as error:
    sys.exit(str(error))
DOTNET = shutil.which('dotnet') or str(Path.home() / '.dotnet/dotnet')
NPM = shutil.which('npm')
if not NPM:
    versions = sorted((Path.home() / '.nvm/versions/node').glob('*/bin/npm'))
    if versions:
        NPM = str(versions[-1]); ENV['PATH'] = str(versions[-1].parent) + os.pathsep + ENV['PATH']
API = ROOT / 'backend/src/Lecturer.Api'

def run(args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, env=ENV, check=True)

if '--configure-ai' in sys.argv:
    import getpass
    key = getpass.getpass('API-ключ OpenAI (ввод скрыт): ').strip()
    if not key:
        print('Ключ не изменён.'); sys.exit(0)
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    config['OPENAI_API_KEY'] = key
    config['AI__Model'] = input('Модель [gpt-4o-mini]: ').strip() or 'gpt-4o-mini'
    fd = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(CONFIG, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(config, f, indent=2)
    print('Ключ сохранён в local.config.json. Перезапустите приложение.'); sys.exit(0)

if '--configure-speech' in sys.argv:
    import getpass, re
    key = getpass.getpass('Ключ Azure Speech (ввод скрыт): ').strip()
    if not key:
        print('Ключ не изменён.'); sys.exit(0)
    region = input('Регион ресурса Azure Speech (например, westeurope): ').strip().lower()
    if not re.fullmatch(r'[a-z0-9-]+', region):
        sys.exit('Некорректный регион. Используйте идентификатор региона из настроек ресурса Azure.')
    config = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    config.update({'AZURE_SPEECH_KEY': key, 'AZURE_SPEECH_REGION': region})
    fd = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(CONFIG, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(config, f, indent=2)
    print('Настройки сохранены. Перезапустите приложение.'); sys.exit(0)

if not Path(DOTNET).exists():
    sys.exit('Установите .NET SDK 8 и повторите запуск.')
run([DOTNET, 'build', str(API), '--nologo', '-v', 'quiet'])
if '--create-admin' in sys.argv or '--reset-password' in sys.argv:
    run([DOTNET, 'run', '--no-build', '--', '--reset-password' if '--reset-password' in sys.argv else '--create-admin'], API)
    sys.exit(0)
if not NPM:
    sys.exit('Установите Node.js 20 или новее.')
if not (ROOT / 'frontend/node_modules').exists():
    run([NPM, 'ci'], ROOT / 'frontend')
ENV.setdefault('ASPNETCORE_ENVIRONMENT', 'Development')
ENV['ASPNETCORE_URLS'] = 'http://localhost:5050'
processes = []

def stop(*_):
    for proc in processes:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
    for proc in processes:
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
    sys.exit(0)

signal.signal(signal.SIGINT, stop)
signal.signal(signal.SIGTERM, stop)
try:
    processes.append(subprocess.Popen([DOTNET, 'run', '--no-build'], cwd=API, env=ENV, start_new_session=True))
    processes.append(subprocess.Popen([NPM, 'run', 'dev'], cwd=ROOT / 'frontend', env=ENV, start_new_session=True))
    print('\nОткройте http://localhost:5173\nОстановка: Ctrl+C\n', flush=True)
    import time
    while all(proc.poll() is None for proc in processes):
        time.sleep(1)
    print('Один из процессов завершился. Проверьте сообщения выше.')
finally:
    stop()
