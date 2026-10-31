// Login and register layout: a teal welcome panel beside the form card
// (the panel is hidden on narrow screens).
export default function AuthCard({ title, children }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[42%] flex-col justify-between bg-brand p-10 text-white md:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cta font-bold text-ink">S</span>
          <span className="text-2xl font-bold">StudyMate</span>
        </div>
        <div>
          <p className="text-3xl leading-snug font-semibold">Study smarter from your own notes.</p>
          <p className="mt-4 max-w-sm text-brand-soft">
            Upload your PDFs, ask questions, and get answers and summaries that point to the exact page.
          </p>
        </div>
        <p className="text-sm text-brand-soft">AI study assistant · college project</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-7 shadow-sm">
          <div className="mb-1 text-xl font-bold text-brand md:hidden">StudyMate</div>
          <h1 className="mb-6 text-xl font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
