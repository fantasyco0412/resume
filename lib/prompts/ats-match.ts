export function buildAtsMatchPrompt(jd: string, resumeJson: string): string {
  return `You are an ATS (Applicant Tracking System) resume analyst. Compare the candidate's resume against the job description and estimate how well the resume would parse and rank in a typical ATS.

Evaluate:
1. Keyword overlap (required skills, tools, technologies, certifications, role terms)
2. Role alignment (titles, seniority, responsibilities)
3. Evidence in experience bullets (not just skills lists)
4. ATS-friendly structure (clear sections, standard headings, measurable bullets)
5. Critical gaps that would likely filter the candidate out

Job description:
${jd}

Resume (JSON):
${resumeJson}

Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "summary": "One or two sentences overall assessment",
  "matchedKeywords": ["keyword or phrase found in both JD and resume"],
  "missingKeywords": ["important JD keyword or requirement missing or weak in resume"],
  "strengths": ["specific strength for this role"],
  "improvements": ["specific actionable improvement"],
  "formattingNotes": ["ATS formatting or structure note, if any"]
}

Rules:
- score is an integer from 0 to 100 (100 = excellent ATS match)
- matchedKeywords and missingKeywords: up to 12 items each, short phrases
- strengths and improvements: 3 to 5 items each, concise
- formattingNotes: 0 to 3 items; empty array if none
- Be realistic; do not inflate the score
- Only use information from the resume JSON; do not invent credentials
- Output the JSON object directly as your entire response — no analysis text before or after`;
}
