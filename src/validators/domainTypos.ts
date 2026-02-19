// Maps common domain typos to their correct versions
export const DOMAIN_TYPO_MAP: Record<string, string> = {
  // Gmail
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmaiil.com': 'gmail.com',
  // Yahoo
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yaoo.com': 'yahoo.com',
  // Hotmail
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  // Outlook
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlok.co.il': 'outlook.co.il',
  // Walla
  'walla.co.i': 'walla.co.il',
  'wala.co.il': 'walla.co.il',
  'wallaa.co.il': 'walla.co.il',
  'walla.coil': 'walla.co.il',
  'walla.co': 'walla.co.il',
  // Bezeqint
  'bezeqint.ne': 'bezeqint.net',
  'bezqint.net': 'bezeqint.net',
  'bezeqint.nt': 'bezeqint.net',
  'bezeqint.met': 'bezeqint.net',
  // 013
  '013.net.i': '013.net.il',
  '013.nt.il': '013.net.il',
  '013.net.l': '013.net.il',
  // 012
  '012.net.i': '012.net.il',
  '012.nt.il': '012.net.il',
  // Netvision
  'netvision.net.i': 'netvision.net.il',
  'ntvision.net.il': 'netvision.net.il',
};

export const KNOWN_VALID_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'outlook.co.il',
  'walla.co.il',
  'walla.com',
  'bezeqint.net',
  '013.net.il',
  '012.net.il',
  'netvision.net.il',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
];

export const INVALID_TLDS = [
  'con', 'cmo', 'cm', 'om', 'ne', 'nt', 'co', 'i', 'l', 'il.',
];
