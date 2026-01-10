import { STYLISTS, PersonalStylist } from './PersonalStylistService';

const BACKEND_URL = 'https://dripn-server--shenisampson79.replit.app';

export interface LocalizedGreeting {
  greeting: string;
  signOff: string;
  language: string;
  region?: string;
  stylistId: string;
}

interface CulturalContext {
  language: string;
  region?: string;
  formality: 'casual' | 'formal' | 'friendly';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'general';
}

const CULTURAL_GREETINGS: Record<string, Record<string, { greetings: string[]; signOffs: string[] }>> = {
  Spanish: {
    'Standard Spanish': {
      greetings: [
        "¡Hola {name}! Soy {stylist}, tu estilista personal. ¡Qué alegría conocerte! He estado echando un vistazo a tu armario y ya tengo algunas ideas fantásticas. ¿Qué te trae por aquí hoy?",
        "¡Qué tal {name}! Soy {stylist}, y estoy encantada de ayudarte con tu estilo. He revisado tu guardarropa y veo un potencial increíble. ¿En qué puedo ayudarte?",
        "¡Buenas {name}! Aquí {stylist}, tu asesora de imagen personal. Me hace mucha ilusión trabajar contigo. ¿Qué look buscamos hoy?",
        "¡Hola guapa! Soy {stylist}, y créeme, vamos a pasarlo genial eligiendo outfits juntas. ¿Para qué ocasión te visto hoy?",
        "¡Ey {name}! {stylist} al habla. La moda es mi pasión y ayudarte a brillar es lo que más me gusta. ¿Qué tienes en mente?",
      ],
      signOffs: [
        "¡Vas a arrasar, {name}! ¡Mucha suerte!",
        "¡Estás espectacular! ¡Disfruta del día!",
        "¡Menudo look! ¡A conquistar el mundo!",
        "¡Recuerda, la actitud es el mejor accesorio! ¡Pásalo genial!",
        "¡Guapísima! ¡Que lo disfrutes!",
        "¡Confía en ti, que estás radiante!",
      ],
    },
  },
  French: {
    'Standard French': {
      greetings: [
        "Bonjour {name}! Je suis {stylist}, ta conseillère mode personnelle. Ravie de te rencontrer! J'ai jeté un œil à ta garde-robe et j'ai déjà plein d'idées. Qu'est-ce qui t'amène aujourd'hui?",
        "Salut {name}! {stylist} à ton service. J'adore ce qu'on va pouvoir créer ensemble! Alors, qu'est-ce qu'on stylise aujourd'hui?",
        "Coucou {name}! C'est {stylist}, ta styliste attitrée. J'ai hâte de t'aider à trouver le look parfait. C'est pour quelle occasion?",
        "Hello {name}! Moi c'est {stylist}, et je suis là pour sublimer ton style. Dis-moi tout, qu'est-ce que tu cherches?",
        "Bienvenue {name}! Je suis {stylist}, passionnée de mode et prête à t'accompagner. Qu'est-ce qui te ferait plaisir?",
      ],
      signOffs: [
        "Tu vas faire sensation, {name}! Amuse-toi bien!",
        "Tu es superbe! Profite à fond!",
        "N'oublie pas, l'élégance c'est avant tout la confiance! Bonne journée!",
        "Tu vas tout déchirer! À très vite!",
        "Magnifique! Passe une excellente journée!",
        "Tu rayonnes! Bonne continuation!",
      ],
    },
  },
  German: {
    'Standard German': {
      greetings: [
        "Hallo {name}! Ich bin {stylist}, deine persönliche Stylistin. Schön, dich kennenzulernen! Ich habe mir schon mal deinen Kleiderschrank angeschaut und habe tolle Ideen. Was führt dich heute her?",
        "Hey {name}! {stylist} hier. Ich freue mich total, dir bei deinem Style zu helfen. Wofür darf ich dich heute stylen?",
        "Servus {name}! Ich bin {stylist}, und Mode ist meine Leidenschaft. Lass uns zusammen deinen perfekten Look finden. Was schwebt dir vor?",
        "Grüß dich {name}! Hier ist {stylist}, deine Style-Beraterin. Ich bin gespannt, was wir heute gemeinsam kreieren! Was hast du dir vorgestellt?",
        "Moin {name}! {stylist} am Start. Lass uns loslegen und dich in Szene setzen. Für welchen Anlass brauchst du Unterstützung?",
      ],
      signOffs: [
        "Du siehst fantastisch aus, {name}! Hab einen tollen Tag!",
        "Das Outfit ist der Hammer! Viel Spaß!",
        "Denk dran, Selbstbewusstsein ist das beste Accessoire! Mach's gut!",
        "Du wirst alle begeistern! Bis bald!",
        "Wunderschön! Genieß den Tag!",
        "Strahlend schön! Alles Gute!",
      ],
    },
  },
  Italian: {
    'Standard Italian': {
      greetings: [
        "Ciao {name}! Sono {stylist}, la tua stilista personale. Che piacere conoscerti! Ho già dato un'occhiata al tuo guardaroba e ho delle idee fantastiche. Cosa ti porta qui oggi?",
        "Ciao bella! Sono {stylist}, e sono entusiasta di aiutarti con il tuo stile. Per quale occasione ti prepariamo oggi?",
        "Buongiorno {name}! Qui {stylist}, pronta a trasformare il tuo look. Dimmi tutto, cosa hai in mente?",
        "Ehi {name}! Sono {stylist}, e la moda è la mia passione. Insieme creeremo outfit incredibili! Cosa ti serve?",
        "Ciao tesoro! {stylist} qui per te. Non vedo l'ora di aiutarti a brillare. Per cosa posso esserti utile?",
      ],
      signOffs: [
        "Sarai splendida, {name}! In bocca al lupo!",
        "Sei bellissima! Divertiti!",
        "Ricorda, la sicurezza è l'accessorio più bello! Buona giornata!",
        "Farai un figurone! A presto!",
        "Stupenda! Goditi la giornata!",
        "Sei radiosa! Buona fortuna!",
      ],
    },
  },
  Japanese: {
    'Standard Japanese': {
      greetings: [
        "こんにちは{name}さん！{stylist}です、あなたのパーソナルスタイリストです。お会いできて嬉しいです！クローゼットを拝見しましたが、素敵なアイデアがたくさんあります。今日はどんなご用件ですか？",
        "やあ{name}さん！{stylist}よ。ファッションのお手伝いができるなんて最高！今日は何をスタイリングしましょうか？",
        "{name}さん、こんにちは！{stylist}です。一緒に完璧なコーディネートを見つけましょう。どんな場面のスタイリングをご希望ですか？",
        "はじめまして{name}さん！{stylist}です。あなたの魅力を引き出すお手伝いをさせてください。今日のご相談は？",
        "ようこそ{name}さん！パーソナルスタイリストの{stylist}です。素敵なスタイルを一緒に作りましょう。何かお探しですか？",
      ],
      signOffs: [
        "素敵ですね、{name}さん！頑張ってください！",
        "とてもお似合いです！楽しんでくださいね！",
        "自信を持って！それが一番の魅力ですよ！",
        "完璧です！素敵な一日を！",
        "輝いていますね！またお話ししましょう！",
        "美しいです！ご健闘をお祈りします！",
      ],
    },
  },
  Portuguese: {
    'Standard Portuguese': {
      greetings: [
        "Olá {name}! Sou {stylist}, a tua estilista pessoal. Que bom conhecer-te! Já dei uma olhadela ao teu guarda-roupa e tenho imensas ideias. O que te traz cá hoje?",
        "Oi {name}! Aqui é {stylist}. Estou super animada para te ajudar com o teu estilo. Para que ocasião vamos te preparar?",
        "E aí {name}! Sou {stylist}, e moda é a minha paixão. Vamos criar looks incríveis juntas! O que você precisa?",
        "Tudo bem {name}? {stylist} por aqui! Pronta para te deixar ainda mais linda. Em que posso ajudar?",
        "Olá querida {name}! Sou {stylist}, e estou aqui para realçar a tua beleza. O que tens em mente?",
      ],
      signOffs: [
        "Vais arrasar, {name}! Boa sorte!",
        "Estás linda! Diverte-te!",
        "Lembra-te, confiança é o melhor acessório! Bom dia!",
        "Vais fazer sucesso! Até breve!",
        "Maravilhosa! Aproveita o dia!",
        "Estás radiante! Tudo de bom!",
      ],
    },
  },
  Korean: {
    'Standard Korean': {
      greetings: [
        "안녕하세요 {name}님! 저는 {stylist}이에요, 당신의 퍼스널 스타일리스트입니다. 만나서 정말 반가워요! 옷장을 살펴봤는데 멋진 아이디어가 많아요. 오늘은 어떤 일로 오셨나요?",
        "안녕 {name}님! {stylist}예요. 스타일링 도와드릴 수 있어서 너무 신나요! 오늘은 뭘 스타일링할까요?",
        "{name}님, 반가워요! {stylist}입니다. 완벽한 코디를 함께 찾아봐요. 어떤 자리를 위한 스타일링인가요?",
        "하이 {name}님! 저는 {stylist}이고, 패션이 제 열정이에요. 함께 멋진 룩을 만들어봐요! 뭘 도와드릴까요?",
        "환영해요 {name}님! 퍼스널 스타일리스트 {stylist}입니다. 당신의 매력을 더 빛나게 해드릴게요. 뭘 찾으세요?",
      ],
      signOffs: [
        "너무 멋져요, {name}님! 화이팅!",
        "정말 예뻐요! 즐거운 시간 보내세요!",
        "자신감이 최고의 액세서리예요! 좋은 하루 되세요!",
        "완벽해요! 곧 또 봬요!",
        "아름다워요! 좋은 하루 보내세요!",
        "빛나고 계세요! 행운을 빌어요!",
      ],
    },
  },
  Chinese: {
    'Standard Mandarin': {
      greetings: [
        "你好{name}！我是{stylist}，你的私人造型师。很高兴认识你！我已经看过你的衣橱了，有很多棒的想法。今天有什么我可以帮你的？",
        "嗨{name}！我是{stylist}。能帮你打造造型真的太开心了！今天想做什么造型呢？",
        "{name}你好！这里是{stylist}。让我们一起找到完美的搭配吧。你是为什么场合做准备呢？",
        "哈喽{name}！我是{stylist}，时尚是我的热情所在。让我们一起创造惊艳的造型！你需要什么帮助？",
        "欢迎{name}！我是你的私人造型师{stylist}。让我帮你展现最好的自己。你在找什么？",
      ],
      signOffs: [
        "你会很棒的，{name}！加油！",
        "真的很美！好好享受吧！",
        "记住，自信是最好的配饰！祝你有美好的一天！",
        "完美！回头见！",
        "太漂亮了！享受你的一天！",
        "你在发光！祝好运！",
      ],
    },
  },
  Arabic: {
    'Modern Standard Arabic': {
      greetings: [
        "أهلاً {name}! أنا {stylist}، مستشارتك الشخصية للأزياء. سعيدة جداً بلقائك! ألقيت نظرة على خزانة ملابسك ولدي أفكار رائعة. كيف يمكنني مساعدتك اليوم؟",
        "مرحباً {name}! أنا {stylist}. متحمسة جداً لمساعدتك في إطلالتك! ماذا نصمم اليوم؟",
        "{name} أهلاً! أنا {stylist}، ولنجد معاً الإطلالة المثالية. لأي مناسبة تستعدين؟",
        "هلا {name}! أنا {stylist}، والموضة شغفي. لنصنع معاً إطلالات مذهلة! ماذا تحتاجين؟",
        "أهلاً وسهلاً {name}! أنا مستشارتك للأزياء {stylist}. دعيني أساعدك لتبرزي جمالك. بماذا تفكرين؟",
      ],
      signOffs: [
        "ستكونين رائعة، {name}! بالتوفيق!",
        "أنتِ جميلة جداً! استمتعي!",
        "تذكري، الثقة هي أفضل إكسسوار! يوماً سعيداً!",
        "مثالية! إلى اللقاء!",
        "خلابة! استمتعي بيومك!",
        "أنتِ متألقة! حظاً سعيداً!",
      ],
    },
  },
  Hindi: {
    'Standard Hindi': {
      greetings: [
        "नमस्ते {name}! मैं {stylist} हूं, आपकी पर्सनल स्टाइलिस्ट। आपसे मिलकर बहुत खुशी हुई! मैंने आपकी अलमारी देखी है और मेरे पास कमाल के आइडियाज़ हैं। आज क्या मदद कर सकती हूं?",
        "हाय {name}! मैं {stylist}। आपकी स्टाइलिंग में मदद करके बहुत एक्साइटेड हूं! आज क्या स्टाइल करें?",
        "{name} जी नमस्कार! यहां {stylist} है। चलिए मिलकर परफेक्ट लुक ढूंढते हैं। किस मौके के लिए तैयार हो रही हैं?",
        "हेलो {name}! मैं {stylist}, और फैशन मेरा जुनून है। साथ मिलकर अमेजिंग आउटफिट्स बनाएंगे! क्या चाहिए आपको?",
        "स्वागत है {name}! मैं आपकी पर्सनल स्टाइलिस्ट {stylist} हूं। आपकी खूबसूरती को और निखारने में मदद करूंगी। क्या सोच रखा है?",
      ],
      signOffs: [
        "आप कमाल लग रही हैं, {name}! बेस्ट ऑफ लक!",
        "बहुत खूबसूरत! मज़े करिए!",
        "याद रखिए, कॉन्फिडेंस सबसे बेस्ट एक्सेसरी है! शुभ दिन!",
        "परफेक्ट! जल्दी मिलते हैं!",
        "गॉर्जियस! दिन का मज़ा लीजिए!",
        "आप चमक रही हैं! गुड लक!",
      ],
    },
  },
  Dutch: {
    'Standard Dutch': {
      greetings: [
        "Hallo {name}! Ik ben {stylist}, jouw persoonlijke styliste. Leuk je te ontmoeten! Ik heb al even naar je kledingkast gekeken en heb geweldige ideeën. Waar kan ik je vandaag mee helpen?",
        "Hey {name}! {stylist} hier. Super leuk om je te helpen met je stijl! Wat gaan we vandaag stylen?",
        "Hoi {name}! Ik ben {stylist}, en mode is mijn passie. Laten we samen de perfecte look vinden. Voor welke gelegenheid kleed je je?",
        "Dag {name}! Hier is {stylist}, je stijladviseur. Ik kan niet wachten om samen iets moois te creëren! Wat had je in gedachten?",
        "Welkom {name}! Ik ben {stylist}, je persoonlijke styliste. Ik help je graag stralen. Wat zoek je?",
      ],
      signOffs: [
        "Je gaat er fantastisch uitzien, {name}! Succes!",
        "Prachtig! Veel plezier!",
        "Onthoud, zelfvertrouwen is het beste accessoire! Fijne dag!",
        "Perfect! Tot snel!",
        "Schitterend! Geniet van je dag!",
        "Je straalt! Veel succes!",
      ],
    },
  },
  Russian: {
    'Standard Russian': {
      greetings: [
        "Привет {name}! Я {stylist}, твой персональный стилист. Очень рада познакомиться! Я уже посмотрела твой гардероб и у меня есть отличные идеи. Чем могу помочь сегодня?",
        "Привет {name}! Это {stylist}. Очень рада помочь тебе с образом! Что будем стилизовать сегодня?",
        "{name}, привет! Я {stylist}. Давай вместе найдём идеальный образ. Для какого случая одеваемся?",
        "Хай {name}! Я {stylist}, и мода — моя страсть. Создадим вместе потрясающие образы! Что тебе нужно?",
        "Добро пожаловать {name}! Я твой персональный стилист {stylist}. Помогу тебе засиять! О чём думаешь?",
      ],
      signOffs: [
        "Ты будешь великолепна, {name}! Удачи!",
        "Ты прекрасна! Наслаждайся!",
        "Помни, уверенность — лучший аксессуар! Хорошего дня!",
        "Идеально! До скорой встречи!",
        "Потрясающе! Наслаждайся днём!",
        "Ты сияешь! Удачи тебе!",
      ],
    },
  },
  Swedish: {
    'Standard Swedish': {
      greetings: [
        "Hej {name}! Jag är {stylist}, din personliga stylist. Så roligt att träffas! Jag har redan tittat på din garderob och har massor av idéer. Vad kan jag hjälpa dig med idag?",
        "Tjena {name}! {stylist} här. Så kul att hjälpa dig med din stil! Vad ska vi styla idag?",
        "Hej {name}! Jag är {stylist}, och mode är min passion. Låt oss hitta den perfekta looken tillsammans. Vilken tillfälle klär du dig för?",
        "Hallå {name}! Här är {stylist}, din stilrådgivare. Jag längtar efter att skapa något fint tillsammans! Vad tänker du på?",
        "Välkommen {name}! Jag är {stylist}, din personliga stylist. Jag hjälper dig gärna att stråla. Vad letar du efter?",
      ],
      signOffs: [
        "Du kommer se fantastisk ut, {name}! Lycka till!",
        "Så vacker! Ha det så kul!",
        "Kom ihåg, självförtroende är den bästa accessoaren! Ha en fin dag!",
        "Perfekt! Vi ses snart!",
        "Underbar! Njut av din dag!",
        "Du strålar! Lycka till!",
      ],
    },
  },
};

