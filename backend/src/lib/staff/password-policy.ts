const COMMON_PASSWORDS = new Set(
  ["password", "password123", "admin123", "12345678", "qwerty123", "test-pass-123"].map((s) =>
    s.toLowerCase()
  )
);

export function validatePasswordPolicy(password: string, minLength: number): string | null {
  const min = Math.max(8, minLength || 8);
  if (password.length < min) {
    return `Password must be at least ${min} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Choose a less common password.";
  }
  return null;
}
