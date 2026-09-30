import type {
  ProviderCredentialUpdates,
  SettingsFormValues,
} from "@/lib/settings/admin-settings";
import type { Dispatch, SetStateAction } from "react";


export type {
  ProviderCredentialUpdates,
  SettingsApiPayload,
  SettingsApiResponse,
  SettingsFormValues,
} from "@/lib/settings/admin-settings";

export type SettingsScreenState = {
  form: SettingsFormValues;
  setForm: Dispatch<SetStateAction<SettingsFormValues>>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (credentials: ProviderCredentialUpdates) => Promise<boolean>;
};