const CULTURAL_GREETINGS_MALE: Record<string, Record<string, { greetings: string[]; signOffs: string[] }>> = {
  Spanish: {
    'Standard Spanish': {
      greetings: [
        "¡Qué pasa {name}! Soy {stylist}, tu estilista personal. ¡Me alegro de conocerte! He echado un vistazo a tu armario y tengo ideas geniales. ¿Qué te trae por aquí hoy?",
        "¡Qué tal {name}! Soy {stylist}, y estoy encantado de ayudarte con tu estilo. He visto tu guardarropa y hay mucho potencial. ¿En qué puedo echarte una mano?",
        "¡Buenas {name}! Aquí {stylist}, tu asesor de imagen personal. Mola un montón poder trabajar contigo. ¿Qué look buscamos hoy?",
        "¡Ey {name}! Soy {stylist}, tu tío para temas de estilo. Vamos a dejarte perfecto. ¿Para qué ocasión te preparo?",
        "¡Hola tío! {stylist} al habla. El estilo es mi rollo y ayudarte a ir elegante es lo que más me mola. ¿Qué tienes en mente?",
      ],
      signOffs: [
        "¡Vas a petarlo, {name}! ¡Mucha suerte, crack!",
        "¡Estás impecable! ¡A disfrutar del día!",
        "¡Menudo look! ¡A comerte el mundo!",
        "¡Recuerda, la actitud es clave! ¡Pásalo genial!",
        "¡Vas hecho un pincel! ¡Disfruta!",
        "¡Confía en ti, que lo vas a clavar!",
      ],
    },
  },
  French: {
    'Standard French': {
      greetings: [
        "Salut {name}! Je suis {stylist}, ton conseiller mode personnel. Enchanté de te rencontrer! J'ai jeté un œil à ta garde-robe et j'ai plein d'idées. Qu'est-ce qui t'amène aujourd'hui?",
        "Hey {name}! {stylist} à ton service. J'adore ce qu'on va pouvoir créer ensemble! Alors, qu'est-ce qu'on stylise aujourd'hui?",
        "Yo {name}! C'est {stylist}, ton styliste attitré. J'ai hâte de t'aider à trouver le look parfait. C'est pour quelle occasion?",
        "Bonjour {name}! Moi c'est {stylist}, et je suis là pour sublimer ton style. Dis-moi tout, qu'est-ce que tu cherches?",
        "Bienvenue {name}! Je suis {stylist}, passionné de mode et prêt à t'accompagner. Qu'est-ce qui te ferait plaisir?",
      ],
      signOffs: [
        "Tu vas faire sensation, {name}! Amuse-toi bien!",
        "Tu es super! Profite à fond!",
        "N'oublie pas, l'élégance c'est avant tout la confiance! Bonne journée!",
        "Tu vas tout déchirer! À très vite!",
        "Nickel! Passe une excellente journée!",
        "Tu as la classe! Bonne continuation!",
      ],
    },
  },
  German: {
    'Standard German': {
      greetings: [
        "Hey {name}! Ich bin {stylist}, dein persönlicher Stylist. Freut mich, dich kennenzulernen! Ich hab mir schon mal deinen Kleiderschrank angeschaut und hab coole Ideen. Was führt dich heute her?",
        "Moin {name}! {stylist} hier. Ich freu mich total, dir bei deinem Style zu helfen. Wofür darf ich dich heute stylen?",
        "Servus {name}! Ich bin {stylist}, und Mode ist meine Leidenschaft. Lass uns zusammen deinen perfekten Look finden. Was schwebt dir vor?",
        "Grüß dich {name}! Hier ist {stylist}, dein Style-Berater. Ich bin gespannt, was wir heute gemeinsam kreieren! Was hast du dir vorgestellt?",
        "Na {name}! {stylist} am Start. Lass uns loslegen und dich in Szene setzen. Für welchen Anlass brauchst du Support?",
      ],
      signOffs: [
        "Du siehst hammer aus, {name}! Hab einen geilen Tag!",
        "Das Outfit sitzt! Viel Spaß!",
        "Denk dran, Selbstbewusstsein ist das beste Accessoire! Mach's gut!",
        "Du wirst alle umhauen! Bis bald!",
        "Top gestylt! Genieß den Tag!",
        "Stark! Alles Gute!",
      ],
    },
  },
  Italian: {
    'Standard Italian': {
      greetings: [
        "Ciao {name}! Sono {stylist}, il tuo stilista personale. Che piacere conoscerti! Ho già dato un'occhiata al tuo guardaroba e ho delle idee fantastiche. Cosa ti porta qui oggi?",
        "Ehi {name}! Sono {stylist}, e sono entusiasta di aiutarti con il tuo stile. Per quale occasione ti prepariamo oggi?",
        "Buongiorno {name}! Qui {stylist}, pronto a trasformare il tuo look. Dimmi tutto, cosa hai in mente?",
        "Ciao bello! Sono {stylist}, e la moda è la mia passione. Insieme creeremo outfit incredibili! Cosa ti serve?",
        "Salve {name}! {stylist} qui per te. Non vedo l'ora di aiutarti a spaccare. Per cosa posso esserti utile?",
      ],
      signOffs: [
        "Sarai un figo, {name}! In bocca al lupo!",
        "Sei impeccabile! Divertiti!",
        "Ricorda, la sicurezza è l'accessorio più forte! Buona giornata!",
        "Farai un figurone! A presto!",
        "Perfetto! Goditi la giornata!",
        "Sei al top! Buona fortuna!",
      ],
    },
  },
  Japanese: {
    'Standard Japanese': {
      greetings: [
        "やあ{name}さん！{stylist}です、あなたのパーソナルスタイリストです。お会いできて嬉しいです！クローゼットを拝見しましたが、いい感じのアイデアがあります。今日はどんなご用件ですか？",
        "こんにちは{name}さん！{stylist}だよ。ファッションのお手伝いができるなんて最高！今日は何をスタイリングする？",
        "{name}さん、どうも！{stylist}です。一緒にバッチリなコーディネートを見つけよう。どんな場面のスタイリングをご希望？",
        "よう{name}さん！{stylist}です。かっこよくキメるお手伝いをさせてくれ。今日のご相談は？",
        "ようこそ{name}さん！パーソナルスタイリストの{stylist}です。一緒にいいスタイル作ろうぜ。何かお探し？",
      ],
      signOffs: [
        "いい感じだね、{name}さん！頑張れよ！",
        "カッコいいぞ！楽しんできて！",
        "自信を持てば大丈夫！それが一番だ！",
        "完璧だ！いい一日を！",
        "キマってるね！また話そう！",
        "イケてるよ！頑張れ！",
      ],
    },
  },
  Portuguese: {
    'Standard Portuguese': {
      greetings: [
        "E aí {name}! Sou {stylist}, o teu estilista pessoal. Bom conhecer-te! Já dei uma olhadela ao teu guarda-roupa e tenho boas ideias. O que te traz cá hoje?",
        "Fala {name}! Aqui é {stylist}. Estou animado para te ajudar com o teu estilo. Para que ocasião vamos te preparar?",
        "Oi {name}! Sou {stylist}, e moda é a minha cena. Vamos criar looks incríveis juntos! O que você precisa?",
        "Tudo bem {name}? {stylist} por aqui! Pronto para te deixar ainda mais estiloso. Em que posso ajudar?",
        "Olá {name}! Sou {stylist}, e estou aqui para realçar o teu estilo. O que tens em mente?",
      ],
      signOffs: [
        "Vais arrasar, {name}! Boa sorte!",
        "Estás impecável! Diverte-te!",
        "Lembra-te, confiança é o melhor acessório! Bom dia!",
        "Vais fazer sucesso! Até breve!",
        "Muito bom! Aproveita o dia!",
        "Estás no ponto! Tudo de bom!",
      ],
    },
  },
  Korean: {
    'Standard Korean': {
      greetings: [
        "안녕 {name}! 나는 {stylist}야, 너의 퍼스널 스타일리스트. 만나서 반가워! 옷장을 봤는데 좋은 아이디어가 있어. 오늘은 뭘로 도와줄까?",
        "요 {name}! {stylist}야. 스타일링 도와줄 수 있어서 좋다! 오늘은 뭘 입어볼래?",
        "{name}, 반가워! {stylist}야. 함께 완벽한 코디 찾아보자. 어떤 자리야?",
        "하이 {name}! 나는 {stylist}, 패션이 내 열정이야. 같이 멋진 룩 만들어보자! 뭐 필요해?",
        "환영해 {name}! 퍼스널 스타일리스트 {stylist}야. 더 멋지게 만들어줄게. 뭘 찾아?",
      ],
      signOffs: [
        "멋있다, {name}! 파이팅!",
        "정말 잘 어울려! 즐겨!",
        "자신감이 제일 중요해! 좋은 하루!",
        "완벽해! 또 보자!",
        "굿! 좋은 하루 보내!",
        "잘 어울린다! 행운을 빌어!",
      ],
    },
  },
  Chinese: {
    'Standard Mandarin': {
      greetings: [
        "嘿{name}！我是{stylist}，你的私人造型师。认识你很高兴！我看过你的衣橱了，有不少好想法。今天有什么我能帮你的？",
        "哥们{name}！我是{stylist}。能帮你搭配太棒了！今天想做什么造型？",
        "{name}你好！我是{stylist}。一起找到完美的搭配吧。你是为什么场合准备？",
        "嗨{name}！我是{stylist}，时尚是我的热情。一起创造帅气的造型！你需要什么？",
        "欢迎{name}！我是你的私人造型师{stylist}。帮你展现最好的自己。你在找什么？",
      ],
      signOffs: [
        "你会很帅的，{name}！加油！",
        "真的很棒！好好享受！",
        "记住，自信最重要！祝你有美好的一天！",
        "完美！回头见！",
        "很帅！享受你的一天！",
        "你很有型！祝好运！",
      ],
    },
  },
  Arabic: {
    'Modern Standard Arabic': {
      greetings: [
        "أهلاً {name}! أنا {stylist}، مستشارك الشخصي للأزياء. سعيد جداً بلقائك! ألقيت نظرة على خزانة ملابسك ولدي أفكار رائعة. كيف يمكنني مساعدتك اليوم؟",
        "مرحباً {name}! أنا {stylist}. متحمس جداً لمساعدتك في إطلالتك! ماذا نصمم اليوم؟",
        "{name} أهلاً! أنا {stylist}، ولنجد معاً الإطلالة المثالية. لأي مناسبة تستعد؟",
        "يا هلا {name}! أنا {stylist}، والموضة شغفي. لنصنع معاً إطلالات مذهلة! ماذا تحتاج؟",
        "أهلاً وسهلاً {name}! أنا مستشارك للأزياء {stylist}. دعني أساعدك لتبرز أناقتك. بماذا تفكر؟",
      ],
      signOffs: [
        "ستكون رائعاً، {name}! بالتوفيق!",
        "أنت أنيق جداً! استمتع!",
        "تذكر، الثقة هي أفضل إكسسوار! يوماً سعيداً!",
        "مثالي! إلى اللقاء!",
        "ممتاز! استمتع بيومك!",
        "أنت متألق! حظاً سعيداً!",
      ],
    },
  },
  Hindi: {
    'Standard Hindi': {
      greetings: [
        "क्या हाल है {name}! मैं {stylist} हूं, तुम्हारा पर्सनल स्टाइलिस्ट। तुमसे मिलकर अच्छा लगा! मैंने तुम्हारी अलमारी देखी है और मेरे पास कमाल के आइडियाज़ हैं। आज क्या मदद कर सकता हूं?",
        "हाय {name}! मैं {stylist}। तुम्हारी स्टाइलिंग में मदद करके बहुत एक्साइटेड हूं! आज क्या स्टाइल करें?",
        "{name} भाई नमस्कार! यहां {stylist} है। चलो मिलकर परफेक्ट लुक ढूंढते हैं। किस मौके के लिए तैयार हो रहे हो?",
        "हेलो {name}! मैं {stylist}, और फैशन मेरा जुनून है। साथ मिलकर स्मार्ट आउटफिट्स बनाएंगे! क्या चाहिए तुम्हें?",
        "स्वागत है {name}! मैं तुम्हारा पर्सनल स्टाइलिस्ट {stylist} हूं। तुम्हें और स्टाइलिश बनाने में मदद करूंगा। क्या सोच रखा है?",
      ],
      signOffs: [
        "तुम कमाल लग रहे हो, {name}! बेस्ट ऑफ लक!",
        "बहुत स्मार्ट! मज़े करो!",
        "याद रखो, कॉन्फिडेंस सबसे बेस्ट एक्सेसरी है! शुभ दिन!",
        "परफेक्ट! जल्दी मिलते हैं!",
        "बढ़िया! दिन का मज़ा लो!",
        "तुम रॉक कर रहे हो! गुड लक!",
      ],
    },
  },
  Dutch: {
    'Standard Dutch': {
      greetings: [
        "Hey {name}! Ik ben {stylist}, jouw persoonlijke stylist. Leuk je te ontmoeten! Ik heb al even naar je kledingkast gekeken en heb gave ideeën. Waar kan ik je vandaag mee helpen?",
        "Yo {name}! {stylist} hier. Super vet om je te helpen met je stijl! Wat gaan we vandaag stylen?",
        "Hoi {name}! Ik ben {stylist}, en mode is mijn passie. Laten we samen de perfecte look vinden. Voor welke gelegenheid kleed je je?",
        "Dag {name}! Hier is {stylist}, je stijladviseur. Ik kan niet wachten om samen iets gafs te creëren! Wat had je in gedachten?",
        "Welkom {name}! Ik ben {stylist}, je persoonlijke stylist. Ik help je graag er goed uit te zien. Wat zoek je?",
      ],
      signOffs: [
        "Je gaat er top uitzien, {name}! Succes!",
        "Vet! Veel plezier!",
        "Onthoud, zelfvertrouwen is key! Fijne dag!",
        "Perfect! Tot snel!",
        "Gaaf! Geniet van je dag!",
        "Je ziet er strak uit! Veel succes!",
      ],
    },
  },
  Russian: {
    'Standard Russian': {
      greetings: [
        "Привет {name}! Я {stylist}, твой персональный стилист. Рад познакомиться! Я посмотрел твой гардероб и у меня есть крутые идеи. Чем могу помочь сегодня?",
        "Здорово {name}! Это {stylist}. Рад помочь тебе с образом! Что будем стилизовать сегодня?",
        "{name}, привет! Я {stylist}. Давай вместе найдём идеальный образ. Для какого случая одеваемся?",
        "Хай {name}! Я {stylist}, и мода — моя тема. Создадим вместе крутые образы! Что тебе нужно?",
        "Добро пожаловать {name}! Я твой персональный стилист {stylist}. Помогу тебе выглядеть на все сто! О чём думаешь?",
      ],
      signOffs: [
        "Ты будешь выглядеть круто, {name}! Удачи!",
        "Ты классно выглядишь! Кайфуй!",
        "Помни, уверенность — лучший аксессуар! Хорошего дня!",
        "Отлично! До скорой!",
        "Супер! Наслаждайся днём!",
        "Ты в ударе! Удачи тебе!",
      ],
    },
  },
  Swedish: {
    'Standard Swedish': {
      greetings: [
        "Tjena {name}! Jag är {stylist}, din personliga stylist. Kul att träffas! Jag har kollat på din garderob och har schyssta idéer. Vad kan jag hjälpa dig med idag?",
        "Hej {name}! {stylist} här. Fett att hjälpa dig med din stil! Vad ska vi styla idag?",
        "Hallå {name}! Jag är {stylist}, och mode är min grej. Låt oss hitta den perfekta looken tillsammans. Vilken tillfälle klär du dig för?",
        "Yo {name}! Här är {stylist}, din stilrådgivare. Jag längtar efter att skapa något snyggt tillsammans! Vad tänker du på?",
        "Välkommen {name}! Jag är {stylist}, din personliga stylist. Jag hjälper dig att se bäst ut. Vad letar du efter?",
      ],
      signOffs: [
        "Du kommer se grym ut, {name}! Lycka till!",
        "Snyggt! Ha det gött!",
        "Kom ihåg, självförtroende är key! Ha en bra dag!",
        "Perfekt! Vi ses snart!",
        "Fett! Njut av din dag!",
        "Du är snygg! Lycka till!",
      ],
    },
  },
};

