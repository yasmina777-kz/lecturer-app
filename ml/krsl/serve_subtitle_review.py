"""Loopback-only review server with byte ranges for exact video seeking."""
import argparse
import functools
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def parse_range(value, size):
    match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
    if not match or not size or not any(match.groups()):
        raise ValueError('Unsupported byte range')
    first, last = match.groups()
    if not first:
        if int(last) <= 0:
            raise ValueError('Empty suffix')
        start, end = max(0, size-int(last)), size-1
    else:
        start, end = int(first), min(int(last), size-1) if last else size-1
    if not 0 <= start <= end < size:
        raise ValueError('Unsatisfiable byte range')
    return start, end


class ReviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining = None
        path = Path(self.translate_path(self.path))
        value = self.headers.get('Range')
        if not value or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        try:
            start, end = parse_range(value, size)
        except ValueError:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        stream = path.open('rb'); stream.seek(start)
        self.remaining = end-start+1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self.remaining))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        try:
            if self.remaining is None:
                return super().copyfile(source, outputfile)
            while self.remaining:
                chunk = source.read(min(self.remaining, 64*1024))
                if not chunk:
                    break
                outputfile.write(chunk)
                self.remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Browser canceled a previous seek request.


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent/'data/sources/youtube-sl-25/expansion')
    parser.add_argument('--port', type=int, default=8782)
    args = parser.parse_args()
    handler = functools.partial(ReviewHandler, directory=str(args.directory.resolve()))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'http://127.0.0.1:{args.port}/quality/index.html', flush=True)
        server.serve_forever()
