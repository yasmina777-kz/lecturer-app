"""KRSL inference API. No cloud calls; temporary uploads deleted after inference."""
import asyncio
import hmac
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from runtime import Engine, MAX_BYTES

engine = None
load_error = None
busy = asyncio.Lock()


@asynccontextmanager
async def lifespan(app):
    global engine, load_error
    engine, load_error = None, None
    network_facing = os.getenv('KRSL_HOST', '127.0.0.1') not in {'127.0.0.1', 'localhost', '::1'}
    token = os.getenv('KRSL_SERVICE_TOKEN', '')
    if network_facing and len(token.encode('utf-8')) < 32:
        raise RuntimeError('KRSL_SERVICE_TOKEN must contain at least 32 bytes when KRSL listens on a network interface.')
    try:
        engine = await run_in_threadpool(Engine)
    except Exception:
        load_error = 'Не удалось загрузить модель. Запустите ml/krsl/setup.py и перезапустите сервис.'
        logging.exception('KRSL startup failed')
    try:
        yield
    finally:
        if engine:
            engine.close()
        engine = None


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.get('/healthz')
def healthz():
    if engine is None:
        raise HTTPException(503, load_error or 'Модель ещё загружается.')
    return {'status': 'ready'}


def authorize_service(request: Request):
    expected = os.getenv('KRSL_SERVICE_TOKEN', '')
    # Local development binds to loopback and does not need a shared secret.
    # Any network-facing deployment must configure the server-only token.
    if expected:
        supplied = request.headers.get('authorization', '')
        if not hmac.compare_digest(supplied, f'Bearer {expected}'):
            raise HTTPException(401, 'Требуется авторизация сервиса.')
    elif os.getenv('KRSL_HOST', '127.0.0.1') not in {'127.0.0.1', 'localhost', '::1'}:
        raise HTTPException(503, 'Не настроен секрет для доступа к сервису.')


@app.get('/api/krsl/status')
def status(request: Request):
    authorize_service(request)
    return {'ready': engine is not None, 'error': load_error,
            'model': 'dastan-issenov/krsl-cslr-checkpoints',
            'vocabulary': len(engine.vocab) - 2 if engine else 0,
            'epoch': engine.epoch if engine else None,
            'upstreamMetrics': engine.metrics if engine else {},
            'local': os.getenv('KRSL_HOST', '127.0.0.1') in {'127.0.0.1', 'localhost', '::1'},
            'experimental': True}


@app.post('/api/krsl/recognize')
async def recognize(request: Request):
    authorize_service(request)
    # No CORS. The client marker is an additional origin check; cloud security
    # comes from the server-to-server bearer token, never this public header.
    if request.headers.get('x-krsl-client') != 'platform':
        raise HTTPException(403, 'Неверный клиент распознавания.')
    if not engine:
        raise HTTPException(503, load_error or 'Модель ещё загружается.')
    if busy.locked():
        raise HTTPException(429, 'Предыдущее видео ещё обрабатывается. Подождите.')
    mime = request.headers.get('content-type', '').split(';')[0]
    if mime not in {'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'}:
        raise HTTPException(415, 'Поддерживается видео MP4, WebM, MOV или OGG.')
    suffix = '.webm' if mime == 'video/webm' else '.mp4'
    async with busy:
        with tempfile.TemporaryDirectory(prefix='krsl-') as directory:
            path = Path(directory) / ('clip' + suffix)
            size = 0
            with path.open('wb') as file:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, 'Максимальный размер видео — 25 МБ.')
                    file.write(chunk)
            if not size:
                raise HTTPException(400, 'Видео пустое.')
            try:
                return await run_in_threadpool(engine.recognize, path)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
            except Exception:
                logging.exception('KRSL inference failed')
                return JSONResponse({'detail': 'Не удалось обработать видео. Попробуйте другой фрагмент.'}, 500)


if __name__ == '__main__':
    import uvicorn
    host = os.getenv('KRSL_HOST', '127.0.0.1')
    port = int(os.getenv('PORT', os.getenv('KRSL_PORT', '5070')))
    uvicorn.run(app, host=host, port=port, limit_concurrency=8)
