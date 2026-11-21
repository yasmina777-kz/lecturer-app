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
    {
      id: "cafe",
      title: at("В кафе", "At a café", "Кафеде"),
      description: at("Закажите напиток, узнайте цену и скажите, понравилось ли.", "Order a drink, ask the price and say whether you liked it.", "Сусын тапсырып, бағасын біліп, ұнағанын айтыңыз."),
      image: "кафе",
      start: "drink",
      steps: [
        { id: "drink", prompt: at("Что ты хочешь пить?", "What would you like to drink?", "Не ішкің келеді?"), context: at("Вы в кафе с глухим другом. Он спрашивает, что заказать.", "You are at a café with a Deaf friend. He asks what to order.", "Сіз керең досыңызбен кафедесіз."), signs: ["ты", "пить", "хотеть", "что"], avatar: "Ты хочешь пить", choices: [
            { id: "water", text: at("Хочу пить воду", "I want to drink water", "Су ішкім келеді"), accepted: true, next: "price", example: "Я хочу пить воду", feedback: at("Отличный ответ: вы назвали напиток.", "Good: you named a drink.", "Жақсы: сусынды атадыңыз.") },
            { id: "bread", text: at("Хочу есть хлеб", "I want to eat bread", "Нан жегім келеді"), accepted: false, feedback: at("Вопрос был про напиток. Хлеб можно заказать потом.", "The question was about a drink.", "Сұрақ сусын туралы болды.") },
            { id: "yesterday", text: at("Вчера", "Yesterday", "Кеше"), accepted: false, feedback: at("«Вчера» отвечает на вопрос «когда?», а не «что?».", "“Yesterday” answers “when?”, not “what?”.", "«Кеше» — «қашан?» сұрағына жауап.") },
          ] },
        { id: "price", prompt: at("Сколько стоит?", "How much is it?", "Қанша тұрады?"), context: at("Друг показывает на меню. Нужно узнать цену.", "Your friend points at the menu. Find out the price.", "Досыңыз мәзірді көрсетеді."), signs: ["цена", "сколько"], avatar: "Сколько стоит", choices: [
            { id: "ask", text: at("Спрошу цену и достану деньги", "Ask the price and get the money", "Бағасын сұрап, ақша аламын"), accepted: true, next: "taste", example: "Сколько стоит", feedback: at("Вы поняли вопрос о цене.", "You understood the price question.", "Баға туралы сұрақты түсіндіңіз.") },
            { id: "brother", text: at("Скажу «мой брат»", "Say “my brother”", "«Менің ағам» деймін"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
            { id: "repeat", text: at("Попрошу показать ещё раз", "Ask to show it again", "Қайта көрсетуді сұраймын"), accepted: true, next: "taste", example: "Покажи мне", feedback: at("Попросить повторить — нормально, особенно если жест быстрый.", "Asking for a repeat is fine.", "Қайталауды сұрау — қалыпты.") },
          ] },
        { id: "taste", prompt: at("Вкусно?", "Is it tasty?", "Дәмді ме?"), context: at("Вы попробовали заказ. Друг спрашивает, понравилось ли.", "You tried your order. Your friend asks if you liked it.", "Тапсырысты татып көрдіңіз."), signs: ["вкусный"], avatar: "Вкусный", choices: [
            { id: "tasty", text: at("Да, вкусно", "Yes, it is tasty", "Иә, дәмді"), accepted: true, example: "Вкусный", feedback: at("Вы ответили на вопрос. Мимика тоже важна: улыбка подтверждает «вкусно».", "Your face matters too: a smile confirms “tasty”.", "Бет-әлпет те маңызды.") },
            { id: "cold", text: at("Вода холодная", "The water is cold", "Су суық"), accepted: true, example: "Вода холодный", feedback: at("Тоже подходящий ответ: вы описали напиток.", "Also relevant: you described the drink.", "Бұл да орынды жауап.") },
            { id: "work", text: at("Сегодня работаю", "I work today", "Бүгін жұмыс істеймін"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
      ],
    },
    {
      id: "family",
      title: at("Семья", "Family", "Отбасы"),
      description: at("Расскажите о своей семье: кто в ней есть и где вы живёте.", "Talk about your family and where you live.", "Отбасыңыз туралы айтыңыз."),
      image: "семья",
      start: "size",
      steps: [
        { id: "size", prompt: at("У тебя большая семья?", "Is your family big?", "Отбасың үлкен бе?"), context: at("Новый знакомый спрашивает о вашей семье.", "A new acquaintance asks about your family.", "Жаңа танысыңыз отбасыңыз туралы сұрайды."), signs: ["ты", "семья", "большой"], avatar: "Ты семья большой", choices: [
            { id: "big", text: at("Да: мама, папа, брат и сестра", "Yes: mum, dad, brother and sister", "Иә: анам, әкем, ағам және әпкем"), accepted: true, next: "where", example: "Мать отец брат сестра", feedback: at("Вы ответили и назвали членов семьи.", "You answered and named family members.", "Отбасы мүшелерін атадыңыз.") },
            { id: "small", text: at("Нет, семья маленькая", "No, my family is small", "Жоқ, отбасым шағын"), accepted: true, next: "where", example: "Семья маленький", feedback: at("Тоже верный ответ на вопрос.", "Also a correct answer.", "Бұл да дұрыс жауап.") },
            { id: "price", text: at("Спрошу, сколько стоит хлеб", "Ask the price of bread", "Нанның бағасын сұраймын"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
        { id: "where", prompt: at("Твоя семья живёт в городе?", "Does your family live in the city?", "Отбасың қалада тұра ма?"), context: at("Разговор продолжается.", "The conversation continues.", "Әңгіме жалғасады."), signs: ["твой", "семья", "город", "жить"], avatar: "Твой семья город жить", choices: [
            { id: "city", text: at("Да, мы живём в городе", "Yes, we live in the city", "Иә, қалада тұрамыз"), accepted: true, next: "love", example: "Мы город жить", feedback: at("Вы ответили, где живёт семья.", "You said where your family lives.", "Отбасыңыз қайда тұратынын айттыңыз.") },
            { id: "house", text: at("Мы живём в своём доме", "We live in our own house", "Өз үйімізде тұрамыз"), accepted: true, next: "love", example: "Мы дом жить", feedback: at("Подходящий ответ.", "A relevant answer.", "Орынды жауап.") },
            { id: "tasty", text: at("Вкусно!", "Tasty!", "Дәмді!"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
        { id: "love", prompt: at("Ты любишь свою семью?", "Do you love your family?", "Отбасыңды жақсы көресің бе?"), context: at("Последний вопрос — тёплый.", "A warm last question.", "Соңғы сұрақ."), signs: ["ты", "семья", "любить"], avatar: "Ты семья любить", choices: [
            { id: "yes", text: at("Да, очень люблю", "Yes, very much", "Иә, қатты жақсы көремін"), accepted: true, example: "Я семья любить", feedback: at("Отлично! Вы поддержали разговор о семье.", "Great, you kept the conversation going.", "Тамаша!") },
            { id: "siblings", text: at("Расскажу про брата и сестру", "Tell about my brother and sister", "Ағам мен әпкем туралы айтамын"), accepted: true, example: "Мой брат сестра", feedback: at("Тоже хорошо: разговор становится подробнее.", "Good: the conversation gets more detailed.", "Жақсы.") },
            { id: "head", text: at("Покажу жест «болит»", "Sign “hurts”", "«Ауырады» ымын көрсетемін"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
      ],
    },
    {
      id: "plans",
      title: at("Планы", "Plans", "Жоспарлар"),
      description: at("Договоритесь о времени: когда вы работаете и что делаете завтра.", "Arrange a time: when you work and what you do tomorrow.", "Уақыт туралы келісіңіз."),
      image: "завтра",
      start: "when",
      steps: [
        { id: "when", prompt: at("Когда ты работаешь?", "When do you work?", "Қашан жұмыс істейсің?"), context: at("Коллега хочет договориться о встрече.", "A colleague wants to arrange a meeting.", "Әріптесіңіз кездесуге келіскісі келеді."), signs: ["ты", "работать", "когда"], avatar: "Ты работать когда", choices: [
            { id: "morning", text: at("Сегодня утром", "This morning", "Бүгін таңертең"), accepted: true, next: "tomorrow", example: "Сегодня утро работать", feedback: at("Вы назвали время — это ответ на «когда?».", "You named a time — that answers “when?”.", "Уақытты атадыңыз.") },
            { id: "evening", text: at("Вечером", "In the evening", "Кешке"), accepted: true, next: "tomorrow", example: "Вечер работать", feedback: at("Тоже ответ на вопрос о времени.", "Also a time answer.", "Бұл да уақыт туралы жауап.") },
            { id: "family", text: at("Мою семью", "My family", "Менің отбасым"), accepted: false, feedback: at("Вопрос «когда?» — ответ должен быть про время.", "“When?” needs a time.", "«Қашан?» — уақыт керек.") },
          ] },
        { id: "tomorrow", prompt: at("Что ты делаешь завтра?", "What are you doing tomorrow?", "Ертең не істейсің?"), context: at("Время в РЖЯ обычно показывают в начале фразы.", "In RSL the time usually comes first.", "РЖЯ-да уақыт әдетте басында."), signs: ["завтра", "ты", "что"], avatar: "Завтра ты что", choices: [
            { id: "city", text: at("Завтра еду в город", "Tomorrow I am going to the city", "Ертең қалаға барамын"), accepted: true, next: "together", example: "Завтра я город ехать", feedback: at("Хорошо: «завтра» в начале, действие в конце.", "Good: time first, action last.", "Жақсы: уақыт басында.") },
            { id: "sleep", text: at("Завтра буду спать", "Tomorrow I will sleep", "Ертең ұйықтаймын"), accepted: true, next: "together", example: "Завтра я спать", feedback: at("Тоже ответ на вопрос.", "Also an answer.", "Бұл да жауап.") },
            { id: "price", text: at("Сколько стоит?", "How much is it?", "Қанша тұрады?"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
        { id: "together", prompt: at("Пойдём вечером вместе?", "Shall we go together in the evening?", "Кешке бірге барайық па?"), context: at("Коллега предлагает встретиться.", "Your colleague suggests meeting.", "Әріптесіңіз кездесуді ұсынады."), signs: ["вечер", "мы", "идти"], avatar: "Вечер мы идти", choices: [
            { id: "yes", text: at("Да, вечером пойдём", "Yes, let’s go in the evening", "Иә, кешке барайық"), accepted: true, example: "Вечер мы идти", feedback: at("Договорились!", "Agreed!", "Келістік!") },
            { id: "unsure", text: at("Ещё не знаю, скажу завтра", "Not sure yet, I’ll say tomorrow", "Әлі білмеймін, ертең айтамын"), accepted: true, example: "Я знать завтра", feedback: at("Честный ответ — тоже нормальный ответ.", "An honest answer is fine too.", "Шынайы жауап та қалыпты.") },
            { id: "head", text: at("Голова", "Head", "Бас"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
      ],
    },
    {
      id: "health",
      title: at("Самочувствие", "How you feel", "Көңіл-күй"),
      description: at("Объясните, что болит, и попросите помощи.", "Explain what hurts and ask for help.", "Не ауыратынын айтып, көмек сұраңыз."),
      image: "голова",
      start: "what",
      steps: [
        { id: "what", prompt: at("Что случилось?", "What happened?", "Не болды?"), context: at("Коллега видит, что вам нехорошо.", "A colleague sees you are unwell.", "Әріптесіңіз сізге жайсыз екенін көреді."), signs: ["что"], avatar: "Что", choices: [
            { id: "head", text: at("У меня болит голова", "I have a headache", "Басым ауырады"), accepted: true, next: "help", example: "Я голова болит", feedback: at("Вы объяснили, что случилось.", "You explained what happened.", "Не болғанын түсіндірдіңіз.") },
            { id: "bread", text: at("Хочу купить хлеб", "I want to buy bread", "Нан сатып алғым келеді"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
            { id: "tasty", text: at("Скажу «вкусно»", "Say “tasty”", "«Дәмді» деймін"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
        { id: "help", prompt: at("Тебе помочь?", "Do you need help?", "Саған көмектесейін бе?"), context: at("Коллега предлагает помощь.", "Your colleague offers help.", "Әріптесіңіз көмек ұсынады."), signs: ["ты", "помочь"], avatar: "Ты помочь", choices: [
            { id: "yes", text: at("Да, помоги мне", "Yes, please help me", "Иә, маған көмектес"), accepted: true, next: "home", example: "Помоги мне", feedback: at("Вы приняли помощь.", "You accepted help.", "Көмекті қабылдадыңыз.") },
            { id: "again", text: at("Попрошу показать ещё раз", "Ask to show it again", "Қайта көрсетуді сұраймын"), accepted: true, next: "home", example: "Покажи мне", feedback: at("Если не поняли — попросить повторить правильно.", "If unsure, ask for a repeat.", "Түсінбесеңіз, қайталауды сұраңыз.") },
            { id: "red", text: at("Скажу «красный»", "Say “red”", "«Қызыл» деймін"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
        { id: "home", prompt: at("Ты пойдёшь домой?", "Will you go home?", "Үйге барасың ба?"), context: at("Нужно решить, что делать дальше.", "Decide what to do next.", "Әрі қарай не істеу керегін шешіңіз."), signs: ["ты", "дом", "идти"], avatar: "Ты дом идти", choices: [
            { id: "home", text: at("Да, пойду домой", "Yes, I’ll go home", "Иә, үйге барамын"), accepted: true, example: "Я дом идти", feedback: at("Понятный ответ. Берегите себя!", "Clear answer. Take care!", "Түсінікті жауап.") },
            { id: "work", text: at("Нет, поработаю до вечера", "No, I’ll work until the evening", "Жоқ, кешке дейін жұмыс істеймін"), accepted: true, example: "Я работать вечер", feedback: at("Тоже ответ на вопрос.", "Also an answer.", "Бұл да жауап.") },
            { id: "price", text: at("Сколько стоит?", "How much is it?", "Қанша тұрады?"), accepted: false, feedback: at("Это не ответ на вопрос. Попробуйте ещё раз.", "That does not answer the question. Try again.", "Бұл сұраққа жауап емес. Қайталап көріңіз.") },
          ] },
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
