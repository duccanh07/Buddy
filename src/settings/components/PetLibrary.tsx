import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';
import type { PetProfile } from '../../shared/types';
import { isValidImagePath } from '../../shared/validation';
import { PlusCircle, Trash2, CheckCircle2, Play } from 'lucide-react';
import { petConfigService } from '../../config/PetConfigService';
import { emit } from '@tauri-apps/api/event';
import { EVENTS } from '../../shared/events';

const PetLibrary: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsStore();
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPets = useCallback(async () => {
    try {
      const allPets = await invoke<PetProfile[]>('get_all_pets');
      setPets(allPets);
    } catch (err) {
      console.error('[PetLibrary] Failed to load pets:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  const handleImportPet = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Pet Config or Image', extensions: ['json', 'gif', 'webp', 'png'] }],
      });

      if (typeof selected === 'string' && (selected.toLowerCase().endsWith('.json') || isValidImagePath(selected))) {
        const name = `Pet ${pets.length + 1}`;

        const newPet = await invoke<PetProfile>('import_pet', {
          name,
          sourcePath: selected,
          width: 180,
          height: 180,
          preserveAspectRatio: true,
        });
        await loadPets();
        handleSelectPet(newPet);
      }
    } catch (err) {
      console.error('[PetLibrary] Import error:', err);
    }
  };

  const handleSelectPet = async (pet: PetProfile) => {
    const updated = {
      ...draftConfig,
      activePetId: pet.id,
      imagePath: pet.imagePath,
      width: pet.width,
      height: pet.height,
      preserveAspectRatio: pet.preserveAspectRatio,
      spritesheetEnabled: pet.spritesheetEnabled,
      spritesheetCols: pet.spritesheetCols,
      spritesheetRows: pet.spritesheetRows,
      spritesheetFps: pet.spritesheetFps,
      spritesheetIdleFrame: pet.spritesheetIdleFrame,
      spritesheetWalkFrame: pet.spritesheetWalkFrame,
      spritesheetDragFrame: pet.spritesheetDragFrame,
      spritesheetSleepFrame: pet.spritesheetSleepFrame,
      spriteVersionNumber: pet.spriteVersionNumber,
      animationManifest: pet.animationManifest,
    };

    updateDraftConfig(updated);

    try {
      // Instant activation: save to config database
      await petConfigService.saveConfig(updated);
      // Emit config updated to Pet Window
      await emit(EVENTS.PET_CONFIG_UPDATED, updated);
      // Set window size
      await invoke('set_pet_window_size', {
        width: pet.width,
        height: pet.height,
        scalePercent: draftConfig.reminderBubbleScale ?? 100,
      });
    } catch (err) {
      console.error('[PetLibrary] Failed to activate pet:', err);
    }
  };

  const handleDeletePet = async (petId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('delete_pet', { id: petId });
      if (draftConfig.activePetId === petId) {
        updateDraftConfig({
          activePetId: undefined,
          imagePath: '',
        });
      }
      await loadPets();
    } catch (err) {
      console.error('[PetLibrary] Delete error:', err);
    }
  };

  if (isLoading) return <div className="settings-section">Loading pets...</div>;

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Pet Library</h2>
      <p className="form-label form-label--small" style={{ marginBottom: '1rem' }}>
        Select a pet to display, activate them instantly, or import a new one.
      </p>

      {/* Grid container for Pet cards (vertical column layouts) */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '1rem', 
          paddingBottom: '0.85rem'
        }}
      >
        {pets.map((pet) => {
          const isActive = draftConfig.activePetId === pet.id;
          const frameAspect = pet.animationManifest
            ? pet.animationManifest.frameWidth / pet.animationManifest.frameHeight
            : pet.width / Math.max(1, pet.height);
          const thumbnailWidth = frameAspect >= 1 ? 80 : Math.round(80 * frameAspect);
          const thumbnailHeight = frameAspect >= 1 ? Math.round(80 / frameAspect) : 80;
          return (
            <div
              key={pet.id}
              style={{
                border: isActive ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'var(--color-surface-2)',
                position: 'relative',
                transition: 'var(--transition)',
              }}
            >
              {/* Delete Button */}
              <button
                className="btn btn--danger"
                style={{ 
                  position: 'absolute', 
                  top: 6, 
                  right: 6, 
                  padding: 4, 
                  borderRadius: '50%',
                  lineHeight: 0,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={(e) => handleDeletePet(pet.id, e)}
                title="Delete Pet"
              >
                <Trash2 size={12} className="text-danger" />
              </button>

              <div
                role="img"
                aria-label={pet.name}
                style={{
                  width: 80,
                  height: 80,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: thumbnailWidth,
                    height: thumbnailHeight,
                    backgroundImage: `url("${convertFileSrc(pet.imagePath)}")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'left top',
                    backgroundSize: `${Math.max(1, pet.spritesheetCols)}00% ${Math.max(1, pet.spritesheetRows)}00%`,
                    imageRendering: 'auto',
                  }}
                />
              </div>

              <span 
                style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: isActive ? 600 : 400, 
                  textAlign: 'center', 
                  textOverflow: 'ellipsis', 
                  overflow: 'hidden', 
                  whiteSpace: 'nowrap', 
                  width: '100%',
                  marginBottom: '0.5rem'
                }}
              >
                {pet.name}
              </span>

              {/* Active status indicator or Activate button */}
              {isActive ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Active
                </div>
              ) : (
                <button
                  onClick={() => handleSelectPet(pet)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-accent)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    width: '100%',
                    fontWeight: 500,
                  }}
                >
                  <Play size={10} fill="currentColor" /> Activate
                </button>
              )}
            </div>
          );
        })}

        {/* Add New Card */}
        <div
          onClick={handleImportPet}
          style={{
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '146px',
            color: 'var(--color-text-muted)',
            transition: 'var(--transition)',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
          <PlusCircle size={30} style={{ marginBottom: '0.5rem' }} />
          <span style={{ fontSize: '0.85rem' }}>Import Pet</span>
        </div>
      </div>
    </section>
  );
};

export default PetLibrary;
