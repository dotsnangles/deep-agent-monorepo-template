export const KOREAN_GREETINGS_WITH_NAME: ((name: string) => string)[] = [
  (name) => `${name}님, 어떤 이야기를 나눠볼까요?`,
  (name) => `${name}님, 무엇을 도와드릴까요?`,
  (name) => `${name}님, 새로운 아이디어가 있으신가요?`,
  (name) => `${name}님, 오늘 어떤 작업을 함께할까요?`,
  (name) => `${name}님, 어디서부터 시작해볼까요?`,
];

export const KOREAN_GREETINGS_GUEST: string[] = [
  "어떤 이야기를 나눠볼까요?",
  "무엇을 도와드릴까요?",
  "새로운 아이디어가 있으신가요?",
  "오늘 어떤 작업을 함께할까요?",
  "어디서부터 시작해볼까요?",
];

export function hashStringToIndex(str: string, modulo: number): number {
  if (!str || modulo <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % modulo;
}

export function getRandomGreeting(userName?: string | null, seedIndex?: number): string {
  const index =
    typeof seedIndex === "number" && seedIndex >= 0
      ? Math.abs(seedIndex) % KOREAN_GREETINGS_GUEST.length
      : 0;

  if (userName?.trim()) {
    const generator = KOREAN_GREETINGS_WITH_NAME[index] || KOREAN_GREETINGS_WITH_NAME[0];
    return generator(userName.trim());
  }

  return KOREAN_GREETINGS_GUEST[index] || KOREAN_GREETINGS_GUEST[0];
}

export function getSessionGreeting(sessionId: string, userName?: string | null): string {
  const index = hashStringToIndex(sessionId, KOREAN_GREETINGS_GUEST.length);
  return getRandomGreeting(userName, index);
}
