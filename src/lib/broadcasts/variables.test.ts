import { describe, expect, it } from 'vitest';
import { resolveVariables, type VariableMapping } from './variables';
import type { Contact } from '@/types';

const contact = {
  id: 'c1',
  user_id: 'u1',
  phone: '+441234567890',
  name: 'Dave',
  email: 'dave@example.com',
  company: "Dave's Autos",
  created_at: '',
  updated_at: '',
} as Contact;

describe('resolveVariables', () => {
  it('resolves static, built-in-field, and custom-field mappings', () => {
    const vars: Record<string, VariableMapping> = {
      '1': { type: 'field', value: 'name' },
      '2': { type: 'static', value: 'hello' },
      '3': { type: 'custom_field', value: 'field-x' },
    };
    const custom = new Map([['field-x', 'VIP']]);
    expect(resolveVariables(vars, contact, custom)).toEqual([
      'Dave',
      'hello',
      'VIP',
    ]);
  });

  it('orders numeric keys naturally (1 before 10)', () => {
    const vars: Record<string, VariableMapping> = {
      '10': { type: 'static', value: 'ten' },
      '2': { type: 'static', value: 'two' },
      '1': { type: 'static', value: 'one' },
    };
    expect(resolveVariables(vars, contact)).toEqual(['one', 'two', 'ten']);
  });

  it('yields empty strings for missing field / custom values', () => {
    const vars: Record<string, VariableMapping> = {
      '1': { type: 'field', value: 'nonexistent' },
      '2': { type: 'custom_field', value: 'missing' },
    };
    expect(resolveVariables(vars, contact)).toEqual(['', '']);
  });
});
