const FALLBACK_US_PHONETIC: Record<string, string> = {
  attic: '/ˈætɪk/',
  crooked: '/ˈkrʊkɪd/',
  dusty: '/ˈdʌsti/',
  murmur: '/ˈmɝːmər/',
  scribble: '/ˈskrɪbəl/',
};

type DictionaryEntry = {
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
  }>;
};

function normalizePhonetic(text: string) {
  // 第三方接口返回窄式 IPA，统一归一为词典写法（与库里风格一致）。
  const trimmed = text.trim().replace(/ɹ/g, 'r').replace(/ɛ/g, 'e');
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('[')) {
    return trimmed;
  }

  return `/${trimmed}/`;
}

function pickUsPhonetic(entries: DictionaryEntry[]) {
  for (const entry of entries) {
    const usPhonetic = entry.phonetics?.find(
      (item) => item.text && item.audio?.toLowerCase().includes('-us.'),
    );
    if (usPhonetic?.text) {
      return normalizePhonetic(usPhonetic.text);
    }
  }

  for (const entry of entries) {
    const text = entry.phonetics?.find((item) => item.text)?.text ?? entry.phonetic;
    if (text) {
      return normalizePhonetic(text);
    }
  }

  return null;
}

async function fetchDictionaryPhonetic(lemma: string) {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lemma)}`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      return null;
    }

    return pickUsPhonetic(payload as DictionaryEntry[]);
  } catch {
    return null;
  }
}

export async function getUsPhonetic(candidates: string[]) {
  for (const lemma of candidates) {
    const fallback = FALLBACK_US_PHONETIC[lemma];
    if (fallback) {
      return fallback;
    }
  }

  for (const lemma of candidates) {
    const phonetic = await fetchDictionaryPhonetic(lemma);
    if (phonetic) {
      return phonetic;
    }
  }

  return null;
}
