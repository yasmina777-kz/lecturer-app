import type { DictionaryEntry } from "./dictionary";
import { at } from "../i18n/automation";
export type LearningAttempt = {
  id: string;
  item: string;
  mode: "dialogue" | "understanding";
  correct: boolean;
  assisted: boolean;
  at: string;
};
export type DialogueChoice = {
  id: string;
  text: string;
  feedback: string;
  next?: string;
  accepted: boolean;
  example?: string;
};
export type DialogueStep = {
  id: string;
  prompt: string;
  context: string;
  signs: string[];
  avatar: string;
  choices: DialogueChoice[];
};
export type DialogueScenario = {
  id: string;
  title: string;
  description: string;
  image: string;
  start: string;
  steps: DialogueStep[];
};
export function dialogueScenarios(): DialogueScenario[] {
  return [
    {
      id: "meeting",
      title: at("Знакомство", "Meeting someone", "Танысу"),
      description: at(
        "Представьтесь, предложите учиться вместе и попросите повторить.",
        "Introduce yourself, learn together and ask for clarification.",
        "Танысып, бірге оқуды және қайталауды сұраңыз.",
      ),
      image: "семья",
      start: "name",
      steps: [
        {
          id: "name",
          prompt: at("Как тебя зовут?", "What is your name?", "Атың кім?"),
          context: at(
            "Вы впервые встретились. Выберите ответ, который поможет познакомиться.",
            "You are meeting for the first time. Choose a useful reply.",
            "Алғаш рет кездестіңіз. Танысуға көмектесетін жауапты таңдаңыз.",
          ),
          signs: ["имя", "я", "ты"],
          avatar: "Как тебя зовут?",
          choices: [
            {
              id: "introduce",
              text: at(
                "Представлюсь и покажу своё имя по буквам",
                "Introduce myself and fingerspell my name",
                "Танысып, атымды әріптермен көрсетемін",
              ),
              accepted: true,
              next: "learn",
              feedback: at(
                "Вы ответили на вопрос об имени. Незнакомое имя можно потренировать отдельно в разделе «Текст → жесты».",
                "You answered the question about your name. Practise spelling it in Text → signs.",
                "Есім туралы сұраққа жауап бердіңіз. Оны «Мәтін → ымдар» бөлімінде жаттықтырыңыз.",
              ),
            },
            {
              id: "shop",
              text: at(
                "Расскажу, что хочу купить хлеб",
                "Say I want to buy bread",
                "Нан сатып алғым келетінін айтамын",
              ),
              accepted: false,
              feedback: at(
                "Сейчас собеседник спрашивает ваше имя. Покупку обсудим в другой ситуации.",
                "The question is about your name, not a purchase.",
                "Қазір есіміңізді сұрап тұр.",
              ),
            },
            {
              id: "tomorrow",
              text: at("Скажу: «Завтра»", "Say “Tomorrow”", "«Ертең» деймін"),
              accepted: false,
              feedback: at(
                "«Завтра» отвечает на вопрос о времени. Здесь нужно представиться.",
                "“Tomorrow” answers a time question. Introduce yourself here.",
                "«Ертең» уақыт туралы жауап. Бұл жерде танысу керек.",
              ),
            },
          ],
        },
        {
          id: "learn",
          prompt: at(
            "Хочешь вместе изучать жестовый язык?",
            "Would you like to learn sign language together?",
            "Ым тілін бірге үйренгің келе ме?",
          ),
          context: at(
            "Вы уже познакомились. Ответьте на предложение.",
            "You have introduced yourselves. Respond to the invitation.",
            "Таныстыңыздар. Ұсынысқа жауап беріңіз.",
          ),
          signs: ["изучить", "язык", "хотеть"],
          avatar: "Я хочу изучить язык",
          choices: [
            {
              id: "yes",
              text: at(
                "Да, хочу учиться вместе",
                "Yes, I would like to learn together",
                "Иә, бірге үйренгім келеді",
              ),
              accepted: true,
              next: "clarify",
              example: "Я хочу изучить язык",
              feedback: at(
                "Вы приняли предложение. Теперь можно договориться, как просить о помощи.",
                "You accepted. Next, practise asking for clarification.",
                "Ұсынысты қабылдадыңыз. Енді нақтылауды сұрап көріңіз.",
              ),
            },
            {
              id: "later",
              text: at(
                "Сейчас не могу, давай завтра",
                "I cannot now; let’s try tomorrow",
                "Қазір болмайды, ертең үйренейік",
              ),
              accepted: true,
              next: "clarify",
              example: "Завтра мы изучим язык",
              feedback: at(
                "Предложить другое время — тоже подходящий ответ.",
                "Suggesting another time is also a relevant answer.",
                "Басқа уақыт ұсыну да орынды жауап.",
              ),
            },
            {
              id: "color",
              text: at("Это красный цвет", "It is red", "Бұл қызыл түс"),
              accepted: false,
              feedback: at(
                "Ответ про цвет не связан с предложением учиться. Согласитесь или предложите другое время.",
                "A colour does not answer the invitation. Accept or suggest another time.",
                "Түс туралы жауап ұсынысқа сәйкес келмейді.",
              ),
            },
          ],
        },
        {
          id: "clarify",
          prompt: at(
            "Ты не понял показ. Как продолжить общение?",
            "You did not understand the sign. What next?",
            "Ымды түсінбедіңіз. Қалай жалғастырасыз?",
          ),
          context: at(
            "Учиться — это ещё и уметь уточнять. Выберите действие.",
            "Learning includes asking for clarification. Choose an action.",
            "Үйрену кезінде нақтылау да маңызды. Әрекетті таңдаңыз.",
          ),
          signs: ["понять", "показать", "вопрос"],
          avatar: "Я не понял",
          choices: [
            {
              id: "repeat",
              text: at(
                "Попрошу показать ещё раз",
                "Ask to see it again",
                "Қайта көрсетуді сұраймын",
              ),
              accepted: true,
              example: "Покажи мне",
              feedback: at(
                "Хорошая стратегия: попросить повторить и сравнить движение с образцом.",
                "Ask for a repeat and compare with the reference.",
                "Қайталауды сұрап, үлгімен салыстыруға болады.",
              ),
            },
            {
              id: "pretend",
              text: at(
                "Сделаю вид, что всё понял",
                "Pretend I understood",
                "Түсінгендей боламын",
              ),
              accepted: false,
              feedback: at(
                "Так непонятный момент останется. В этом упражнении попробуйте попросить уточнение.",
                "That leaves the misunderstanding unresolved. Try asking for clarification.",
                "Түсінбеген жер қалады. Нақтылауды сұраңыз.",
              ),
            },
            {
              id: "help",
              text: at("Попрошу помочь", "Ask for help", "Көмек сұраймын"),
              accepted: true,
              example: "Помоги мне",
              feedback: at(
                "Просьба о помощи помогает продолжить разговор.",
                "Asking for help keeps the conversation going.",
                "Көмек сұрау әңгімені жалғастыруға көмектеседі.",
              ),
            },
          ],
        },
      ],
    },
    {
      id: "study",
      title: at("На занятии", "In class", "Сабақта"),
      description: at(
        "Выберите материал, задайте вопрос и договоритесь о повторении.",
        "Choose materials, ask a question and arrange revision.",
        "Материал таңдап, сұрақ қойып, қайталауды келісіңіз.",
      ),
      image: "книга",
      start: "material",
      steps: [
        {
          id: "material",
          prompt: at(
            "Что нужно, чтобы читать на занятии?",
            "What do you need for reading?",
            "Оқу үшін не керек?",
          ),
          context: at(
            "Собеседник предлагает начать чтение. Выберите нужный предмет.",
            "Your partner suggests reading. Choose the material.",
            "Әңгімелесуші оқуды ұсынады. Қажет затты таңдаңыз.",
          ),
          signs: ["читать", "книга", "карандаш"],
          avatar: "Я хочу читать книгу",
          choices: [
            {
              id: "book",
              text: at("Возьму книгу", "Take a book", "Кітап аламын"),
              accepted: true,
              next: "question",
              example: "Открой книгу",
              feedback: at(
                "Книга подходит для чтения. Посмотрите отдельно жесты «книга» и «читать».",
                "A book is appropriate. Review the signs for book and read.",
                "Кітап оқуға керек. «Книга» және «читать» ымдарын қараңыз.",
              ),
            },
            {
              id: "water",
              text: at(
                "Покажу жест «вода»",
                "Sign “water”",
                "«Вода» ымын көрсетемін",
              ),
              accepted: false,
              feedback: at(
                "Вода не отвечает на вопрос об учебном материале.",
                "Water does not answer the question about reading material.",
                "Су оқу материалы туралы сұраққа жауап бермейді.",
              ),
            },
            {
              id: "sleep",
              text: at(
                "Предложу поспать",
                "Suggest sleeping",
                "Ұйықтауды ұсынамын",
              ),
              accepted: false,
              feedback: at(
                "Цель ситуации — начать чтение. Найдите подходящий предмет.",
                "The goal is to start reading. Choose a suitable item.",
                "Мақсат — оқуды бастау. Қажет затты таңдаңыз.",
              ),
            },
          ],
        },
        {
          id: "question",
          prompt: at(
            "В материале есть трудный момент. Что сделаешь?",
            "A part is difficult. What will you do?",
            "Материалда қиын жер бар. Не істейсіз?",
          ),
          context: at(
            "Выберите ответ, который помогает разобраться.",
            "Choose a response that helps understanding.",
            "Түсінуге көмектесетін жауапты таңдаңыз.",
          ),
          signs: ["трудный", "вопрос", "спросить"],
          avatar: "Это трудный вопрос",
          choices: [
            {
              id: "ask",
              text: at("Задам вопрос", "Ask a question", "Сұрақ қоямын"),
              accepted: true,
              next: "review",
              example: "Я хочу спросить",
              feedback: at(
                "Уточняющий вопрос помогает продолжить занятие.",
                "A question helps you continue learning.",
                "Нақтылау сұрағы сабақты жалғастыруға көмектеседі.",
              ),
            },
            {
              id: "help",
              text: at(
                "Попрошу показать пример",
                "Ask for a demonstration",
                "Мысал көрсетуді сұраймын",
              ),
              accepted: true,
              next: "review",
              example: "Покажи мне",
              feedback: at(
                "Можно попросить ещё один показ и сравнить детали.",
                "Ask for another demonstration and compare the details.",
                "Қайта көрсетуді сұрап, бөлшектерін салыстыруға болады.",
              ),
            },
            {
              id: "color",
              text: at(
                "Назову цвет книги",
                "Name the book’s colour",
                "Кітаптың түсін атаймын",
              ),
              accepted: false,
              feedback: at(
                "Это не уточняет трудный момент. Попробуйте задать вопрос или попросить пример.",
                "That does not clarify the difficulty. Ask a question or for an example.",
                "Бұл қиын жерді нақтыламайды. Сұрақ не мысал сұраңыз.",
              ),
            },
          ],
        },
        {
          id: "review",
          prompt: at(
            "Договоримся повторить завтра?",
            "Shall we review tomorrow?",
            "Ертең қайталаймыз ба?",
          ),
          context: at(
            "Выберите ответ о времени следующей встречи.",
            "Reply about the next meeting time.",
            "Келесі кездесудің уақыты туралы жауап беріңіз.",
          ),
          signs: ["завтра", "сегодня", "вспомнить"],
          avatar: "Завтра мы читаем книгу",
          choices: [
            {
              id: "tomorrow",
              text: at("Да, завтра", "Yes, tomorrow", "Иә, ертең"),
              accepted: true,
              example: "Завтра мы читаем книгу",
              feedback: at(
                "Вы согласовали время. Отличайте «сегодня», «вчера» и «завтра» в заданиях на понимание.",
                "You agreed on a time. Practise today, yesterday and tomorrow in comprehension.",
                "Уақытты келістіңіз. «Сегодня», «вчера», «завтра» сөздерін түсіну жаттығуында қайталаңыз.",
              ),
            },
            {
              id: "today",
              text: at(
                "Предложу повторить сегодня",
                "Suggest reviewing today",
                "Бүгін қайталауды ұсынамын",
              ),
              accepted: true,
              example: "Сегодня мы читаем книгу",
              feedback: at(
                "Другой день можно предложить явно — это сохраняет смысл разговора.",
                "You can explicitly propose a different time.",
                "Басқа уақытты нақты ұсынуға болады.",
              ),
            },
            {
              id: "book",
              text: at(
                "Отвечу: «Книга»",
                "Reply “Book”",
                "«Книга» деп жауап беремін",
              ),
              accepted: false,
              feedback: at(
                "Сейчас вопрос о времени, а не о предмете.",
                "This question is about time, not an object.",
                "Бұл сұрақ зат емес, уақыт туралы.",
              ),
            },
          ],
        },
      ],
    },
    {
      id: "shop",
      title: at("В магазине", "At the shop", "Дүкенде"),
      description: at(
        "Выберите покупку, количество и ответ на предложение помощи.",
        "Choose an item, quantity and respond to an offer of help.",
        "Зат пен санын таңдап, көмек ұсынысына жауап беріңіз.",
      ),
      image: "магазин",
      start: "buy",
      steps: [
        {
          id: "buy",
          prompt: at(
            "Что хочешь купить?",
            "What would you like to buy?",
            "Не сатып алғыңыз келеді?",
          ),
          context: at(
            "У вас два подходящих варианта. Выбор изменит следующую реплику.",
            "Two choices work. Your choice changes the next prompt.",
            "Екі нұсқа да орынды. Таңдау келесі сұрақты өзгертеді.",
          ),
          signs: ["купить", "хлеб", "вода"],
          avatar: "Я хочу купить хлеб",
          choices: [
            {
              id: "bread",
              text: at(
                "Хочу купить хлеб",
                "I would like bread",
                "Нан сатып алғым келеді",
              ),
              accepted: true,
              next: "bread-count",
              example: "Я хочу купить хлеб",
              feedback: at(
                "Вы выбрали хлеб. Теперь уточним количество.",
                "You chose bread. Now choose the quantity.",
                "Нан таңдадыңыз. Енді санын нақтылаймыз.",
              ),
            },
            {
              id: "water",
              text: at(
                "Мне нужна вода",
                "I would like water",
                "Маған су керек",
              ),
              accepted: true,
              next: "water-count",
              example: "Дай мне воду",
              feedback: at(
                "Вы выбрали воду. Теперь уточним количество.",
                "You chose water. Now choose the quantity.",
                "Су таңдадыңыз. Енді санын нақтылаймыз.",
              ),
            },
            {
              id: "yesterday",
              text: at("Вчера", "Yesterday", "Кеше"),
              accepted: false,
              feedback: at(
                "Это ответ о времени. Выберите, что хотите купить.",
                "That is a time. Choose an item to buy.",
                "Бұл уақыт туралы. Сатып алатын затты таңдаңыз.",
              ),
            },
          ],
        },
        ...(["bread", "water"] as const).map((item) => ({
          id: `${item}-count`,
          prompt:
            item === "bread"
              ? at(
                  "Сколько хлеба возьмём?",
                  "How many loaves?",
                  "Қанша нан аламыз?",
                )
              : at(
                  "Сколько бутылок воды возьмём?",
                  "How many bottles of water?",
                  "Қанша бөтелке су аламыз?",
                ),
          context: at(
            "Выберите количество. Для чисел тоже есть отдельные жесты.",
            "Choose a quantity. Numbers also have their own signs.",
            "Санын таңдаңыз. Сандардың да жеке ымдары бар.",
          ),
          signs: ["сколько", "один", "два"],
          avatar: "два",
          choices: [
            {
              id: "one",
              text: at("Одну", "One", "Бір"),
              accepted: true,
              next: "help",
              example: "один",
              feedback: at(
                "Количество уточнено: одна.",
                "Quantity: one.",
                "Саны: бір.",
              ),
            },
            {
              id: "two",
              text: at("Две", "Two", "Екі"),
              accepted: true,
              next: "help",
              example: "два",
              feedback: at(
                "Количество уточнено: две.",
                "Quantity: two.",
                "Саны: екі.",
              ),
            },
            {
              id: "tomorrow",
              text: at("Завтра", "Tomorrow", "Ертең"),
              accepted: false,
              feedback: at(
                "«Завтра» обозначает время. Здесь нужен ответ о количестве.",
                "Tomorrow is a time; this question asks for quantity.",
                "«Ертең» — уақыт. Мұнда сан қажет.",
              ),
            },
          ],
        })),
        {
          id: "help",
          prompt: at(
            "Нужна помощь?",
            "Would you like help?",
            "Көмек керек пе?",
          ),
          context: at(
            "Вы можете принять помощь или отказаться. Оба ответа подходят.",
            "You may accept or decline. Both are relevant.",
            "Көмекті қабылдауға да, бас тартуға да болады.",
          ),
          signs: ["помочь", "да", "не"],
          avatar: "Я хочу помочь",
          choices: [
            {
              id: "yes",
              text: at("Да, помогите", "Yes, please help", "Иә, көмектесіңіз"),
              accepted: true,
              example: "Помоги мне",
              feedback: at(
                "Вы приняли помощь. Покупка завершена.",
                "You accepted help. The shopping dialogue is complete.",
                "Көмекті қабылдадыңыз. Сатып алу диалогы аяқталды.",
              ),
            },
            {
              id: "no",
              text: at(
                "Помощь не нужна",
                "I do not need help",
                "Көмек қажет емес",
              ),
              accepted: true,
              feedback: at(
                "Отказ тоже уместен. Покупка завершена.",
                "Declining is also appropriate. The dialogue is complete.",
                "Бас тарту да орынды. Диалог аяқталды.",
              ),
            },
            {
              id: "name",
              text: at("Скажу своё имя", "Say my name", "Атымды айтамын"),
              accepted: false,
              feedback: at(
                "Здесь предлагают помощь. Ответьте на это предложение.",
                "The question offers help. Respond to that offer.",
                "Мұнда көмек ұсынып тұр. Сол ұсынысқа жауап беріңіз.",
              ),
            },
          ],
        },
      ],
    },
  ] satisfies {
    id: string;
    title: string;
    description: string;
    image: string;
    start: string;
    steps: DialogueStep[];
  }[];
}
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function reviewItems(attempts: LearningAttempt[]) {
  const latest = new Map<string, LearningAttempt>();
  for (const attempt of attempts)
    if (attempt.mode === "understanding") latest.set(attempt.item, attempt);
  return new Set(
    [...latest.values()]
      .filter((a) => !a.correct || a.assisted)
      .map((a) => a.item),
  );
}
export function questionOptions(
  answer: DictionaryEntry,
  entries: DictionaryEntry[],
  random = Math.random,
) {
  const unique = [...new Map(entries.map((e) => [e.label, e])).values()].filter(
    (e) => e.id !== answer.id && e.label !== answer.label,
  );
  const same = shuffle(
    unique.filter((e) => e.category === answer.category),
    random,
  );
  const other = shuffle(
    unique.filter((e) => e.category !== answer.category),
    random,
  );
  return shuffle([answer, ...same.concat(other).slice(0, 3)], random);
}
