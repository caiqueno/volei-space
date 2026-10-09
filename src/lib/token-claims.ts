export const TOKEN_AUD = {
  admin: 'volei-admin',
  public: 'volei-public',
  reset: 'volei-password-reset',
  activation: 'volei-account-activation',
} as const

export const TOKEN_TYP = {
  admin: 'admin',
  public: 'public',
  reset: 'password-reset',
  activation: 'account-activation',
} as const

export type TokenKind = keyof typeof TOKEN_AUD
