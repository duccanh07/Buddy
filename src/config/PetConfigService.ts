import type { PetConfig } from '../shared/types';
import { validatePetConfig } from '../shared/validation';
import { configRepository } from './ConfigRepository';
import { DEFAULT_PET_CONFIG } from './defaultConfig';

/**
 * PetConfigService adds business logic on top of ConfigRepository:
 * - Validates before save
 * - Debounces position saves
 * - Applies aspect ratio calculations
 */
export class PetConfigService {
  async loadConfig(): Promise<PetConfig> {
    const raw = await configRepository.loadPetConfig();
    const result = validatePetConfig(raw);

    if (!result.valid) {
      console.warn('[PetConfigService] Config validation warnings:', result.errors);
    }

    return result.data ?? { ...DEFAULT_PET_CONFIG };
  }

  async saveConfig(config: PetConfig): Promise<void> {
    const result = validatePetConfig(config);

    if (!result.data) {
      throw new Error('Config validation failed: ' + result.errors.join(', '));
    }

    await configRepository.savePetConfig(result.data);
  }

  /**
   * Calculate height maintaining aspect ratio given a new width.
   */
  calculateHeight(
    originalWidth: number,
    originalHeight: number,
    newWidth: number
  ): number {
    if (originalWidth <= 0) return newWidth;
    return Math.round((newWidth / originalWidth) * originalHeight);
  }

  /**
   * Calculate width maintaining aspect ratio given a new height.
   */
  calculateWidth(
    originalWidth: number,
    originalHeight: number,
    newHeight: number
  ): number {
    if (originalHeight <= 0) return newHeight;
    return Math.round((newHeight / originalHeight) * originalWidth);
  }

}

export const petConfigService = new PetConfigService();
