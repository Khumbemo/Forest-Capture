/**
 * Unit tests for the SylvX tool-calling schema and confirm-card copy.
 */

import { TOOL_DECLARATIONS, isWriteTool, describeWriteCall } from '../src/modules/ai-knowledge.js';

describe('ai-knowledge', () => {
  test('write tools require confirmation, read-only tools do not', () => {
    expect(isWriteTool('add_species_entry')).toBe(true);
    expect(isWriteTool('add_note')).toBe(true);
    expect(isWriteTool('compare_surveys')).toBe(false);
    expect(isWriteTool('lookup_taxonomy')).toBe(false);
  });

  test('every declared tool has a name and a description', () => {
    for (const tool of TOOL_DECLARATIONS) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  test('describeWriteCall summarizes add_species_entry', () => {
    const desc = describeWriteCall('add_species_entry', {
      speciesName: 'Shorea robusta', abundance: 2, dbh: 45, quadratNumber: 1
    });
    expect(desc).toContain('Shorea robusta');
    expect(desc).toContain('Quadrat #1');
    expect(desc).toContain('45cm');
  });

  test('describeWriteCall summarizes add_note', () => {
    const desc = describeWriteCall('add_note', { text: 'Signs of bark beetle damage', category: 'observation' });
    expect(desc).toContain('Signs of bark beetle damage');
    expect(desc).toContain('observation');
  });
});
