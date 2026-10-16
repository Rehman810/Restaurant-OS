export function clientClockSkewMinutes(clientCreatedAt: Date, serverReceivedAt: Date) {
  const diffMs = clientCreatedAt.getTime() - serverReceivedAt.getTime();
  return Math.round(diffMs / 60_000);
}

export function clockSkewFlag(
  skewMinutes: number,
  thresholdMinutes: number
) {
  return Math.abs(skewMinutes) > thresholdMinutes;
}
