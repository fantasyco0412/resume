export type QuestionAnswer = {
  question: string;
  answer: string;
};

export function mergeQuestionAnswers(
  existing: QuestionAnswer[],
  incoming: QuestionAnswer[]
): QuestionAnswer[] {
  const merged = [...existing];

  for (const item of incoming) {
    const key = item.question.trim().toLowerCase();
    if (!key) continue;

    const index = merged.findIndex(
      (entry) => entry.question.trim().toLowerCase() === key
    );
    if (index >= 0) {
      merged[index] = item;
    } else {
      merged.push(item);
    }
  }

  return merged;
}