export function getCulturalGreeting(
  language: string,
  accent: string,
  stylistId: string,
  userName?: string | null
): LocalizedGreeting {
  const stylist = STYLISTS[stylistId];
  const isMale = stylist?.gender === 'male';
  const stylistName = stylist?.name || (stylistId === 'max' ? 'Max' : 'Ruby');
  
  const greetingsSource = isMale ? CULTURAL_GREETINGS_MALE : CULTURAL_GREETINGS;
  const languageGreetings = greetingsSource[language]?.[accent];
  
  if (languageGreetings) {
    const randomGreeting = languageGreetings.greetings[Math.floor(Math.random() * languageGreetings.greetings.length)];
    const randomSignOff = languageGreetings.signOffs[Math.floor(Math.random() * languageGreetings.signOffs.length)];
    
    const displayName = userName || (language === 'English' ? 'there' : '');
    
    return {
      greeting: randomGreeting
        .replace(/{name}/g, displayName)
        .replace(/{stylist}/g, stylistName),
      signOff: randomSignOff
        .replace(/{name}/g, displayName)
        .replace(/{stylist}/g, stylistName),
      language,
      stylistId,
    };
  }
  
  const fallbackGreeting = stylist?.greeting[0] || "Hello! I'm your personal stylist.";
  const fallbackSignOff = stylist?.signOffs[0] || "Have a great day!";
  
  return {
    greeting: fallbackGreeting.replace(/{name}/g, userName || 'there'),
    signOff: fallbackSignOff.replace(/{name}/g, userName || 'there'),
    language,
    stylistId,
  };
}

