"""Read server configuration as data; never source or evaluate a .env file."""
import json
import re
from pathlib import Path

SERVER_KEYS = {
    'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'OPENAI_API_KEY', 'AI__ApiKey',
    'AI__Model', 'AI__BaseUrl', 'AI__TranscriptionModel', 'Database__Provider',
    'ConnectionStrings__Default', 'Jwt__Key', 'DataDirectory',
    'AI__InputUsdPerMillion', 'AI__CachedUsdPerMillion', 'AI__OutputUsdPerMillion',
}


def read_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    values = {}
    for number, raw in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        match = re.fullmatch(r'([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            raise ValueError(f'.env: invalid assignment on line {number}; use KEY=value.')
        key, value = match.groups()
        if value.startswith(('"', "'")):
            quote = value[0]
            end = value.find(quote, 1)
            if end < 0 or (value[end + 1:].strip() and not value[end + 1:].lstrip().startswith('#')):
                raise ValueError(f'.env: invalid quoted value on line {number}.')
            value = value[1:end]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
        values[key] = value
    return values


def load_environment(root: Path, inherited: dict[str, str]) -> dict[str, str]:
    env = inherited.copy()
    config_path = root / 'local.config.json'
    try:
        config = json.loads(config_path.read_text()) if config_path.exists() else {}
    except (ValueError, OSError) as exc:
        raise ValueError('Could not read local.config.json; check the JSON format and permissions.') from exc
    if not isinstance(config, dict):
        raise ValueError('local.config.json must contain a JSON object.')
    # Explicit environment settings win, followed by the existing configuration wizard.
    # Blank template fields do not disable configured services or override app defaults.
    for source in (config, read_dotenv(root / '.env')):
        for key, value in source.items():
            if key in SERVER_KEYS and value is not None and str(value).strip():
                env.setdefault(key, str(value))
    return env
