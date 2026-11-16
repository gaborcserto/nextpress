import type { Dispatch, SetStateAction } from "react";

import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
} from "@/lib/settings/admin-settings";

export type {
  ProviderCredentialUpdates,
  SettingsApiPayload,
  SettingsApiResponse,
  SettingsFormValues,
} from "@/lib/settings/admin-settings";

export type SettingsScreenState = {
  form: SettingsFormValues;
  setForm: Dispatch<SetStateAction<SettingsFormValues>>;
  loaded: boolean;
  loadError: string | null;
  retry: () => Promise<void>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (credentials: ProviderCredentialUpdates) => Promise<boolean>;
};
