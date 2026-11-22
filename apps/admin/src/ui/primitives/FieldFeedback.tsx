type FieldFeedbackProps = {
  id: string;
  hint?: string;
  error?: string;
};

export function fieldDescription({
  id,
  hint,
  error,
  describedBy,
}: FieldFeedbackProps & { describedBy?: string }) {
  return (
    [describedBy, hint && `${id}-hint`, error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function FieldFeedback({ id, hint, error }: FieldFeedbackProps) {
  return (
    <>
      {hint && (
        <span className="label-text-alt" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span
          className="label-text-alt text-error"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </span>
      )}
    </>
  );
}

export function FieldLabel({
  id,
  label,
  required,
}: {
  id: string;
  label?: string;
  required?: boolean;
}) {
  if (!label) {
    return null;
  }

  return (
    <label className="label" htmlFor={id}>
      <span className="label-text">
        {label}
        {required && (
          <span aria-hidden="true" className="admin-required-mark" />
        )}
      </span>
    </label>
  );
}
