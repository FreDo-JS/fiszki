import React from 'react';
import { CardLevel, CardType, StudyMode } from '../api/types';
import { ChipGroup } from './ui';
import { CARD_LEVELS, CARD_TYPES, CARD_TYPE_LABEL, STUDY_MODE_LABEL } from '../utils/cards';

/** "all" is the filter's own sentinel — the API simply omits the parameter. */
export type TypeFilterValue = CardType | 'all';
export type LevelFilterValue = CardLevel | 'all';

export function TypeFilter({ value, onChange }: { value: TypeFilterValue; onChange: (v: TypeFilterValue) => void }) {
  return (
    <ChipGroup<TypeFilterValue>
      name="card-type"
      label="Filtruj według rodzaju fiszki"
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'Wszystkie' },
        ...CARD_TYPES.map((t) => ({ value: t as TypeFilterValue, label: CARD_TYPE_LABEL[t] })),
      ]}
    />
  );
}

export function LevelFilter({ value, onChange }: { value: LevelFilterValue; onChange: (v: LevelFilterValue) => void }) {
  return (
    <ChipGroup<LevelFilterValue>
      name="card-level"
      label="Filtruj według poziomu"
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'Każdy poziom' },
        ...CARD_LEVELS.map((l) => ({ value: l as LevelFilterValue, label: l })),
      ]}
    />
  );
}

export function ModeFilter({ value, onChange }: { value: StudyMode; onChange: (v: StudyMode) => void }) {
  return (
    <ChipGroup<StudyMode>
      name="study-mode"
      label="Tryb nauki"
      value={value}
      onChange={onChange}
      options={(['mixed', 'review', 'new'] as StudyMode[]).map((m) => ({ value: m, label: STUDY_MODE_LABEL[m] }))}
    />
  );
}

/** Label + control row, so the three filters line up on every page. */
export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </div>
  );
}
