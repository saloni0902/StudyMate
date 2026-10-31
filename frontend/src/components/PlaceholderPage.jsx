import { useOutletContext } from 'react-router-dom';

// Temporary page body used until each feature is built.
export default function PlaceholderPage({ title, description, stage }) {
  const { subject } = useOutletContext();
  return (
    <div>
      <p className="text-sm font-medium text-brand">{subject.name}</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-body">{description}</p>
      <p className="mt-6 inline-block rounded-md bg-amber-50 px-3 py-1 text-sm text-amber-700">
        Coming in stage {stage}
      </p>
    </div>
  );
}
