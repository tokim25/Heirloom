const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInviteCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
};

// Accepts "HEIR-ABCD-EFGH", "heir abcd efgh", "ABCDEFGH", etc.
export const normalizeInviteCode = (input: string) =>
  input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^HEIR(?=[A-Z0-9]{8}$)/, '');

export const formatInviteCode = (code: string) =>
  code.length === 8 ? `HEIR-${code.slice(0, 4)}-${code.slice(4)}` : code;

/** A link that opens Heirloom straight to "Join this household?" for the given code. */
export const inviteLink = (code: string, origin: string) => `${origin}/join/${normalizeInviteCode(code)}`;
