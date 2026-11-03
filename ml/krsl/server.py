"""Loopback-only sidecar. No cloud calls; temporary uploads deleted after inference."""
import asyncio
import logging
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
    try:
        engine = await run_in_threadpool(Engine)
    except Exception:
        load_error = 'Не удалось загрузить модель. Запустите ml/krsl/setup.py и перезапустите сервис.'
        logging.exception('KRSL startup failed')
    yield
    if engine:
        engine.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.get('/api/krsl/status')
def status():
    return {'ready': engine is not None, 'error': load_error,
            'model': 'dastan-issenov/krsl-cslr-checkpoints',
            'vocabulary': len(engine.vocab) - 2 if engine else 0,
            'epoch': engine.epoch if engine else None,
            'upstreamMetrics': engine.metrics if engine else {},
            'local': True, 'experimental': True}


@app.post('/api/krsl/recognize')
async def recognize(request: Request):
    # No CORS. The custom header prevents third-party sites from posting camera data.
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
    uvicorn.run(app, host='127.0.0.1', port=5070, limit_concurrency=8)
