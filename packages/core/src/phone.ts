export type PhoneCountry = {
  code: string
  name: string
  dialCode: string
  example: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "IN", name: "India", dialCode: "+91", example: "9876543210" },
  { code: "US", name: "United States", dialCode: "+1", example: "4155552671" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", example: "7911123456" },
  { code: "CA", name: "Canada", dialCode: "+1", example: "4165552671" },
  { code: "AU", name: "Australia", dialCode: "+61", example: "412345678" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", example: "1712345678" },
  { code: "NP", name: "Nepal", dialCode: "+977", example: "9841234567" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", example: "712345678" },
  { code: "SG", name: "Singapore", dialCode: "+65", example: "81234567" },
  { code: "MY", name: "Malaysia", dialCode: "+60", example: "123456789" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", example: "501234567" },
  { code: "DE", name: "Germany", dialCode: "+49", example: "15123456789" },
  { code: "FR", name: "France", dialCode: "+33", example: "612345678" },
  { code: "IT", name: "Italy", dialCode: "+39", example: "3123456789" },
  { code: "ES", name: "Spain", dialCode: "+34", example: "612345678" },
  { code: "BR", name: "Brazil", dialCode: "+55", example: "11987654321" },
  { code: "ZA", name: "South Africa", dialCode: "+27", example: "821234567" },
  { code: "KE", name: "Kenya", dialCode: "+254", example: "712345678" },
  { code: "NG", name: "Nigeria", dialCode: "+234", example: "8021234567" },
  { code: "JP", name: "Japan", dialCode: "+81", example: "9012345678" },
]

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function validateNationalPhoneNumber(countryCode: string, nationalNumber: string): string | null {
  const digits = digitsOnly(nationalNumber)
  if (!digits) return "Enter your mobile number."

  const region = countryCode.toUpperCase()
  if (region === "IN") {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return "Enter a valid 10-digit Indian mobile number (starts with 6–9)."
    }
    return null
  }

  if (digits.length < 4 || digits.length > 14) {
    return "Enter a valid mobile number."
  }
  return null
}

export function formatPhonePayload(countryCode: string, nationalNumber: string) {
  return {
    phone_country_code: countryCode.toUpperCase(),
    phone_number: digitsOnly(nationalNumber),
  }
}
