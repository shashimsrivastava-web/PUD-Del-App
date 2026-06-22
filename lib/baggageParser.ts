export interface ParsedBagTag {
  universalTag: string; // 10-digit e.g., '0220123456'
  alphaTag: string;     // Alpha format e.g., 'LH 123456'
  airlineName: string;
  serialNumber: string;
}

export const AIRLINE_PREFIX_TO_NUMERIC: Record<string, string> = {
  'LH': '220',
  'UA': '016',
  'DL': '006',
  'AA': '001',
  'BA': '125',
  'AF': '057',
  'KL': '074',
  'SQ': '618',
  'EK': '176',
  'QR': '157',
  'QF': '081',
  'CX': '160',
  'AI': '098',
  'NH': '205',
  'JL': '131',
  'MS': '077',
  'TK': '235',
  'LX': '724',
  'SN': '082',
};

export const AIRLINE_NUMERIC_TO_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(AIRLINE_PREFIX_TO_NUMERIC).map(([prefix, num]) => [num, prefix])
);

export const AIRLINE_NAMES: Record<string, string> = {
  'LH': 'Lufthansa',
  'UA': 'United Airlines',
  'DL': 'Delta Air Lines',
  'AA': 'American Airlines',
  'BA': 'British Airways',
  'AF': 'Air France',
  'KL': 'KLM Royal Dutch Airlines',
  'SQ': 'Singapore Airlines',
  'EK': 'Emirates',
  'QR': 'Qatar Airways',
  'QF': 'Qantas',
  'CX': 'Cathay Pacific',
  'AI': 'Air India',
  'NH': 'ANA (All Nippon Airways)',
  'JL': 'Japan Airlines',
  'MS': 'EgyptAir',
  'TK': 'Turkish Airlines',
  'LX': 'Swiss International',
  'SN': 'Brussels Airlines',
};

export function parseBagTag(input: string): ParsedBagTag | null {
  if (!input || typeof input !== 'string') return null;
  
  // Strip non-alphanumeric chars & convert to uppercase
  const scrubbed = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!scrubbed) return null;
  
  // Format 1: 10 digit baggage tag (numeric, e.g. 0220123456 or 220123456)
  if (/^\d{9,10}$/.test(scrubbed)) {
    const full10 = scrubbed.padStart(10, '0');
    // Leading digit is usually 0
    const airlineNum = full10.substring(1, 4); // '220'
    const serial = full10.substring(4); // '123456'
    
    const prefix = AIRLINE_NUMERIC_TO_PREFIX[airlineNum] || 'UNK';
    const airlineName = AIRLINE_NAMES[prefix] || 'Unknown Airline';
    
    return {
      universalTag: full10,
      alphaTag: `${prefix} ${serial}`,
      airlineName,
      serialNumber: serial
    };
  }
  
  // Format 2: Alpha tag with airline suffix or prefix (e.g., LH123456 or LH 123456)
  const match = scrubbed.match(/^([A-Z]{2})(\d{1,8})$/);
  if (match) {
    const prefix = match[1];
    const rawSerial = match[2];
    const serial = rawSerial.padStart(6, '0'); // pad to 6 digits standard
    
    const airlineNum = AIRLINE_PREFIX_TO_NUMERIC[prefix] || '999'; // default fallback airline code
    const universalTag = `0${airlineNum}${serial}`;
    const airlineName = AIRLINE_NAMES[prefix] || 'Unknown Airline';
    
    return {
      universalTag,
      alphaTag: `${prefix} ${serial}`,
      airlineName,
      serialNumber: serial
    };
  }
  
  // Format 3: Generic numeric without matching airline, make a universal format 
  if (/^\d+$/.test(scrubbed)) {
    const universalTag = scrubbed.padStart(10, '0').slice(-10);
    return {
      universalTag,
      alphaTag: `BAG ${scrubbed.slice(-6)}`,
      airlineName: 'Non-Standard Airline',
      serialNumber: scrubbed.slice(-6)
    };
  }
  
  // Format 4: Standard alphanumeric text or other input fallback
  const fallbackSerial = scrubbed.slice(-6);
  return {
    universalTag: scrubbed.padEnd(10, 'X').slice(0, 10),
    alphaTag: scrubbed,
    airlineName: 'Non-Standard Carrier',
    serialNumber: fallbackSerial
  };
}
