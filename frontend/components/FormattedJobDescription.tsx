"use client";

import type { JobWorkType } from "@/lib/prompts/job-page-extract";
import { formatJobWorkTypeLabel } from "@/lib/prompts/job-page-extract";
import { parseJobDescriptionBlocks } from "@/lib/format-job-description";
import { jobWorkTypeBadgeClass } from "@/lib/job-work-type";
import { securityClearanceBadgeClass } from "@/lib/job-security-clearance";
import {
  jobCompanyTextClass,
  jobContextSepClass,
  jobIndustryTextClass,
  jobLocationTextClass,
  jobPostedDateTextClass,
} from "@/lib/job-display-styles";

interface FormattedJobDescriptionProps {
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
  jobLocation?: string;
  industry?: string;
  securityClearance?: string;
  salary?: string;
  postedDate?: string;
  jobTypes?: JobWorkType[];
  requiresTravel?: boolean;
  className?: string;
}

function JobMetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

export default function FormattedJobDescription({
  jobDescription,
  jobTitle,
  companyName,
  jobLocation,
  industry,
  securityClearance,
  salary,
  postedDate,
  jobTypes = [],
  requiresTravel = false,
  className = "",
}: FormattedJobDescriptionProps) {
  const blocks = parseJobDescriptionBlocks(jobDescription);
  const visibleTypes = jobTypes.filter((type) => type !== "unknown");

  const line1Parts = Boolean(
    jobTitle || companyName || industry
  );
  const roleTypeLabel =
    visibleTypes.length > 0
      ? visibleTypes.map((type) => formatJobWorkTypeLabel(type)).join(" · ")
      : "";
  const line2Parts = Boolean(
    jobLocation ||
      roleTypeLabel ||
      postedDate ||
      salary ||
      securityClearance ||
      requiresTravel
  );

  return (
    <article className={`space-y-5 ${className}`.trim()}>
      {(line1Parts || line2Parts) && (
        <header className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-600/50 dark:from-slate-800/80 dark:to-slate-900/40">
          {line1Parts ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {jobTitle ? (
                <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {jobTitle}
                </h3>
              ) : null}
              {companyName ? (
                <>
                  {jobTitle ? <span className={jobContextSepClass}>·</span> : null}
                  <span className={`text-sm ${jobCompanyTextClass}`}>{companyName}</span>
                </>
              ) : null}
              {industry ? (
                <>
                  {jobTitle || companyName ? (
                    <span className={jobContextSepClass}>·</span>
                  ) : null}
                  <span className={`text-sm ${jobIndustryTextClass}`}>{industry}</span>
                </>
              ) : null}
            </div>
          ) : null}

          {line2Parts ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {jobLocation ? (
                <span className={jobLocationTextClass}>{jobLocation}</span>
              ) : null}
              {roleTypeLabel ? (
                <>
                  {jobLocation ? <span className={jobContextSepClass}>·</span> : null}
                  <span className="inline-flex flex-wrap gap-1">
                    {visibleTypes.map((type) => (
                      <span
                        key={type}
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${jobWorkTypeBadgeClass(type)}`}
                      >
                        {formatJobWorkTypeLabel(type)}
                      </span>
                    ))}
                  </span>
                </>
              ) : null}
              {postedDate ? (
                <>
                  {jobLocation || roleTypeLabel ? (
                    <span className={jobContextSepClass}>·</span>
                  ) : null}
                  <span className={jobPostedDateTextClass}>Posted {postedDate}</span>
                </>
              ) : null}
              {salary ? (
                <>
                  {jobLocation || roleTypeLabel || postedDate ? (
                    <span className={jobContextSepClass}>·</span>
                  ) : null}
                  <JobMetaPill>{salary}</JobMetaPill>
                </>
              ) : null}
              {securityClearance ? (
                <>
                  {jobLocation || roleTypeLabel || postedDate || salary ? (
                    <span className={jobContextSepClass}>·</span>
                  ) : null}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${securityClearanceBadgeClass()}`}
                  >
                    {securityClearance}
                  </span>
                </>
              ) : null}
              {requiresTravel ? (
                <>
                  {jobLocation || roleTypeLabel || postedDate || salary || securityClearance ? (
                    <span className={jobContextSepClass}>·</span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                    Travel required
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </header>
      )}

      <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {blocks.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">No description was extracted for this job.</p>
        ) : (
          blocks.map((block, index) => {
            if (block.type === "heading") {
              return (
                <h4
                  key={`h-${index}`}
                  className="border-b border-slate-200/80 pb-1.5 text-sm font-semibold uppercase tracking-wide text-slate-900 dark:border-slate-600/50 dark:text-slate-100"
                >
                  {block.text}
                </h4>
              );
            }

            if (block.type === "bullets") {
              return (
                <ul
                  key={`ul-${index}`}
                  className="list-disc space-y-2 pl-5 marker:text-blue-500 dark:marker:text-blue-400"
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="pl-0.5">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={`p-${index}`} className="text-[15px] leading-7 text-slate-700 dark:text-slate-200">
                {block.text}
              </p>
            );
          })
        )}
      </div>
    </article>
  );
}
