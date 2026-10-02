'use strict';
// cli/translate.js — the LOCAL two-hop renderer: ANY → suomi → mi.
//
// Per operator spec the hops run on the CLIENT, never on the server: the
// AI session (plugin flow) translates by itself; this deterministic corpus
// renderer is the bare-CLI fallback when no AI is in the loop. Hop 1 emits
// a controlled suomi vocabulary; hop 2 maps exactly that vocabulary onward
// (keep the two corpora in lockstep when adding entries).

const MAX_PHRASE = 4;
const TOKEN_RE = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

function matchCase(src, out) {
  if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) {
    return out.split(' ')
      .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  return out;
}

function substitute(text, corpus) {
  const out = [];
  let last = 0;
  const toks = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index > last) toks.push({ word: false, s: text.slice(last, m.index) });
    toks.push({ word: true, s: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) toks.push({ word: false, s: text.slice(last) });
  let i = 0;
  while (i < toks.length) {
    if (!toks[i].word) { out.push(toks[i].s); i++; continue; }
    let replaced = false;
    const nMax = Math.min(MAX_PHRASE,
      1 + Math.floor((toks.length - 1 - i) / 2));
    for (let n = nMax; n >= 1 && !replaced; n--) {
      let phrase = toks[i].s;
      let ok = true;
      for (let k = 1; k < n; k++) {
        const sep = toks[i + 2 * k - 1];
        const w = toks[i + 2 * k];
        if (!sep || sep.word || sep.s !== ' ' || !w || !w.word) { ok = false; break; }
        phrase += ' ' + w.s;
      }
      if (!ok) continue;
      const hit = corpus[phrase.toLowerCase()];
      if (hit !== undefined) {
        out.push(matchCase(phrase, hit));
        i += 2 * n - 1;
        replaced = true;
      }
    }
    if (!replaced) { out.push(toks[i].s); i++; }
  }
  return out.join('');
}

