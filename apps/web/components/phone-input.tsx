"use client"

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  validateNationalPhoneNumber,
} from "@prabhat/core"

type PhoneInputProps = {
  countryCode: string
  nationalNumber: string
  onCountryCodeChange: (value: string) => void
  onNationalNumberChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

export function PhoneInput({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  disabled = false,
  required = true,
}: PhoneInputProps) {
  const selected =
    PHONE_COUNTRIES.find((country) => country.code === countryCode) ?? DEFAULT_PHONE_COUNTRY
  const validationError = nationalNumber
    ? validateNationalPhoneNumber(countryCode, nationalNumber)
    : null

  return (
    <div className="grid gap-1.5 text-sm">
      <span className="font-semibold text-navy-950">
        Mobile number{required ? " *" : ""}
      </span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Country code"
          value={countryCode}
          disabled={disabled}
          onChange={(event) => onCountryCodeChange(event.target.value)}
          className="rounded-xl border border-navy-900/10 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-gold-500 sm:max-w-[11rem]"
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.dialCode} {country.name}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          disabled={disabled}
          value={nationalNumber}
          onChange={(event) => onNationalNumberChange(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-navy-900/10 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-gold-500"
          placeholder={selected.example}
        />
      </div>
      {validationError ? (
        <p className="text-xs text-red-700" role="alert">
          {validationError}
        </p>
      ) : (
        <p className="text-xs text-stone-500">
          We use this for account recovery and important updates. Example: {selected.dialCode}{" "}
          {selected.example}
        </p>
      )}
    </div>
  )
}

export function phoneInputValid(countryCode: string, nationalNumber: string) {
  return validateNationalPhoneNumber(countryCode, nationalNumber) === null
}
