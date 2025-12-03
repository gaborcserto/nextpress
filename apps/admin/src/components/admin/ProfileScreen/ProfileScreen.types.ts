import type { ChangeEvent, FormEvent } from "react";

export type ProfileFormValues = {
  name: string;
  image: string;
};

/**
 * Shape of the user object we care about for the profile screen.
 * We only rely on `name` and `image`.
 */
export type UserWithProfileImage = {
  name?: string | null;
  image?: string | null;
};

export type ProfileInputChangeEvent = ChangeEvent<HTMLInputElement>;
export type ProfileFormEvent = FormEvent<HTMLFormElement> | FormEvent;
