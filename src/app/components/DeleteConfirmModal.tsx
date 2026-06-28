import type { Company } from "../types";

export function DeleteConfirmModal({
  company,
  onCancel,
  onConfirm,
}: {
  company: Company;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="confirm-modal">
        <p className="eyebrow danger">Delete company</p>
        <h2 id="delete-title">Remove {company.name}?</h2>
        <p>
          This deletes the shared company map for everyone using the deployed tracker.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-solid" type="button" onClick={onConfirm}>
            Delete company
          </button>
        </div>
      </div>
    </div>
  );
}
