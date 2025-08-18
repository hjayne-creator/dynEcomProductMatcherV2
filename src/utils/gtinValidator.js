// Add to src/utils/gtinValidator.js
const validateGTIN = (gtin) => {
    if (!/^\d+$/.test(gtin)) return false;

    const digits = gtin.split('').map(Number);
    const checkDigit = digits.pop();

    let sum = 0;
    digits.forEach((d, i) => {
        sum += d * (i % 2 === 0 ? 3 : 1);
    });

    const calculatedCheck = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheck;
};

module.exports = { validateGTIN };