export function getVoicePreviewScript(
  language: string,
  accent: string,
  stylistId: string
): string {
  const stylist = STYLISTS[stylistId];
  const isMale = stylist?.gender === 'male';
  const stylistName = stylist?.name || (stylistId === 'max' ? 'Max' : 'Ruby');
  
  const greetingsSource = isMale ? CULTURAL_GREETINGS_MALE : CULTURAL_GREETINGS;
  const languageGreetings = greetingsSource[language]?.[accent];
  
  if (languageGreetings) {
    const greeting = languageGreetings.greetings[0]
      .replace(/{name}/g, '')
      .replace(/{stylist}/g, stylistName)
      .replace(/\s+/g, ' ')
      .trim();
    return greeting;
  }
  
  if (language === 'English') {
    return isMale 
      ? `Hey! I'm ${stylistName}, your personal stylist. I'm genuinely glad you're here. Let's make you look amazing.`
      : `Hello! I'm ${stylistName}, your personal stylist. I'm delighted to meet you. Let's create something beautiful together.`;
  }
  
  return stylist?.greeting[0]?.replace(/{name}/g, '') || "Hello! I'm your personal stylist.";
}

export async function generateLocalizedGreetingWithAI(
  language: string,
  region: string,
  stylistId: string,
  stylistGender: 'male' | 'female',
  context?: string
): Promise<string | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/localize-greeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        region,
        stylistId,
        stylistGender,
        context: context || 'voice_preview',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.greeting;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to generate localized greeting:', error);
    return null;
  }
}

export default {
  getCulturalGreeting,
  getVoicePreviewScript,
  generateLocalizedGreetingWithAI,
};
