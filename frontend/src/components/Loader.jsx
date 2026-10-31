export default function Loader({ fullScreen = false, label = 'Loading…' }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-muted ${fullScreen ? 'min-h-screen' : 'py-10'}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
