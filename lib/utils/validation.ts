export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function validateMacAddress(mac: string): boolean {
  return /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac.trim());
}

export function validateUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateUser(user: {
  firstName: string;
  lastName: string;
  email: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!user.firstName.trim()) errors.push("First name is required");
  if (!user.lastName.trim()) errors.push("Last name is required");
  if (!user.email.trim()) errors.push("Email is required");
  else if (!validateEmail(user.email)) errors.push("Invalid email format");
  return { valid: errors.length === 0, errors };
}

export function validatePortingProvider(provider: {
  providerName: string;
  accountNumber: string;
  providerBtn: string;
  pin: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!provider.providerName.trim()) errors.push("Provider name is required");
  if (!provider.accountNumber.trim()) errors.push("Account number is required");
  if (!provider.providerBtn.trim()) errors.push("Billing telephone number is required");
  else if (!validatePhoneNumber(provider.providerBtn)) errors.push("Invalid billing telephone number format");
  if (!provider.pin.trim()) errors.push("PIN / passcode is required");
  return { valid: errors.length === 0, errors };
}

export function validatePortingAddress(addr: {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!addr.firstName.trim()) errors.push("First name is required");
  if (!addr.lastName.trim()) errors.push("Last name is required");
  if (!addr.email.trim()) errors.push("Email is required");
  else if (!validateEmail(addr.email)) errors.push("Invalid email format");
  if (!addr.address1.trim()) errors.push("Address is required");
  if (!addr.city.trim()) errors.push("City is required");
  if (!addr.state.trim()) errors.push("State is required");
  if (!addr.zip.trim()) errors.push("ZIP code is required");
  else if (!/^\d{5}(-\d{4})?$/.test(addr.zip.trim())) errors.push("Invalid ZIP format (e.g. 10001 or 10001-1234)");
  return { valid: errors.length === 0, errors };
}
