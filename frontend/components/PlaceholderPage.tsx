interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({
  title,
  description = "This section is on the way. Check back soon.",
}: PlaceholderPageProps) {
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-3xl">
        <div className="empty-state animate-rise-in">
          <div className="empty-state-icon">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle mx-auto">{description}</p>
        </div>
      </div>
    </main>
  );
}
