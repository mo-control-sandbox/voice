import { ModelCard } from '../components/ModelCard';
import { useModelsController } from '../controllers/useModelsController';
import './ModelsPage.css';

/**
 * Models settings page -- view, download, delete, and activate Whisper models.
 */
export function ModelsPage(): React.JSX.Element {
  const {
    models,
    downloadErrors,
    preparingModelId,
    handleDownload,
    handleDelete,
    handleSetActive,
  } = useModelsController();

  return (
    <div className="models-page">
      <div className="models-page__header">
        <h1 className="models-page__heading">Models</h1>
        <p className="models-page__description">
          Choose the speech recognition engine for your recordings.
        </p>
      </div>

      <div className="models-page__list">
        {models.map((model) => (
          <ModelCard
            key={model.definition.id}
            model={model}
            error={downloadErrors.get(model.definition.id) ?? null}
            isPreparing={preparingModelId === model.definition.id}
            onDownload={() => {
              void handleDownload(model.definition.id);
            }}
            onDelete={() => {
              void handleDelete(model.definition.id);
            }}
            onSetActive={() => {
              void handleSetActive(model.definition.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
