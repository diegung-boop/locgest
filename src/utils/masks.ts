/**
 * Mask & Validation Utilities for Phone, CPF and CNPJ (Locgest)
 */

/**
 * Formats a phone number dynamically.
 * Examples:
 * (85) 99221-8282 (11 digits - mobile)
 * (85) 3221-8282  (10 digits - landline)
 */
export function maskPhone(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Formats CPF or CNPJ dynamically based on input length.
 * <= 11 digits: 000.000.000-00 (CPF)
 * > 11 digits:  00.000.000/0001-00 (CNPJ)
 */
export function maskCpfCnpj(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 11) {
    // CPF Format: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  // CNPJ Format: 00.000.000/0001-00
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Validates CPF using official checksum algorithm (módulo 11)
 */
export function validateCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false; // Rejects 000.000.000-00, 111.111.111-11, etc.

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validates CNPJ using official checksum algorithm (módulo 11)
 */
export function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

/**
 * Validates CPF or CNPJ depending on digit count
 */
export function validateCpfCnpj(value: string): { isValid: boolean; type: "CPF" | "CNPJ" | "INVALID" } {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 11) {
    const isValid = validateCpf(clean);
    return { isValid, type: isValid ? "CPF" : "INVALID" };
  } else {
    const isValid = validateCnpj(clean);
    return { isValid, type: isValid ? "CNPJ" : "INVALID" };
  }
}

/**
 * Formats a numeric value or float to BRL Currency format string (e.g. 1500.5 -> "1.500,50")
 */
export function formatCurrencyBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : parseFloat(value.toString().replace(",", "."));
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Mask for monetary input fields (e.g. typing digits produces 1.500,00)
 * Works as user types: "1500" -> "15,00", "150000" -> "1.500,00"
 */
export function maskCurrencyInput(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const numberValue = parseFloat(digits) / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a BRL Currency string (e.g. "1.500,50") back to float number (1500.5)
 */
export function parseCurrencyToNumber(value: string): number {
  if (!value) return 0;
  const clean = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