// ── HOP 1: ANY → suomi (EN/PT/ES merged; never assume English input) ──────
const CORPUS_FI = {
  'hello': 'terve', 'hi': 'hei', 'hey': 'hei', 'olá': 'terve',
  'hola': 'terve', 'goodbye': 'näkemiin', 'bye': 'näkemiin',
  'welcome': 'tervetuloa', 'thank you': 'kiitos', 'thanks': 'kiitos',
  'obrigado': 'kiitos', 'obrigada': 'kiitos', 'gracias': 'kiitos',
  'please': 'ole hyvä', 'good morning': 'hyvää huomenta',
  'bom dia': 'hyvää huomenta', 'buenos días': 'hyvää huomenta',
  'good evening': 'hyvää iltaa', 'good night': 'hyvää yötä',
  'boa noite': 'hyvää yötä', 'how are you': 'miten menee',
  'tudo bem': 'miten menee', 'no problem': 'ei ongelmaa',
  'of course': 'tietenkin', 'right now': 'juuri nyt',
  'the': 'se', 'a': 'eräs', 'and': 'ja', 'e': 'ja', 'y': 'ja',
  'or': 'tai', 'ou': 'tai', 'o': 'tai', 'but': 'mutta', 'mas': 'mutta',
  'pero': 'mutta', 'because': 'koska', 'if': 'jos', 'not': 'ei',
  'no': 'ei', 'não': 'ei', 'sim': 'kyllä', 'sí': 'kyllä', 'yes': 'kyllä',
  'all': 'kaikki', 'tudo': 'kaikki', 'todo': 'kaikki', 'some': 'jotkut',
  'many': 'monet', 'more': 'lisää', 'this': 'tämä', 'that': 'tuo',
  'these': 'nämä', 'those': 'nuo', 'who': 'kuka', 'what': 'mikä',
  'where': 'missä', 'when': 'milloin', 'why': 'miksi', 'how': 'miten',
  'i': 'minä', 'eu': 'minä', 'yo': 'minä', 'you': 'sinä', 'você': 'sinä',
  'tu': 'sinä', 'tú': 'sinä', 'usted': 'sinä', 'we': 'me', 'nós': 'me',
  'nosotros': 'me', 'they': 'he', 'eles': 'he', 'elas': 'he',
  'he': 'hän', 'she': 'hän', 'él': 'hän', 'ela': 'hän', 'ele': 'hän',
  'it': 'se', 'me': 'minä', 'my': 'minun', 'meu': 'minun',
  'minha': 'minun', 'mi': 'minun', 'your': 'sinun', 'seu': 'sinun',
  'sua': 'sinun', 'our': 'meidän', 'nosso': 'meidän', 'nossa': 'meidän',
  'is': 'on', 'are': 'ovat', 'was': 'oli', 'were': 'olivat',
  'be': 'olla', 'am': 'olen', 'have': 'olla', 'has': 'olla',
  'had': 'oli', 'do': 'tehdä', 'does': 'tehdä', 'did': 'teki',
  'done': 'tehty', 'will': 'tulee', 'can': 'voi', 'cannot': 'ei voi',
  "can't": 'ei voi', 'should': 'pitäisi', 'with': 'kanssa',
  'com': 'kanssa', 'without': 'ilman', 'sem': 'ilman', 'sin': 'ilman',
  'for': 'varten', 'para': 'varten', 'from': 'alkaen', 'in': 'sisällä',
  'en': 'sisällä', 'on': 'päällä', 'at': 'luona', 'to': 'lähelle',
  'of': 'omistus', 'de': 'omistus', 'by': 'kautta', 'up': 'ylös',
  'down': 'alas', 'out': 'ulos', 'into': 'sisään', 'again': 'taas',
  'de novo': 'taas', 'always': 'aina', 'sempre': 'aina', 'now': 'nyt',
  'agora': 'nyt', 'ahora': 'nyt', 'today': 'tänään', 'hoje': 'tänään',
  'hoy': 'tänään', 'tomorrow': 'huomenna', 'amanhã': 'huomenna',
  'mañana': 'huomenna', 'yesterday': 'eilen', 'ontem': 'eilen',
  'ayer': 'eilen', 'very': 'hyvin', 'muito': 'paljon', 'mucho': 'paljon',
  'pouco': 'vähän', 'poco': 'vähän', 'nada': 'ei mitään',
  'new': 'uusi', 'novo': 'uusi', 'nuevo': 'uusi', 'old': 'vanha',
  'velho': 'vanha', 'viejo': 'vanha', 'good': 'hyvä', 'bom': 'hyvä',
  'bueno': 'hyvä', 'bad': 'huono', 'ruim': 'huono', 'malo': 'huono',
  'big': 'iso', 'grande': 'iso', 'small': 'pieni', 'pequeno': 'pieni',
  'long': 'pitkä', 'short': 'lyhyt', 'fast': 'nopea', 'quick': 'nopea',
  'rápido': 'nopea', 'slow': 'hidas', 'lento': 'hidas', 'easy': 'helppo',
  'fácil': 'helppo', 'hard': 'vaikea', 'difficult': 'vaikea',
  'difícil': 'vaikea', 'strong': 'vahva', 'forte': 'vahva',
  'weak': 'heikko', 'true': 'tosi', 'verdade': 'tosi', 'verdad': 'tosi',
  'false': 'epätosi', 'mentira': 'valhe', 'right': 'oikea',
  'correct': 'oikea', 'certo': 'oikea', 'correcto': 'oikea',
  'wrong': 'väärä', 'errado': 'väärä', 'same': 'sama', 'igual': 'sama',
  'different': 'erilainen', 'diferente': 'erilainen',
  'important': 'tärkeä', 'public': 'julkinen', 'público': 'julkinen',
  'private': 'yksityinen', 'privado': 'yksityinen',
  'anonymous': 'anonyymi', 'safe': 'turvallinen', 'seguro': 'turvallinen',
  'light': 'valo', 'luz': 'valo', 'dark': 'pimeä', 'escuro': 'pimeä',
  'beautiful': 'kaunis', 'tired': 'väsynyt',
  'love': 'rakkaus', 'friend': 'ystävä', 'amigo': 'ystävä',
  'amiga': 'ystävä', 'family': 'perhe', 'people': 'ihmiset',
  'person': 'ihminen', 'man': 'mies', 'homem': 'mies', 'woman': 'nainen',
  'mulher': 'nainen', 'child': 'lapsi', 'criança': 'lapsi',
  'niño': 'lapsi', 'children': 'lapset', 'crianças': 'lapset',
  'niños': 'lapset', 'girl': 'tyttö', 'filha': 'tyttö', 'boy': 'poika',
  'filho': 'poika', 'mother': 'äiti', 'mãe': 'äiti', 'madre': 'äiti',
  'father': 'isä', 'pai': 'isä', 'padre': 'isä', 'death': 'kuolema',
  'morte': 'kuolema', 'life': 'elämä', 'vida': 'elämä',
  'alive': 'elävä', 'vivo': 'elävä', 'dead': 'kuollut',
  'morto': 'kuollut', 'sick': 'sairas', 'doente': 'sairas',
  'war': 'sota', 'guerra': 'sota', 'peace': 'rauha', 'paz': 'rauha',
  'danger': 'vaara', 'perigo': 'vaara', 'secret': 'salaisuus',
  'segredo': 'salaisuus', 'secreto': 'salaisuus', 'team': 'tiimi',
  'equipe': 'tiimi', 'group': 'ryhmä', 'world': 'maailma',
  'mundo': 'maailma', 'name': 'nimi', 'nome': 'nimi',
  'nombre': 'nimi', 'word': 'sana', 'palavra': 'sana',
  'language': 'kieli', 'língua': 'kieli', 'lengua': 'kieli',
  'voice': 'ääni',
  'water': 'vesi', 'água': 'vesi', 'agua': 'vesi', 'fire': 'tuli',
  'fogo': 'tuli', 'fuego': 'tuli', 'sun': 'aurinko', 'sol': 'aurinko',
  'moon': 'kuu', 'lua': 'kuu', 'luna': 'kuu', 'star': 'tähti',
  'estrela': 'tähti', 'estrella': 'tähti', 'sky': 'taivas',
  'céu': 'taivas', 'cielo': 'taivas', 'sea': 'meri', 'mar': 'meri',
  'ocean': 'valtameri', 'land': 'maa', 'terra': 'maa',
  'tierra': 'maa', 'mountain': 'vuori', 'montanha': 'vuori',
  'montaña': 'vuori', 'river': 'joki', 'rio': 'joki',
  'forest': 'metsä', 'tree': 'puu', 'árvore': 'puu', 'árbol': 'puu',
  'bird': 'lintu', 'fish': 'kala', 'peixe': 'kala', 'dog': 'koira',
  'cachorro': 'koira', 'cat': 'kissa', 'gato': 'kissa',
  'food': 'ruoka', 'comida': 'ruoka', 'night': 'yö', 'noite': 'yö',
  'noche': 'yö', 'day': 'päivä', 'dia': 'päivä', 'día': 'päivä',
  'morning': 'aamu', 'evening': 'ilta', 'time': 'aika',
  'tempo': 'aika', 'tiempo': 'aika', 'hour': 'tunti', 'hora': 'tunti',
  'minute': 'minuutti', 'minuto': 'minuutti', 'week': 'viikko',
  'semana': 'viikko', 'month': 'kuukausi', 'mês': 'kuukausi',
  'mes': 'kuukausi', 'year': 'vuosi', 'ano': 'vuosi', 'año': 'vuosi',
  'eat': 'syödä', 'comer': 'syödä', 'drink': 'juoda', 'beber': 'juoda',
  'sleep': 'nukkua', 'work': 'työ', 'trabalho': 'työ',
  'play': 'pelata', 'song': 'laulu', 'dance': 'tanssi',
  'book': 'kirja', 'livro': 'kirja', 'libro': 'kirja',
  'school': 'koulu', 'escola': 'koulu', 'escuela': 'koulu',
  'learn': 'oppia', 'aprender': 'oppia', 'teach': 'opettaa',
  'know': 'tietää', 'saber': 'tietää', 'understand': 'ymmärtää',
  'entender': 'ymmärtää', 'see': 'nähdä', 'ver': 'nähdä',
  'look': 'katsoa', 'speak': 'puhua', 'talk': 'puhua',
  'falar': 'puhua', 'hablar': 'puhua', 'say': 'sanoa', 'dizer': 'sanoa',
  'decir': 'sanoa', 'tell': 'kertoa', 'ask': 'kysyä', 'pedir': 'kysyä',
  'answer': 'vastata', 'responder': 'vastata', 'give': 'antaa',
  'dar': 'antaa', 'take': 'ottaa', 'tomar': 'ottaa', 'get': 'saada',
  'make': 'tehdä', 'fazer': 'tehdä', 'hacer': 'tehdä',
  'build': 'rakentaa', 'find': 'löytää', 'encontrar': 'löytää',
  'use': 'käyttää', 'usar': 'käyttää', 'help': 'auttaa',
  'ajudar': 'auttaa', 'ayudar': 'auttaa', 'start': 'aloittaa',
  'começar': 'aloittaa', 'empezar': 'aloittaa', 'begin': 'alkaa',
  'end': 'loppu', 'finish': 'valmis', 'terminar': 'lopettaa',
  'stop': 'pysäyttää', 'parar': 'pysäyttää', 'wait': 'odottaa',
  'esperar': 'odottaa', 'run': 'juosta', 'correr': 'juosta',
  'walk': 'kävellä', 'andar': 'kävellä', 'go': 'mennä', 'ir': 'mennä',
  'come': 'tulla', 'vir': 'tulla', 'venir': 'tulla',
  'return': 'palata', 'voltar': 'palata', 'open': 'avata',
  'abrir': 'avata', 'close': 'sulkea', 'fechar': 'sulkea',
  'cerrar': 'sulkea', 'read': 'lukea', 'ler': 'lukea',
  'leer': 'lukea', 'write': 'kirjoittaa', 'escrever': 'kirjoittaa',
  'escribir': 'kirjoittaa', 'send': 'lähettää', 'enviar': 'lähettää',
  'show': 'näyttää', 'mostrar': 'näyttää', 'hide': 'piilottaa',
  'esconder': 'piilottaa', 'create': 'luoda', 'criar': 'luoda',
  'one': 'yksi', 'um': 'yksi', 'un': 'yksi', 'two': 'kaksi',
  'dois': 'kaksi', 'dos': 'kaksi', 'three': 'kolme', 'três': 'kolme',
  'tres': 'kolme', 'four': 'neljä', 'quatro': 'neljä', 'five': 'viisi',
  'cinco': 'viisi', 'six': 'kuusi', 'seven': 'seitsemän',
  'eight': 'kahdeksan', 'nine': 'yhdeksän', 'ten': 'kymmenen',
  'hundred': 'sata', 'thousand': 'tuhat', 'heart': 'sydän',
  'coração': 'sydän', 'head': 'pää', 'cabeça': 'pää', 'hand': 'käsi',
  'mão': 'käsi', 'eye': 'silmä', 'olho': 'silmä', 'ear': 'korva',
  'ouvido': 'korva', 'mouth': 'suu', 'boca': 'suu',
  'computer': 'tietokone', 'computador': 'tietokone',
  'computadora': 'tietokone', 'phone': 'puhelin', 'telefone': 'puhelin',
  'teléfono': 'puhelin', 'screen': 'näyttö', 'tela': 'näyttö',
  'pantalla': 'näyttö', 'file': 'tiedosto', 'arquivo': 'tiedosto',
  'archivo': 'tiedosto', 'data': 'data', 'dados': 'data',
  'information': 'tieto', 'database': 'tietokanta', 'network': 'verkko',
  'rede': 'verkko', 'red': 'verkko', 'internet': 'internet',
  'website': 'verkkosivusto', 'web': 'verkko', 'page': 'sivu',
  'página': 'sivu', 'link': 'linkki', 'enlace': 'linkki',
  'search': 'etsiä', 'buscar': 'etsiä', 'user': 'käyttäjä',
  'usuário': 'käyttäjä', 'usuario': 'käyttäjä', 'account': 'tili',
  'password': 'salasana', 'senha': 'salasana', 'server': 'palvelin',
  'servidor': 'palvelin', 'client': 'asiakas', 'code': 'koodi',
  'código': 'koodi', 'program': 'ohjelma', 'programa': 'ohjelma',
  'command': 'komento', 'comando': 'komento', 'line': 'rivi',
  'script': 'komentosarja', 'text': 'teksti', 'texto': 'teksti',
  'message': 'viesti', 'mensagem': 'viesti', 'mensaje': 'viesti',
  'email': 'sähköposti', 'input': 'syöte', 'output': 'tuloste',
  'error': 'virhe', 'erro': 'virhe', 'warning': 'varoitus',
  'test': 'testi', 'teste': 'testi', 'download': 'ladata',
  'baixar': 'ladata', 'upload': 'lähettää', 'update': 'päivitys',
  'atualizar': 'päivittää', 'delete': 'poistaa', 'deletar': 'poistaa',
  'apagar': 'poistaa', 'save': 'tallentaa', 'salvar': 'tallentaa',
  'session': 'istunto', 'sessão': 'istunto', 'sesión': 'istunto',
  'transcript': 'transkriptio', 'translate': 'kääntää',
  'translation': 'käännös', 'tradução': 'käännös',
  'traducción': 'käännös', 'original': 'alkuperäinen', 'copy': 'kopio',
  'copiar': 'kopioida', 'encrypt': 'salata', 'decrypt': 'purkaa',
  'security': 'turvallisuus', 'segurança': 'turvallisuus',
  'provenance': 'alkuperä', 'history': 'historia',
  'histórico': 'historia', 'report': 'raportti', 'relatório': 'raportti',
  'reporte': 'raportti', 'project': 'projekti', 'projeto': 'projekti',
  'proyecto': 'projekti', 'job': 'työ', 'task': 'tehtävä',
  'tarefa': 'tehtävä', 'music': 'musiikki', 'city': 'kaupunki',
  'road': 'tie', 'door': 'ovi', 'house': 'talo', 'casa': 'talo',
  'home': 'koti', 'money': 'raha', 'free': 'ilmainen',
};

