import { at } from "../i18n/automation";

export function LearningGallery() {
  const scenes = [
    {
      image: "practice",
      title: at("В своём темпе", "At your own pace", "Өз қарқыныңызбен"),
      text: at(
        "Наблюдайте за жестом и возвращайтесь к сложным частям движения в удобном темпе.",
        "Watch a sign and revisit difficult movements at your own pace.",
        "Ымды қарап, күрделі қимылдарға өз қарқыныңызбен оралыңыз.",
      ),
      alt: at(
        "Студентка за ноутбуком делает записи в тетради",
        "A student taking notes while studying on her laptop",
        "Ноутбукпен оқып, дәптерге жазба жасап отырған студент",
      ),
    },
    {
      image: "conversation",
      title: at(
        "Вместе с преподавателем",
        "Together with your teacher",
        "Оқытушымен бірге",
      ),
      text: at(
        "Используйте видеообразцы и обсуждайте сложные движения с преподавателем РЖЯ. Аватар не заменяет обратную связь специалиста.",
        "Use reference videos and discuss difficult movements with an RSL teacher. The avatar does not replace expert feedback.",
        "Бейнеүлгілерді қолданып, күрделі қимылдарды орыс ым тілі оқытушысымен талқылаңыз. Аватар маманның кері байланысын алмастырмайды.",
      ),
      alt: at(
        "Преподаватель обсуждает учебные темы с тремя студентами",
        "A teacher discussing learning topics with three students",
        "Үш студентпен оқу тақырыптарын талқылап отырған оқытушы",
      ),
    },
    {
      image: "study-desk",
      title: at("Шаг за шагом", "Step by step", "Қадам сайын"),
      text: at(
        "От наблюдения — к повторению. Сначала рассмотрите движение, затем попробуйте воспроизвести его самостоятельно.",
        "From watching to practising. Inspect the movement first, then try to reproduce it yourself.",
        "Бақылаудан қайталауға. Алдымен қимылды қарап, кейін өзіңіз қайталап көріңіз.",
      ),
      alt: at(
        "Светящаяся дорожка поднимается по ступеням вокруг стеклянной сферы",
        "A glowing path climbs steps around a glass sphere",
        "Шыны шардың айналасындағы баспалдақтармен жоғары көтерілетін жарқыраған жол",
      ),
    },
  ];
  return (
    <section
      className="mentor-section learning-gallery"
      id="learning-gallery"
      aria-labelledby="gallery-title"
      data-reveal
    >
      <div className="mentor-section-heading">
        <span className="mentor-kicker">
          AI MENTOR /{" "}
          {at("УЧИТЬСЯ ПО-СВОЕМУ", "YOUR WAY TO LEARN", "ӨЗ ЖОЛЫҢЫЗБЕН ОҚЫҢЫЗ")}
        </span>
        <h2 id="gallery-title">
          {at("Разные пути.", "Different paths.", "Әртүрлі жолдар.")} <br />
          <span>
            {at("Новые открытия.", "New discoveries.", "Жаңа жаңалықтар.")}
          </span>
        </h2>
      </div>
      <div className="learning-gallery-grid">
        {scenes.map((scene) => (
          <article className="learning-gallery-card" key={scene.image}>
            <div className="learning-gallery-image">
              <img
                src={`/images/landing-v2/${scene.image}.webp`}
                alt=""
                loading="lazy"
              />
            </div>
            <h3>{scene.title}</h3>
            <p>{scene.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
