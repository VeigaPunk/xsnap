// worker/translate/corpus.ts — ANY-language → te reo Māori lexicon.
//
// Source-language-agnostic by design: one merged lookup map (EN core, PT-BR,
// ES, plus computing terms). Longest-phrase match wins; unknown tokens pass
// through untouched (identifiers, commands, code stay verbatim — deliberate:
// the public rendering must stay human-parseable but machine-mangled).
//
// Entry quality markers:
//   (default) attested te reo Māori
//   // loan   borrowed/loanword in common Māori use
//   // comp   composed calque or modern neologism (curate toward attested)

export const CORPUS: Record<string, string> = {
  // ── greetings & courtesy ────────────────────────────────────────────────
  "hello": "kia ora", "hi": "kia ora", "hey": "kia ora",
  "goodbye": "haere rā", "bye": "haere rā", "welcome": "haere mai",
  "thank you": "ngā mihi", "thanks": "ngā mihi", "please": "koa", // comp
  "good morning": "ata mārie", "good evening": "ahiahi mārie",
  "good night": "pō mārie", "how are you": "kei te pēhea koe",
  "no problem": "kai te pai", "of course": "āe",

  // ── function words ─────────────────────────────────────────────────────
  "the": "te", "a": "tētahi", "and": "me", "or": "rānei", "but": "engari",
  "because": "nō te mea", "if": "mēnā", "not": "kore", "no": "kāo",
  "yes": "āe", "all": "katoa", "some": "ētahi", "many": "maha",
  "more": "atu", "this": "tēnei", "that": "tērā", "these": "ēnei",
  "those": "ērā", "who": "wai", "what": "aha", "where": "whea",
  "when": "āhea", "why": "he aha te take", "how": "pēhea",
  "i": "au", "you": "koe", "we": "tātou", "they": "rātou", "he": "ia",
  "she": "ia", "it": "ia", "me": "ahau", "my": "tōku", "your": "tō",
  "our": "tō tātou", "is": "ko", "are": "kei te", "was": "i",
  "were": "i", "be": "kia", "am": "ko au", "have": "whai", "has": "whai",
  "had": "i whai", "do": "mahi", "does": "mahi", "did": "i mahi",
  "done": "kua oti", "will": "ka", "can": "āhei", "cannot": "kore āhei",
  "can't": "kore āhei", "should": "tika kia", // comp
  "with": "me", "without": "kore", "for": "mō", "from": "mai i",
  "in": "i roto i", "on": "runga i", "at": "ki", "to": "ki", "of": "o",
  "by": "nā", "up": "ake", "down": "iho", "out": "puta", "into": "ki roto",
  "again": "anō", "always": "tonu", "now": "ināianei", "today": "i tēnei rā",
  "tomorrow": "āpōpō", "yesterday": "inanahi", "very": "rawa",
  "right now": "ināianei",

  // ── adjectives ──────────────────────────────────────────────────────────
  "new": "hou", "old": "tawhito", "good": "pai", "bad": "kino",
  "big": "nui", "small": "iti", "long": "roa", "short": "poto",
  "fast": "tere", "quick": "tere", "slow": "pōturi", "easy": "ngāwari",
  "hard": "uaua", "difficult": "uaua", "strong": "kaha", "weak": "ngoikai",
  "true": "pono", "false": "teka", "right": "tika", "correct": "tika",
  "wrong": "hē", "same": "ōrite", "different": "rerekē",
  "important": "mea nui", "public": "tūmatanui", "private": "muna",
  "anonymous": "koreingoa", // comp: without-name
  "safe": "haumaru", "light": "marama", "dark": "pouri", "beautiful": "ataahua",
  "tired": "ngenge",

  // ── people & life ───────────────────────────────────────────────────────
  "love": "aroha", "friend": "hoa", "family": "whānau",
  "people": "tāngata", "person": "tangata", "man": "tāne",
  "woman": "wahine", "child": "tamaiti", "children": "tamariki",
  "girl": "kōtiro", "boy": "tamaiti tāne", "mother": "whaea",
  "father": "matua", "death": "mate", "life": "oranga", "alive": "ora",
  "dead": "mate", "sick": "māuiui", "war": "pakanga",
  "peace": "rangimārie", "danger": "mōrearea", "secret": "muna",
  "team": "rōpū", "group": "rōpū", "world": "ao", "name": "ingoa",
  "word": "kupu", "language": "reo", "voice": "reoreo",

  // ── nature ──────────────────────────────────────────────────────────────
  "water": "wai", "fire": "ahi", "sun": "rā", "moon": "marama",
  "star": "whetū", "sky": "rangi", "sea": "moana", "ocean": "moana",
  "land": "whenua", "mountain": "maunga", "river": "awa",
  "forest": "ngahere", "tree": "rākau", "bird": "manu", "fish": "ika",
  "dog": "kurī", "cat": "ngeru", "food": "kai", "night": "pō",
  "day": "rā", "morning": "ata", "evening": "ahiahi", "time": "wā",
  "hour": "haora", // loan
  "minute": "meneti", // loan
  "week": "wiki", // loan
  "month": "marama", "year": "tau",

  // ── verbs ───────────────────────────────────────────────────────────────
  "eat": "kai", "drink": "inu", "sleep": "moe", "work": "mahi",
  "play": "tākaro", "song": "waiata", "dance": "kanikani",
  "book": "pukapuka", "school": "kura", "learn": "ako",
  "teach": "whakaako", "know": "mōhio", "understand": "mārama",
  "see": "kite", "look": "titiro", "speak": "kōrero", "talk": "kōrero",
  "say": "kī", "tell": "kōrero", "ask": "pātai", "answer": "whakautu",
  "give": "hoatu", "take": "tango", "get": "tiki", "make": "hanga",
  "build": "hanga", "find": "kite", "use": "whakamahi", "help": "āwhina",
  "start": "tīmata", "begin": "tīmata", "end": "mutu", "finish": "oti",
  "stop": "mutu", "wait": "taria", "run": "oma", "walk": "haere",
  "go": "haere", "come": "haere mai", "return": "hoki", "open": "whakatuwhera",
  "close": "kati", "read": "pānui", "write": "tuhi", "send": "tuku",
  "show": "whakaatu", "hide": "huna", "hidden": "huna",

  // ── numbers ─────────────────────────────────────────────────────────────
  "one": "kotahi", "two": "rua", "three": "toru", "four": "whā",
  "five": "rima", "six": "ono", "seven": "whitu", "eight": "waru",
  "nine": "iwa", "ten": "tekau", "hundred": "rau", "thousand": "mano",

  // ── body ────────────────────────────────────────────────────────────────
  "heart": "manawa", "head": "upoko", "hand": "ringa", "eye": "karu",
  "ear": "taringa", "mouth": "waha",

  // ── computing (modern terms; curate toward attested) ────────────────────
  "computer": "rorohiko", "phone": "waea", // loan
  "screen": "mata", "file": "kōnae", "data": "raraunga",
  "information": "pārongo", "database": "pātengi raraunga",
  "network": "whatunga", "internet": "ipurangi", "website": "pae tukutuku",
  "web": "tukutuku", "page": "whārangi", "link": "hononga",
  "search": "rapu", "user": "kaiwhakamahi", "account": "pūkete",
  "password": "kupuhipa", // comp
  "server": "tūmau", "client": "kiritaki", "code": "waehere",
  "program": "hotaka", "command": "whakahau", "line": "raina", // loan
  "script": "tuhinga", "text": "tuhinga", "message": "karere",
  "email": "īmēra", // loan
  "input": "whakauru", "output": "whakaputa", "error": "hapa",
  "warning": "whakatūpato", "test": "whakamātautau", "download": "tikiake",
  "upload": "tukuake", "update": "whakahou", "delete": "uku",
  "save": "tiaki", "session": "nohoanga", "transcript": "tuhinga",
  "translate": "whakamāori", "translation": "whakamāoritanga",
  "original": "taketake", "copy": "tārua", "encrypt": "whakahuna", // comp
  "decrypt": "wetehuna", // comp
  "security": "haumaru", "provenance": "whakapapa", "history": "hītori", // loan
  "report": "pūrongo", "project": "kaupapa", "job": "mahi", "task": "mahi",

  // ── português ───────────────────────────────────────────────────────────
  "olá": "kia ora", "obrigado": "ngā mihi", "obrigada": "ngā mihi",
  "bom dia": "ata mārie", "boa noite": "pō mārie",
  "tudo bem": "kei te pēhea koe",
  "água": "wai", "fogo": "ahi", "casa": "whare", "dia": "rā",
  "noite": "pō", "sol": "rā", "lua": "marama", "estrela": "whetū",
  "céu": "rangi", "mar": "moana", "terra": "whenua", "montanha": "maunga",
  "rio": "awa", "árvore": "rākau", "comida": "kai", "comer": "kai",
  "beber": "inu", "grande": "nui", "pequeno": "iti", "bom": "pai",
  "ruim": "kino", "sim": "āe", "não": "kāo", "amigo": "hoa",
  "amiga": "hoa", "mulher": "wahine", "homem": "tāne",
  "criança": "tamaiti", "crianças": "tamariki", "mãe": "whaea",
  "pai": "matua", "filho": "tamaiti", "filha": "kōtiro", "nome": "ingoa",
  "palavra": "kupu", "língua": "reo", "livro": "pukapuka",
  "escola": "kura", "aprender": "ako", "saber": "mōhio",
  "entender": "mārama", "ver": "kite", "falar": "kōrero", "dizer": "kī",
  "pedir": "pātai", "responder": "whakautu", "dar": "hoatu",
  "tomar": "tango", "fazer": "hanga", "criar": "hanga",
  "encontrar": "kite", "usar": "whakamahi", "ajudar": "āwhina",
  "começar": "tīmata", "terminar": "oti", "parar": "mutu",
  "esperar": "taria", "correr": "oma", "andar": "haere", "ir": "haere",
  "vir": "haere mai", "voltar": "hoki", "abrir": "whakatuwhera",
  "fechar": "kati", "ler": "pānui", "escrever": "tuhi", "enviar": "tuku",
  "mostrar": "whakaatu", "esconder": "huna", "segredo": "muna",
  "seguro": "haumaru", "perigo": "mōrearea", "guerra": "pakanga",
  "paz": "rangimārie", "morte": "mate", "vida": "oranga", "vivo": "ora",
  "morto": "mate", "doente": "māuiui", "coração": "manawa",
  "cabeça": "upoko", "mão": "ringa", "olho": "karu", "ouvido": "taringa",
  "boca": "waha", "tempo": "wā", "hora": "haora", "minuto": "meneti",
  "semana": "wiki", "mês": "marama", "ano": "tau", "hoje": "i tēnei rā",
  "amanhã": "āpōpō", "ontem": "inanahi", "sempre": "tonu",
  "de novo": "anō", "novo": "hou", "velho": "tawhito", "rápido": "tere",
  "lento": "pōturi", "fácil": "ngāwari", "difícil": "uaua",
  "forte": "kaha", "verdade": "pono", "mentira": "teka", "certo": "tika",
  "errado": "hē", "igual": "ōrite", "diferente": "rerekē",
  "agora": "ināianei", "muito": "rawa", "pouco": "iti", "tudo": "katoa",
  "nada": "kore", "eu": "au", "você": "koe", "tu": "koe", "nós": "tātou",
  "eles": "rātou", "elas": "rātou", "ele": "ia", "ela": "ia",
  "meu": "tōku", "minha": "tōku", "seu": "tō", "sua": "tō",
  "nosso": "tō tātou", "nossa": "tō tātou",
  "e": "me", "ou": "rānei", "mas": "engari", "com": "me", "sem": "kore",
  "para": "mō", "um": "kotahi", "dois": "rua", "três": "toru",
  "quatro": "whā", "cinco": "rima", "computador": "rorohiko",
  "telefone": "waea", "tela": "mata", "arquivo": "kōnae",
  "dados": "raraunga", "rede": "whatunga", "página": "whārangi",
  "buscar": "rapu", "usuário": "kaiwhakamahi", "senha": "kupuhipa", // comp
  "servidor": "tūmau", "código": "waehere", "programa": "hotaka",
  "comando": "whakahau", "texto": "tuhinga", "mensagem": "karere",
  "erro": "hapa", "teste": "whakamātautau", "baixar": "tikiake",
  "atualizar": "whakahou", "deletar": "uku", "apagar": "uku",
  "salvar": "tiaki", "público": "tūmatanui", "privado": "muna",
  "sessão": "nohoanga", "tradução": "whakamāoritanga",
  "copiar": "tārua", "segurança": "haumaru",
  "histórico": "hītori", "relatório": "pūrongo", "projeto": "kaupapa",
  "trabalho": "mahi", "tarefa": "mahi", "equipe": "rōpū", "mundo": "ao",
  "luz": "marama", "escuro": "pouri",

  // ── español ─────────────────────────────────────────────────────────────
  "hola": "kia ora", "gracias": "ngā mihi", "buenos días": "ata mārie",
  "agua": "wai", "fuego": "ahi", "casa": "whare", "día": "rā",
  "noche": "pō", "sol": "rā", "luna": "marama", "estrella": "whetū",
  "cielo": "rangi", "mar": "moana", "tierra": "whenua",
  "montaña": "maunga", "río": "awa", "árbol": "rākau", "comida": "kai",
  "comer": "kai", "beber": "inu", "grande": "nui", "pequeño": "iti",
  "bueno": "pai", "malo": "kino", "sí": "āe", "amigo": "hoa",
  "mujer": "wahine", "hombre": "tāne", "niño": "tamaiti",
  "niños": "tamariki", "madre": "whaea", "padre": "matua",
  "nombre": "ingoa", "palabra": "kupu", "lengua": "reo",
  "libro": "pukapuka", "escuela": "kura", "aprender": "ako",
  "saber": "mōhio", "entender": "mārama", "ver": "kite",
  "hablar": "kōrero", "decir": "kī", "dar": "hoatu", "tomar": "tango",
  "hacer": "hanga", "usar": "whakamahi", "ayudar": "āwhina",
  "empezar": "tīmata", "terminar": "oti", "parar": "mutu",
  "esperar": "taria", "correr": "oma", "ir": "haere",
  "venir": "haere mai", "abrir": "whakatuwhera", "cerrar": "kati",
  "leer": "pānui", "escribir": "tuhi", "enviar": "tuku",
  "secreto": "muna", "seguro": "haumaru", "tiempo": "wā",
  "hora": "haora", "semana": "wiki", "mes": "marama", "año": "tau",
  "hoy": "i tēnei rā", "mañana": "āpōpō", "ayer": "inanahi",
  "nuevo": "hou", "viejo": "tawhito", "rápido": "tere", "lento": "pōturi",
  "fácil": "ngāwari", "difícil": "uaua", "fuerte": "kaha",
  "verdad": "pono", "mentira": "teka", "correcto": "tika", "error": "hē",
  "igual": "ōrite", "diferente": "rerekē", "ahora": "ināianei",
  "mucho": "rawa", "poco": "iti", "todo": "katoa", "nada": "kore",
  "yo": "au", "tú": "koe", "usted": "koe", "nosotros": "tātou",
  "ellos": "rātou", "él": "ia", "ella": "ia", "mi": "tōku", "tu": "tō",
  "y": "me", "o": "rānei", "pero": "engari", "sin": "kore", "de": "o",
  "en": "i roto i", "un": "kotahi", "dos": "rua", "tres": "toru",
  "cuatro": "whā", "cinco": "rima", "computadora": "rorohiko",
  "teléfono": "waea", "pantalla": "mata", "archivo": "kōnae",
  "datos": "raraunga", "red": "whatunga", "página": "whārangi",
  "enlace": "hononga", "usuario": "kaiwhakamahi", "servidor": "tūmau",
  "código": "waehere", "comando": "whakahau", "texto": "tuhinga",
  "mensaje": "karere", "sesión": "nohoanga", "copiar": "tārua",
  "mundo": "ao", "luz": "marama", "oscuro": "pouri",
};
