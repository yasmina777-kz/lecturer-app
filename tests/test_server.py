"""Start an isolated test database and fixture provider; never touches user data."""
import os, signal, subprocess, sys, tempfile, time
from pathlib import Path
root = Path(__file__).resolve().parent.parent
api = root / 'backend/src/Lecturer.Api'
processes = []
with tempfile.TemporaryDirectory(prefix='lecturer-test-') as data:
    env = os.environ.copy()
    env.update({'DataDirectory': data, 'ASPNETCORE_URLS': 'http://localhost:5050', 'ASPNETCORE_ENVIRONMENT': 'Testing', 'AI__ApiKey': 'local-test-fixture', 'AI__BaseUrl': 'http://127.0.0.1:5099/v1/', 'Database__Provider': 'Sqlite', 'AI__InputUsdPerMillion': '0.15', 'AI__CachedUsdPerMillion': '0.075', 'AI__OutputUsdPerMillion': '0.60'})
    subprocess.run(['dotnet', 'run', '--no-build', '--', '--create-admin'], input='admin@test.local\nTest Admin\nTest-Only-Password-123\n', text=True, env=env, cwd=api, check=True, stdout=subprocess.DEVNULL)
    processes.append(subprocess.Popen([sys.executable, str(root / 'tests/provider_fixture.py')]))
    processes.append(subprocess.Popen(['dotnet', 'run', '--no-build'], cwd=api, env=env))
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