// ── HOP 2: suomi → te reo Māori (keys = hop-1 vocabulary, phrase-complete) ─
const CORPUS_MI = {
  'terve': 'kia ora', 'hei': 'kia ora', 'näkemiin': 'haere rā',
  'tervetuloa': 'haere mai', 'kiitos': 'ngā mihi', 'ole hyvä': 'koa',
  'hyvää huomenta': 'ata mārie', 'hyvää iltaa': 'ahiahi mārie',
  'hyvää yötä': 'pō mārie', 'miten menee': 'kei te pēhea koe',
  'ei ongelmaa': 'kai te pai', 'tietenkin': 'āe', 'juuri nyt': 'ināianei',
  'se': 'ia', 'eräs': 'tētahi', 'ja': 'me', 'tai': 'rānei',
  'mutta': 'engari', 'koska': 'nō te mea', 'jos': 'mēnā', 'ei': 'kāo',
  'kyllä': 'āe', 'kaikki': 'katoa', 'jotkut': 'ētahi', 'monet': 'maha',
  'lisää': 'atu', 'tämä': 'tēnei', 'tuo': 'tērā', 'nämä': 'ēnei',
  'nuo': 'ērā', 'kuka': 'wai', 'mikä': 'aha', 'missä': 'whea',
  'milloin': 'āhea', 'miksi': 'he aha te take', 'miten': 'pēhea',
  'minä': 'au', 'sinä': 'koe', 'me': 'tātou', 'he': 'rātou',
  'hän': 'ia', 'minun': 'tōku', 'sinun': 'tō', 'meidän': 'tō tātou',
  'on': 'ko', 'ovat': 'kei te', 'oli': 'i', 'olivat': 'i',
  'olla': 'kia', 'olen': 'ko au', 'tehdä': 'hanga', 'teki': 'i mahi',
  'tehty': 'kua oti', 'tulee': 'ka', 'voi': 'āhei',
  'ei voi': 'kore āhei', 'pitäisi': 'tika kia', 'kanssa': 'me',
  'ilman': 'kore', 'varten': 'mō', 'alkaen': 'mai i',
  'sisällä': 'i roto i', 'päällä': 'runga i', 'luona': 'ki',
  'lähelle': 'ki', 'omistus': 'o', 'kautta': 'mā', 'ylös': 'ake',
  'alas': 'iho', 'ulos': 'puta', 'sisään': 'ki roto', 'taas': 'anō',
  'aina': 'tonu', 'nyt': 'ināianei', 'tänään': 'i tēnei rā',
  'huomenna': 'āpōpō', 'eilen': 'inanahi', 'hyvin': 'rawa',
  'paljon': 'rawa', 'vähän': 'iti', 'ei mitään': 'kore',
  'uusi': 'hou', 'vanha': 'tawhito', 'hyvä': 'pai', 'huono': 'kino',
  'iso': 'nui', 'pieni': 'iti', 'pitkä': 'roa', 'lyhyt': 'poto',
  'nopea': 'tere', 'hidas': 'pōturi', 'helppo': 'ngāwari',
  'vaikea': 'uaua', 'vahva': 'kaha', 'heikko': 'ngoikai',
  'tosi': 'pono', 'epätosi': 'teka', 'valhe': 'teka', 'oikea': 'tika',
  'väärä': 'hē', 'sama': 'ōrite', 'erilainen': 'rerekē',
  'tärkeä': 'mea nui', 'julkinen': 'tūmatanui', 'yksityinen': 'muna',
  'anonyymi': 'koreingoa', 'turvallinen': 'haumaru',
  'valo': 'marama', 'pimeä': 'pouri', 'kaunis': 'ataahua',
  'väsynyt': 'ngenge',
  'rakkaus': 'aroha', 'ystävä': 'hoa', 'perhe': 'whānau',
  'ihmiset': 'tāngata', 'ihminen': 'tangata', 'mies': 'tāne',
  'nainen': 'wahine', 'lapsi': 'tamaiti', 'lapset': 'tamariki',
  'tyttö': 'kōtiro', 'poika': 'tamaiti tāne', 'äiti': 'whaea',
  'isä': 'matua', 'kuolema': 'mate', 'elämä': 'oranga',
  'elävä': 'ora', 'kuollut': 'mate', 'sairas': 'māuiui',
  'sota': 'pakanga', 'rauha': 'rangimārie', 'vaara': 'mōrearea',
  'salaisuus': 'muna', 'tiimi': 'rōpū', 'ryhmä': 'rōpū',
  'maailma': 'ao', 'nimi': 'ingoa', 'sana': 'kupu', 'kieli': 'reo',
  'ääni': 'reoreo',
  'vesi': 'wai', 'tuli': 'ahi', 'aurinko': 'rā', 'kuu': 'marama',
  'tähti': 'whetū', 'taivas': 'rangi', 'meri': 'moana',
  'valtameri': 'moana', 'maa': 'whenua', 'vuori': 'maunga',
  'joki': 'awa', 'metsä': 'ngahere', 'puu': 'rākau', 'lintu': 'manu',
  'kala': 'ika', 'koira': 'kurī', 'kissa': 'ngeru', 'ruoka': 'kai',
  'yö': 'pō', 'päivä': 'rā', 'aamu': 'ata', 'ilta': 'ahiahi',
  'aika': 'wā', 'tunti': 'haora', 'minuutti': 'meneti',
  'viikko': 'wiki', 'kuukausi': 'marama', 'vuosi': 'tau',
  'syödä': 'kai', 'juoda': 'inu', 'nukkua': 'moe', 'työ': 'mahi',
  'pelata': 'tākaro', 'laulu': 'waiata', 'tanssi': 'kanikani',
  'kirja': 'pukapuka', 'koulu': 'kura', 'oppia': 'ako',
  'opettaa': 'whakaako', 'tietää': 'mōhio', 'ymmärtää': 'mārama',
  'nähdä': 'kite', 'katsoa': 'titiro', 'puhua': 'kōrero',
  'sanoa': 'kī', 'kertoa': 'kōrero', 'kysyä': 'pātai',
  'vastata': 'whakautu', 'antaa': 'hoatu', 'ottaa': 'tango',
  'saada': 'tiki', 'rakentaa': 'hanga', 'löytää': 'kite',
  'käyttää': 'whakamahi', 'auttaa': 'āwhina', 'aloittaa': 'tīmata',
  'alkaa': 'tīmata', 'loppu': 'mutu', 'valmis': 'oti',
  'lopettaa': 'mutu', 'pysäyttää': 'mutu', 'odottaa': 'taria',
  'juosta': 'oma', 'kävellä': 'haere', 'mennä': 'haere',
  'tulla': 'haere mai', 'palata': 'hoki', 'avata': 'whakatuwhera',
  'sulkea': 'kati', 'lukea': 'pānui', 'kirjoittaa': 'tuhi',
  'lähettää': 'tuku', 'näyttää': 'whakaatu', 'piilottaa': 'huna',
  'luoda': 'hanga',
  'yksi': 'kotahi', 'kaksi': 'rua', 'kolme': 'toru', 'neljä': 'whā',
  'viisi': 'rima', 'kuusi': 'ono', 'seitsemän': 'whitu',
  'kahdeksan': 'waru', 'yhdeksän': 'iwa', 'kymmenen': 'tekau',
  'sata': 'rau', 'tuhat': 'mano', 'sydän': 'manawa', 'pää': 'upoko',
  'käsi': 'ringa', 'silmä': 'karu', 'korva': 'taringa', 'suu': 'waha',
  'tietokone': 'rorohiko', 'puhelin': 'waea', 'näyttö': 'mata',
  'tiedosto': 'kōnae', 'data': 'raraunga', 'tieto': 'pārongo',
  'tietokanta': 'pātengi raraunga', 'verkko': 'whatunga',
  'internet': 'ipurangi', 'verkkosivusto': 'pae tukutuku',
  'sivu': 'whārangi', 'linkki': 'hononga', 'etsiä': 'rapu',
  'käyttäjä': 'kaiwhakamahi', 'tili': 'pūkete', 'salasana': 'kupuhipa',
  'palvelin': 'tūmau', 'asiakas': 'kiritaki', 'koodi': 'waehere',
  'ohjelma': 'hotaka', 'komento': 'whakahau', 'rivi': 'raina',
  'komentosarja': 'tuhinga', 'teksti': 'tuhinga', 'viesti': 'karere',
  'sähköposti': 'īmēra', 'syöte': 'whakauru', 'tuloste': 'whakaputa',
  'virhe': 'hapa', 'varoitus': 'whakatūpato',
  'testi': 'whakamātautau', 'ladata': 'tikiake',
  'päivitys': 'whakahou', 'päivittää': 'whakahou', 'poistaa': 'uku',
  'tallentaa': 'tiaki', 'istunto': 'nohoanga',
  'transkriptio': 'tuhinga', 'kääntää': 'whakamāori',
  'käännös': 'whakamāoritanga', 'alkuperäinen': 'taketake',
  'kopio': 'tārua', 'kopioida': 'tārua', 'salata': 'whakahuna',
  'purkaa': 'wetehuna', 'turvallisuus': 'haumaru',
  'alkuperä': 'whakapapa', 'historia': 'hītori', 'raportti': 'pūrongo',
  'projekti': 'kaupapa', 'tehtävä': 'mahi', 'musiikki': 'puoro',
  'kaupunki': 'tāone', 'tie': 'huarahi', 'ovi': 'kuaha',
  'talo': 'whare', 'koti': 'kāinga', 'raha': 'moni',
  'ilmainen': 'kore utu',
};

function renderFi(text) { return substitute(text, CORPUS_FI); }

function renderHaka(text) {
  return substitute(substitute(text, CORPUS_FI), CORPUS_MI);
}

module.exports = { renderFi, renderHaka, CORPUS_FI, CORPUS_MI };
