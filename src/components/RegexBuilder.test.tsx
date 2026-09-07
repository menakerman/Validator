import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegexBuilder } from './RegexBuilder';
import { useValidatorStore } from '../stores/validatorStore';
import i18n from '../i18n';

const NAMES = ['240000101-07-26.pdf', '240000102-07-26.pdf', '240000103-07-26.pdf'];

const typeNames = (names: string[]) => {
  const textarea = screen.getByRole('textbox', { name: '' }) as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: names.join('\n') } });
};

describe('RegexBuilder', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useValidatorStore.setState({ step: 'regex', regexNames: [] });
  });

  it('shows the inferred pattern and every name as matching', () => {
    render(<RegexBuilder />);
    typeNames(NAMES);

    const code = document.querySelector('code')!;
    expect(code.textContent).toContain('(?<id>\\d+)-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{2})\\.pdf');
    expect(screen.getByText('3 of 3 match')).toBeTruthy();
    expect(document.body.textContent).toContain('id: 240000101');
    expect(document.body.textContent).toContain('month: 07');
  });

  it('renames a group and keeps the names matching', () => {
    render(<RegexBuilder />);
    typeNames(NAMES);

    const nameInput = screen.getAllByPlaceholderText('Name')[0];
    fireEvent.change(nameInput, { target: { value: 'workerid' } });

    expect(document.querySelector('code')!.textContent).toContain('(?<workerid>\\d+)');
    expect(screen.getByText('3 of 3 match')).toBeTruthy();
  });

  it('reports a duplicate group name instead of an unusable pattern', () => {
    render(<RegexBuilder />);
    typeNames(NAMES);

    const nameInputs = screen.getAllByPlaceholderText('Name');
    fireEvent.change(nameInputs[1], { target: { value: 'id' } });

    expect(document.body.textContent).toContain('used more than once');
  });

  it('widens a group when a sample no longer fits the inferred role', () => {
    render(<RegexBuilder />);
    // 13 is not a month, so that segment stops being a month group.
    typeNames([...NAMES, '240000104-13-26.pdf']);

    expect(document.querySelector('code')!.textContent).not.toContain('month');
    expect(screen.getByText('4 of 4 match')).toBeTruthy();
  });

  it('flags names that a hand-edited pattern rejects', () => {
    render(<RegexBuilder />);
    typeNames(NAMES);

    const patternInput = screen.getAllByPlaceholderText('Pattern')[0];
    fireEvent.change(patternInput, { target: { value: '\\d{3}' } });

    expect(screen.getByText('0 of 3 match')).toBeTruthy();
    expect(screen.getAllByText('No match').length).toBe(3);
  });

  it('seeds the input from names dropped on the entry card', () => {
    useValidatorStore.setState({ regexNames: NAMES });
    render(<RegexBuilder />);
    expect(screen.getByText('3 of 3 match')).toBeTruthy();
  });
});
