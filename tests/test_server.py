"""Start an isolated test database and fixture provider; never touches user data."""
import os, signal, subprocess, sys, tempfile, time
from pathlib import Path
root = Path(__file__).resolve().parent.parent
api = root / 'backend/src/Lecturer.Api'
processes = []
with tempfile.TemporaryDirectory(prefix='lecturer-test-') as data:
    env = os.environ.copy()
    env.update({'DataDirectory': data, 'ASPNETCORE_URLS': f"http://localhost:{os.getenv('TEST_API_PORT', '5050')}", 'ASPNETCORE_ENVIRONMENT': 'Testing', 'AI__ApiKey': 'local-test-fixture', 'AI__BaseUrl': f"http://127.0.0.1:{os.getenv('TEST_PROVIDER_PORT', '5099')}/v1/", 'Database__Provider': os.getenv('TEST_DATABASE_PROVIDER','Sqlite'), 'Cors__AllowedOrigins__0': f"http://localhost:{os.getenv('TEST_WEB_PORT', '5173')}", 'AI__InputUsdPerMillion': '0.15', 'AI__CachedUsdPerMillion': '0.075', 'AI__OutputUsdPerMillion': '0.60'})
    if env['Database__Provider'] == 'Postgres': env['ConnectionStrings__Default'] = os.environ['TEST_CONNECTION']
    if os.getenv('TEST_WITHOUT_AI') == '1': env['AI__ApiKey'] = ''
    subprocess.run(['dotnet', str(api / 'bin/Debug/net8.0/Lecturer.Api.dll'), '--create-admin'], input='admin@test.local\nTest Admin\nTest-Only-Password-123\n', text=True, env=env, cwd=api, check=True, stdout=subprocess.DEVNULL)
    processes.append(subprocess.Popen([sys.executable, str(root / 'tests/provider_fixture.py')], env=env))
    processes.append(subprocess.Popen(['dotnet', str(api / 'bin/Debug/net8.0/Lecturer.Api.dll')], cwd=api, env=env))
    def stop(*_):
        for p in processes:
            if p.poll() is None: p.terminate()
        for p in processes:
            try: p.wait(timeout=5)
            except subprocess.TimeoutExpired: p.kill()
        sys.exit(0)
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    try:
        while all(p.poll() is None for p in processes): time.sleep(1)
    finally: stop()
