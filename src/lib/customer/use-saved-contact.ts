'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CONTACT_FORM_FIELD_NAMES,
  SAVED_CONTACT_STORAGE_KEY,
  mergeSavedContact,
  parseSavedContact,
  serializeSavedContact,
  type SavedContact,
  type SavedContactField,
} from './saved-contact';

function readStored(): SavedContact | null {
  try {
    return parseSavedContact(localStorage.getItem(SAVED_CONTACT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Per-device saved contact details for the public order/quote forms. Like CartProvider, storage is
 * only read after mount so SSR and the first client render match (no hydration mismatch).
 */
export function useSavedContact() {
  const [contact, setContact] = useState<SavedContact | null>(null);
  const [isReady, setIsReady] = useState(false);
  // Opt-out: checked by default, the customer can untick it before submitting.
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    setContact(readStored());
    setIsReady(true);
  }, []);

  /** Forget everything stored on this device. */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(SAVED_CONTACT_STORAGE_KEY);
    } catch {
      // Storage disabled — nothing was stored.
    }
    setContact(null);
  }, []);

  /** Call only after a successful submit. Unticked "remember" forgets any previously saved data. */
  const saveAfterSubmit = useCallback(
    (submitted: Partial<SavedContact>) => {
      if (!remember) {
        clear();
        return;
      }
      const next = mergeSavedContact(readStored(), submitted);
      try {
        localStorage.setItem(SAVED_CONTACT_STORAGE_KEY, serializeSavedContact(next));
      } catch {
        // Storage disabled/full — details just won't be remembered.
      }
      setContact(next);
    },
    [remember, clear],
  );

  return { contact, isReady, remember, setRemember, saveAfterSubmit, clear };
}

type StringSetter = (update: (current: string) => string) => void;

/**
 * Prefill controlled inputs (modals that keep contact fields in useState). Only empty values are
 * filled. Pass React state setters (stable identities).
 */
export function useContactStatePrefill(
  contact: SavedContact | null,
  setters: Partial<Record<SavedContactField, StringSetter>>,
) {
  const { name, phone, email, addressLine1, ward, city } = setters;
  useEffect(() => {
    if (!contact) return;
    const pairs: [StringSetter | undefined, string][] = [
      [name, contact.name], [phone, contact.phone], [email, contact.email],
      [addressLine1, contact.addressLine1], [ward, contact.ward], [city, contact.city],
    ];
    for (const [setter, saved] of pairs) {
      if (setter && saved !== '') setter((current) => (current === '' ? saved : current));
    }
  }, [contact, name, phone, email, addressLine1, ward, city]);
}

/**
 * Prefill an uncontrolled form: returns a callback ref for the <form>. Only empty inputs are filled,
 * so nothing the customer already typed is overwritten. `trigger` re-runs the fill when contact
 * inputs mount later than the form (e.g. /custom-print step 2).
 */
export function useContactFormPrefill(contact: SavedContact | null, trigger?: unknown) {
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!formElement || !contact) return;
    for (const field of Object.keys(CONTACT_FORM_FIELD_NAMES) as SavedContactField[]) {
      const input = formElement.elements.namedItem(CONTACT_FORM_FIELD_NAMES[field]);
      if (input instanceof HTMLInputElement && input.value === '' && contact[field] !== '') {
        input.value = contact[field];
      }
    }
  }, [formElement, contact, trigger]);

  return setFormElement;
}
