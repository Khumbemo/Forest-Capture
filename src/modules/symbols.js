// Scientific symbols for unit formatting
export const SYMBOLS = {
    elevation: 'm',
    area: 'm²',
    temperature: '°C',
    diameter: 'cm',
    precision: '±',
    theta: 'θ',
    pi: 'π',
    mu: 'µ'
};

const scientificSymbolsMap = {
    0x2200: '\u2200', // For all
    0x2201: '\u2201', // Complement
    0x2202: '\u2202', // Partial differential
    0x2203: '\u2203', // There exists
    0x2204: '\u2204', // There does not exist
};

export default scientificSymbolsMap;
