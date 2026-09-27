"""Deterministic local API fixture, used only by automated tests."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, time
class Handler(BaseHTTPRequestHandler):
    failed_once = set()
    def log_message(self, *args): pass
    def do_POST(self):
        if self.headers.get('Transfer-Encoding', '').lower() == 'chunked':
            parts = []
            while True:
                size = int(self.rfile.readline().split(b';')[0], 16)
                if size == 0:
                    self.rfile.readline()
                    break
                parts.append(self.rfile.read(size)); self.rfile.read(2)
            body = b''.join(parts)
        else:
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path.endswith('/audio/transcriptions'):
            response = {'text': 'Объясни ещё раз основной принцип', 'duration': 4.5}
        else:
            data = json.loads(body)
            if 'response_format' in data:
                incoming = json.loads(data['messages'][1]['content'])
                topic = incoming.get('topic', '')
                if 'RETRY_ONCE' in topic and 'Модуль 2' in topic and topic not in self.failed_once:
                    self.failed_once.add(topic)
                    self.send_response(429); self.end_headers(); return
                if incoming.get('reviewMode') == 'source_alignment':
                    content = json.dumps({'checks': [dict(slideIndex=i, status='supported', reason='Подтверждается учебным материалом.') for i in range(len(incoming['slides']))]},ensure_ascii=False)
                elif 'moduleCount' in incoming:
                    content = json.dumps({'title': 'Курс: ' + incoming['goal'][:80], 'modules': [{'title': f'Модуль {i+1}', 'objective': 'Понять принцип и применить его на примере'} for i in range(incoming['moduleCount'])]}, ensure_ascii=False)
                elif 'selectedAnswer' in incoming:
                    content = json.dumps(dict(explanation='Рассмотрим ошибку на примере.', slideIndex=0, question='Как закрепить новое знание?', options=['Применить', 'Пропустить', 'Забыть', 'Угадать'], correctIndex=0, answerExplanation='Практическое применение помогает закрепить знание.'), ensure_ascii=False)
                elif incoming['topic'] == 'INVALID_RESPONSE':
                    content = '{"title":"broken"}'
                elif 'selectedSlides' in incoming:
                    words = incoming['wordsPerSlide']
                    content = json.dumps({'slides': [dict(title=slide['title'], bullets=slide['bullets'], narration=' '.join(['Объяснение'] * words), evidence=incoming.get('material','')[:100], visual=dict(kind='process', title='От идеи к практике', items=[dict(label='Идея', detail='Разберите основной принцип.', icon='brain'),dict(label='Применение',detail='Проверьте принцип на примере.',icon='target')],caption='Учебная схема')) for slide in incoming['selectedSlides']]}, ensure_ascii=False)
                else:
                    content = json.dumps({'title': incoming['topic'] or 'Лекция по материалу', 'description': 'Лекция создана тестовым провайдером.', 'subject': 'Тестовая тема', 'introduction': 'Здравствуйте. Рассмотрим тему и перейдём к примеру.', 'summary': 'Первый принцип.\n\nПрименение и проверка результата.', 'slides': [{'title': f'Идея {i+1}', 'bullets': ['Первый принцип', 'Пример применения', 'Проверка результата'], 'narration': f'Предложение один на слайде {i+1}. Предложение два помогает разобраться. Предложение три завершает мысль.'} for i in range(incoming['slideCount'])], 'exercises': [{'question': 'Что помогает проверить понимание?', 'options': ['Угадать', 'Проверить себя', 'Пропустить', 'Забыть'], 'correctIndex': 1, 'explanation': 'Самопроверка помогает найти пробелы.'}], 'tasks': [{'question': 'Приведите пример', 'answer': 'Сформулируйте идею и проверьте её.'}]}, ensure_ascii=False)
                    if incoming.get('language') in ('en', 'kk'):
                        lang = incoming['language']
                        assert ('Kazakh' if lang == 'kk' else 'English') in data['messages'][0]['content']
                        label = 'Білімді тексеру' if lang == 'kk' else 'Check understanding'
                        lesson = json.loads(content)
                        lesson.update(description=label, introduction=label + '.', summary=label, subject=label)
                        for slide in lesson['slides']:
                            slide.update(title=label, bullets=[label, label], narration=label + '.')
                        lesson['exercises'] = [dict(question=label, options=[label + str(i) for i in range(4)], correctIndex=1, explanation=label)]
                        lesson['tasks'] = [dict(question=label, answer=label)]
                        content = json.dumps(lesson, ensure_ascii=False)
            else:
                content = 'Давайте разберём на примере. Примените принцип к знакомой задаче, а затем проверьте результат.'
            if 'response_format' not in data:
                system = data['messages'][0]['content']
                if 'Kazakh' in system: content = 'Мысал арқылы түсіндірейік.'
                elif 'English' in system: content = 'Let us explain with an example.'
            response = {'model':'gpt-4o-mini-2024-07-18', 'usage': {'prompt_tokens':1000, 'completion_tokens':500, 'prompt_tokens_details':{'cached_tokens':200}}, 'choices': [{'finish_reason':'stop','message': {'content': content}}]}
            if 'MISSING_USAGE' in data['messages'][1]['content']: response.pop('usage')
            if 'PROVIDER_FAILURE' in data['messages'][1]['content']:
                self.send_response(429); self.end_headers(); return
        raw = json.dumps(response, ensure_ascii=False).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
if __name__ == '__main__': ThreadingHTTPServer(('127.0.0.1', int(os.getenv('TEST_PROVIDER_PORT','5099'))), Handler).serve_forever()
