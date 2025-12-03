import * as yup from "yup";

/**
 * Yup validation schema for sign-in form.
 */
export const signInSchema = yup.object({
  email: yup
    .string()
    .email("Please enter a valid email.")
    .required("Email is required."),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters.")
    .required("Password is required."),
});

export type SignInFormValues = yup.InferType<typeof signInSchema>;
